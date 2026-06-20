import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CommandRouter } from './engine/CommandRouter.js';
import { PlayerManager } from './systems/PlayerManager.js';
import { MapSystem } from './systems/MapSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { SkillSystem } from './systems/SkillSystem.js';
import { ItemSystem } from './systems/ItemSystem.js';
import { NpcSystem } from './systems/NpcSystem.js';
import { SchoolSystem } from './systems/SchoolSystem.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env['PORT'] || '3000', 10);

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
  res.json({ status: 'ok' });
});

// Wire up game systems
const players = new PlayerManager();
const map = new MapSystem();
const combat = new CombatSystem();
const skills = new SkillSystem();
const items = new ItemSystem();
const npcs = new NpcSystem(skills);
  const schools = new SchoolSystem();

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

const router = new CommandRouter(players, map, combat, skills, items, npcs, schools);

io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  // Create a new player session
  players.createPlayer(socket.id);

  // Greet with character creation prompt
  socket.emit('output', { text: router.handle('', socket.id) });

  socket.on('command', (data: { input: string }) => {
    const raw = (data.input || '').trim();
    console.log(`[cmd] ${socket.id}: ${raw}`);

    const response = router.handle(raw, socket.id);
    socket.emit('output', { text: response });
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
    players.removePlayer(socket.id);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] Wuxia MUD running on http://localhost:${PORT}`);
});
