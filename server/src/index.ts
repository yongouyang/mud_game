import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { handleCommand } from './engine/CommandRouter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env['PORT'] || '3000', 10);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

// In production (after `npm run build`), serve the Vite-built React app.
// In dev, Vite's own dev server proxies /socket.io to us.
const distDir = path.resolve(__dirname, '..', '..', 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  console.log(`[server] Serving production build from ${distDir}`);
} else {
  console.log('[server] No dist/ found — running in dev mode (Vite proxies requests)');
}

// Health check for ALB
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`[connect] ${socket.id}`);

  socket.on('command', (data: { input: string }) => {
    const raw = (data.input || '').trim();
    console.log(`[cmd] ${socket.id}: ${raw}`);

    // Simple command routing for Phase 1
    if (!raw) {
      socket.emit('output', { text: '' });
      return;
    }

    const response = handleCommand(raw, socket.id);
    socket.emit('output', { text: response });
  });

  socket.on('disconnect', () => {
    console.log(`[disconnect] ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[server] Wuxia MUD running on http://localhost:${PORT}`);
});
