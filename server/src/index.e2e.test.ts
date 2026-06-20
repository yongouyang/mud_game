import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { CommandRouter } from './engine/CommandRouter.js';
import { PlayerManager } from './systems/PlayerManager.js';
import { MapSystem } from './systems/MapSystem.js';
import { CombatSystem } from './systems/CombatSystem.js';
import { AddressInfo } from 'node:net';

let httpServer: HttpServer;
let port: number;
let clientSocket: ClientSocket;
let players: PlayerManager;

beforeAll(async () => {
  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  httpServer = createServer(app);
  const io = new SocketIOServer(httpServer);

  players = new PlayerManager();
  const map = new MapSystem();
  const combat = new CombatSystem();
  const router = new CommandRouter(players, map, combat);

  io.on('connection', (socket) => {
    players.createPlayer(socket.id);
    socket.emit('output', { text: router.handle('', socket.id) });

    socket.on('command', (data: { input: string }) => {
      const raw = (data.input || '').trim();
      const response = router.handle(raw, socket.id);
      socket.emit('output', { text: response });
    });
  });

  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      const addr = httpServer.address() as AddressInfo;
      port = addr.port;
      resolve();
    });
  });
}, 15000);

afterAll(() => {
  clientSocket?.disconnect();
  httpServer?.close();
});

describe('E2E: WebSocket command flow (Phase 2)', () => {
  beforeAll(async () => {
    clientSocket = ioc(`http://localhost:${port}`);

    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Connection timeout')), 5000);
      clientSocket.on('connect', () => {
        clearTimeout(timeout);
        resolve();
      });
      clientSocket.on('connect_error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }, 15000);

  function sendCmd(input: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`Command timeout: ${input}`)), 3000);
      clientSocket.once('output', (data: { text: string }) => {
        clearTimeout(timeout);
        resolve(data.text);
      });
      clientSocket.emit('command', { input });
    });
  }

  it('connects and receives character creation prompt', async () => {
    expect(clientSocket.connected).toBe(true);
    // First message is the creation prompt
    const text = await sendCmd('');
    expect(text).toContain('欢迎来到炎黄群侠传');
  });

  it('creates a character and enters the world', async () => {
    await sendCmd('楚留香');
    const text = await sendCmd('done');
    expect(text).toContain('角色创建成功');
    expect(text).toContain('无名小镇');
  });

  it('can move around', async () => {
    const text = await sendCmd('n');
    expect(text).toContain('主街');
  });

  it('can look at the new room', async () => {
    const text = await sendCmd('look');
    expect(text).toContain('主街');
  });

  it('can go back south', async () => {
    const text = await sendCmd('s');
    expect(text).toContain('广场');
  });

  it('health endpoint returns ok', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
