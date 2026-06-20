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
const router = new CommandRouter(players, map, combat);

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
