import express from 'express';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env['PORT'] || '3000', 10);

const app = express();
const httpServer = createServer(app);
const io = new SocketIOServer(httpServer);

// Serve static client files from ../../client
const clientDir = path.resolve(__dirname, '..', '..', 'client');
app.use(express.static(clientDir));

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

// Phase 1 command handler — basic echo and info commands
function handleCommand(input: string, _playerId: string): string {
  const [cmd, ...args] = input.split(/\s+/);
  const arg = args.join(' ');

  switch (cmd?.toLowerCase()) {
    case 'look':
    case 'l':
      return '\n  ☆ 炎黄群侠传 ☆\n\n  你站在一片空旷的练武场中。\n  地面铺着青石板，四周立着木人桩。\n  北边通向山门，南边是无名小镇。\n\n  这里没有任何明显的出口方向。\n';

    case 'hp':
      return '\n  ╔══════════════════╗\n  ║    状态信息      ║\n  ╠══════════════════╣\n  ║ 气血  ██████████ ║\n  ║ 内力  ████████   ║\n  ║ 精力  █████████  ║\n  ╚══════════════════╝\n';

    case 'who':
      return '\n  当前在线玩家：\n  ─────────────────\n  你（游客）\n';

    case 'help':
      return '\n  ╔═══════════════════════╗\n  ║  可用命令 (Phase 1)    ║\n  ╠═══════════════════════╣\n  ║  look    查看四周      ║\n  ║  hp      查看状态      ║\n  ║  who     在线玩家      ║\n  ║  help    显示帮助      ║\n  ║  clear   清屏         ║\n  ╚═══════════════════════╝\n';

    case 'clear':
      return '__CLEAR__';

    default:
      return `\n  什么？"${input}"——你自言自语道。\n  （输入 help 查看可用命令）\n`;
  }
}

httpServer.listen(PORT, () => {
  console.log(`[server] Wuxia MUD running on http://localhost:${PORT}`);
});
