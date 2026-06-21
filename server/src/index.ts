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
import { PersistenceSystem } from './systems/PersistenceSystem.js';
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

app.get('/health', (_req, res) => {
    const online = players.getAllPlayers();
    res.json({ status: 'ok', uptime: process.uptime().toFixed(0), online: online.length, players: online.map(p => p.name) });
});

// Wire up game systems
const players = new PlayerManager();
const map = new MapSystem();
const combat = new CombatSystem();
const skills = new SkillSystem();
const items = new ItemSystem();
const npcs = new NpcSystem(skills);
const schools = new SchoolSystem();
const persistence = new PersistenceSystem();

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

// Register NPCs in the world
npcs.register({
  id: 'wang', name: '王掌柜', description: '客栈掌柜，戴着圆框眼镜，正在拨弄算盘。',
  roomId: 'town/inn',
  dialogue: ['客官要住店吗？', '江湖险恶，多带些金疮药吧。', '最近镇外来了一伙山贼，不太平啊。'],
  attributes: { str: 5, int: 10, con: 8, dex: 5 },
  skills: [],
  aggressive: false,
});
npcs.register({
  id: 'bandit', name: '山贼', description: '一个面目凶狠的山贼，手持短刀。',
  roomId: 'wilderness/forest1',
  dialogue: ['此路是我开！', '哈哈哈，留下买路钱！'],
  attributes: { str: 12, int: 5, con: 10, dex: 8 },
  skills: [{ skillId: 'luohan-quan', level: 3 }],
  aggressive: true,
  });

  // Register school master NPCs
  npcs.register({
    id: "master-shaolin", name: "玄慈方丈", description: "少林寺方丈，慈眉善目，佛法精深。",
    roomId: "shaolin/hall",
    dialogue: ["阿弥陀佛，施主可是来拜师的？", "习武先修心，持戒方能成器。"],
    attributes: { str: 10, int: 15, con: 10, dex: 10 },
    skills: [{ skillId: "luohan-quan", level: 50 }],
    aggressive: false,
  });
  npcs.register({
    id: "master-wudang", name: "冲虚道长", description: "武当掌门，仙风道骨，深不可测。",
    roomId: "wudang/hall",
    dialogue: ["无量天尊。", "太极之道，以柔克刚。"],
    attributes: { str: 10, int: 15, con: 10, dex: 15 },
    skills: [{ skillId: "taiji-quan", level: 50 }],
    aggressive: false,
});
  // Register new school master NPCs (Phase 4 expansion)
  npcs.register({
    id: "master-gaibang", name: "洪七公", description: "丐帮帮主，北丐之首，武功盖世。",
    roomId: "gaibang/hq",
    dialogue: ["小兄弟可想加入我丐帮？", "打狗棒法乃我丐帮镇帮之宝。"],
    attributes: { str: 15, int: 10, con: 12, dex: 12 },
    skills: [{ skillId: "dagou-bang", level: 50 }, { skillId: "xianglong-zhang", level: 50 }],
    aggressive: false,
  });
  npcs.register({
    id: "master-huashan", name: "岳不群", description: "华山派掌门，君子剑的名号响彻江湖。",
    roomId: "huashan/peak",
    dialogue: ["华山派欢迎有志之士。", "剑法之道，贵在精纯。"],
    attributes: { str: 12, int: 12, con: 10, dex: 14 },
    skills: [{ skillId: "huashan-jian", level: 50 }, { skillId: "dugu-jiujian", level: 40 }],
    aggressive: false,
  });
  npcs.register({
    id: "master-emei", name: "灭绝师太", description: "峨眉派掌门，性子刚烈，武功极高。",
    roomId: "emei/golden",
    dialogue: ["哼！", "峨眉剑法虽柔，亦可杀敌。"],
    attributes: { str: 12, int: 12, con: 10, dex: 14 },
    skills: [{ skillId: "emei-jian", level: 50 }],
    aggressive: false,
  });
  npcs.register({
    id: "master-gumu", name: "小龙女", description: "古墓派传人，美貌绝伦，武功深不可测。",
    roomId: "gumu/chamber",
    dialogue: ["古墓派不收外人……不过既然来了。", "玉女心经须两人合修。"],
    attributes: { str: 10, int: 12, con: 10, dex: 16 },
    skills: [{ skillId: "yunu-xinjing", level: 50 }, { skillId: "anran-xiaohun", level: 50 }],
    aggressive: false,
  });
  

const router = new CommandRouter(players, map, combat, skills, items, npcs, schools);

// Track auth state per socket
const socketAuth = new Map<string, { authState: string; username?: string }>();

// Auto-combat tick intervals per socket
const combatTicks = new Map<string, ReturnType<typeof setInterval>>();

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
        const hash = Buffer.from(username + ':' + password).toString('base64');
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
        const inputHash = Buffer.from(username + ':' + password).toString('base64');
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
    manageRegen(socket);
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    clearCombatTick(socket.id);
    socketAuth.delete(socket.id);
  });
});

function clearCombatTick(socketId: string) {
  const tick = combatTicks.get(socketId);
  if (tick) { clearInterval(tick); combatTicks.delete(socketId); }
}

function manageCombatTick(socket: any) {
  const p = players.getPlayer(socket.id);
  if (p && p.state === 'fighting') {
    if (!combatTicks.has(socket.id)) {
      const tick = setInterval(() => {
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
      combatTicks.set(socket.id, tick);
    }
  } else {
    clearCombatTick(socket.id);
  }
}

// HP/MP regen when not fighting
const regenTicks = new Map<string, ReturnType<typeof setInterval>>();
function manageRegen(socket: any) {
  const p = players.getPlayer(socket.id);
  if (p && p.state !== 'fighting') {
    if (!regenTicks.has(socket.id)) {
      const tick = setInterval(() => {
        const p2 = players.getPlayer(socket.id);
        if (p2 && p2.state !== 'fighting' && p2.state !== 'creating') {
          p2.hp = Math.min(p2.maxHp, p2.hp + Math.ceil(p2.maxHp * 0.03));
          p2.mp = Math.min(p2.maxMp, p2.mp + Math.ceil(p2.maxMp * 0.04));
        }
      }, 3000);
      regenTicks.set(socket.id, tick);
    }
  } else {
    const t = regenTicks.get(socket.id);
    if (t) { clearInterval(t); regenTicks.delete(socket.id); }
  }
}

tryPort(BASE_PORT).then((PORT) => {
  httpServer.listen(PORT, () => {
    console.log(`[server] Wuxia MUD running on http://localhost:${PORT}`);
  });
});
