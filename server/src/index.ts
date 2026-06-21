import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CommandRouter } from './engine/CommandRouter.js';
import { PlayerManager } from './systems/PlayerManager.js';
import { createPlayer } from './models/Player.js';
import { MapSystem } from './systems/MapSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
import { ItemSystem } from './systems/ItemSystem.js';
import { NpcSystem } from './systems/NpcSystem.js';
import { SchoolSystem } from './systems/SchoolSystem.js';
import { LevelSystem } from './systems/LevelSystem.js';
import { ConditionSystem } from './systems/ConditionSystem.js';
import { PersistenceSystem } from './systems/PersistenceSystem.js';
import { RealSystemClock } from './time/SystemClock.js';
import { Scheduler } from './time/Scheduler.js';
import net from 'node:net';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_PORT = parseInt(process.env['PORT'] || '3000', 10);

function tryPort(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') resolve(tryPort(port + 1));
      else reject(err);
    });
    server.listen(port, () => {
      server.close(() => resolve(port));
    });
  });
}

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

// In production (after `npm run build`), serve the Vite-built React app.
const distDir = path.resolve(__dirname, '..', '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  console.log(`[server] Serving production build from ${distDir}`);
} else {
  console.log('[server] No dist/ found — running in dev mode (Vite proxies requests)');
}

// Time & scheduling
const clock = new RealSystemClock();
const scheduler = new Scheduler(clock);

// Wire up game systems (order matters for dependencies)
const players = new PlayerManager(clock);
const map = new MapSystem(scheduler);
const combat = new CombatSystem();
const schools = new SchoolSystem();
const skills = new SkillSystem(schools);
const conditions = new ConditionSystem(clock);
const items = new ItemSystem(conditions);
const npcs = new NpcSystem(skills, scheduler);
const levels = new LevelSystem();
const persistence = new PersistenceSystem();

const router = new CommandRouter(players, map, combat, skills, items, npcs, schools, levels, conditions, scheduler, clock);

app.get('/health', (_req, res) => {
  const online = players.getAllPlayers();
  res.json({ status: 'ok', uptime: process.uptime().toFixed(0), online: online.length, players: online.map(p => p.name) });
});

// Load saved players on startup
const savedPlayers = persistence.loadAll();
for (const p of savedPlayers) {
  players.setPlayer(p);
}
console.log(`[server] Loaded ${savedPlayers.length} saved player(s)`);

// Seed demo account on first start
if (savedPlayers.length === 0) {
  const demoHash = Buffer.from("demo:some-secret").toString("base64");
  persistence.saveUser("demo", demoHash);
  const demo = createPlayer("demo", "无名侠客", { str: 15, int: 10, con: 15, dex: 10 });
  demo.pot = 10000;
  players.setPlayer(demo);
  persistence.saveAll(players.getAllPlayers());
  console.log("[server] Seeded demo account (login: demo / pass: some-secret, pot: 10000)");
}

// Global scheduler heartbeat: 100ms resolution is enough for game ticks.
setInterval(() => {
  scheduler.tick();
}, 100);

// Global condition/regen tick: every 5 seconds, process conditions and passive regen for all online players.
scheduler.schedule('global-condition-tick', 5000, () => {
  for (const player of players.getAllPlayers()) {
    if (player.state === 'creating') continue;
    const forceLv = skills.getForceLevel(player);
    conditions.tick(player, forceLv);
    // Passive regen when not fighting or meditating.
    if (player.state !== 'fighting' && !player.isMeditating) {
      player.hp = Math.min(player.maxHp, player.hp + Math.ceil(player.maxHp * 0.03));
      player.mp = Math.min(player.maxMp, player.mp + Math.ceil(player.maxMp * 0.04));
    }
  }
}, 5000);

// Track auth state per socket
const socketAuth = new Map<string, { authState: string; username?: string }>();

// Per-socket combat tick task id
const combatTickTasks = new Map<string, string>();

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Auth greeting
  socketAuth.set(socket.id, { authState: 'login' });
  socket.emit('output', { text: '\n  欢迎来到炎黄群侠传！\n\n  login <用户名> <密码> — 登录\n  register <用户名> <密码> — 注册新账号\n' });

  socket.on('command', (data: { input: string }) => {
    const raw = (data.input || '').trim();
    console.log(`[cmd] ${socket.id}: ${raw}`);

    const auth = socketAuth.get(socket.id);
    if (!auth) return;

    if (auth.authState === 'login') {
      const parts = raw.split(/\s+/);
      const cmd = parts[0]?.toLowerCase();

      if (cmd === 'register' && parts.length >= 3) {
        const username = parts[1].toLowerCase();
        const password = parts.slice(2).join('');
        if (persistence.getUserHash(username)) {
          socket.emit('output', { text: '\n  用户名已存在。请换一个或输入 login <用户名> <密码> 登录。\n' });
          return;
        }
        const hash = Buffer.from(username + ':' + password).toString("base64");
        persistence.saveUser(username, hash);
        socketAuth.set(socket.id, { authState: 'creating', username });
        players.createPlayer(socket.id);
        socket.emit('output', { text: router.handle('', socket.id) });
        return;
      }

      if (cmd === 'login' && parts.length >= 3) {
        const username = parts[1].toLowerCase();
        const password = parts.slice(2).join('');
        const storedHash = persistence.getUserHash(username);
        const inputHash = Buffer.from(username + ':' + password).toString("base64");
        if (!storedHash || storedHash !== inputHash) {
          socket.emit('output', { text: '\n  用户名或密码错误。\n' });
          return;
        }
        const saved = players.getPlayer(username);
        if (saved) {
          socketAuth.set(socket.id, { authState: 'playing', username });
          saved.id = socket.id;
          players.setPlayer(saved);
          const room = map.getRoom(saved.currentRoom);
          socket.emit('output', { text: `\n  欢迎回来，${saved.name}！\n${room ? map.formatRoom(room) : ''}` });
        } else {
          socket.emit('output', { text: '\n  数据丢失，请重新 register。\n' });
        }
        return;
      }

      socket.emit('output', { text: '\n  请先输入 login 或 register。\n' });
      return;
    }

    if (auth.authState === 'creating') {
      const response = router.handle(raw, socket.id);
      socket.emit('output', { text: response });
      const p = players.getPlayer(socket.id);
      if (p && p.state === 'playing') {
        socketAuth.set(socket.id, { authState: 'playing', username: auth.username });
        p.id = auth.username!;
        persistence.saveAll(players.getAllPlayers());
      }
      return;
    }

    const response = router.handle(raw, socket.id);
    socket.emit('output', { text: response });
    const p = players.getPlayer(socket.id);
    if (p && p.state === 'playing') {
      persistence.saveAll(players.getAllPlayers());
    }

    // Auto-combat tick: start/stop based on fighting state
    manageCombatTick(socket);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    clearCombatTick(socket.id);
    socketAuth.delete(socket.id);
  });
});

function clearCombatTick(socketId: string) {
  const taskId = combatTickTasks.get(socketId);
  if (taskId) {
    scheduler.cancel(taskId);
    combatTickTasks.delete(socketId);
  }
}

function manageCombatTick(socket: any) {
  const p = players.getPlayer(socket.id);
  if (p && p.state === 'fighting') {
    if (!combatTickTasks.has(socket.id)) {
      const taskId = `combat:${socket.id}`;
      combatTickTasks.set(socket.id, taskId);
      scheduler.schedule(taskId, router.getCombatSpeed(socket.id), () => {
        const roundResult = router.executeCombatRound(socket.id);
        if (roundResult) socket.emit('output', { text: roundResult });
        const updated = players.getPlayer(socket.id);
        if (!updated || updated.state !== 'fighting') {
          clearCombatTick(socket.id);
          if (updated && updated.state === 'playing') {
            persistence.saveAll(players.getAllPlayers());
          }
        }
      }, router.getCombatSpeed(socket.id));
    }
  } else {
    clearCombatTick(socket.id);
  }
}

tryPort(BASE_PORT).then((PORT) => {
  httpServer.listen(PORT, () => {
    console.log(`[server] Wuxia MUD running on http://localhost:${PORT}`);
  });
});
