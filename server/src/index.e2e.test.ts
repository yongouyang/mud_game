import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { createServer, Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioc, Socket as ClientSocket } from 'socket.io-client';
import { handleCommand } from './engine/CommandRouter.js';
import { AddressInfo } from 'node:net';

let httpServer: HttpServer;
let port: number;
let clientSocket: ClientSocket;

beforeAll(async () => {
  const app = express();
  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  httpServer = createServer(app);
  const io = new SocketIOServer(httpServer);

  io.on('connection', (socket) => {
    socket.on('command', (data: { input: string }) => {
      const raw = (data.input || '').trim();
      if (!raw) {
        socket.emit('output', { text: '' });
        return;
      }
      const response = handleCommand(raw, socket.id);
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

describe('E2E: WebSocket command flow', () => {
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

  it('connects successfully', () => {
    expect(clientSocket.connected).toBe(true);
  });

  it('receives room description on look', async () => {
    const text = await sendCmd('look');
    expect(text).toContain('炎黄群侠传');
    expect(text).toContain('练武场');
  });

  it('receives status on hp', async () => {
    const text = await sendCmd('hp');
    expect(text).toContain('气血');
    expect(text).toContain('内力');
  });

  it('returns clear token for clear', async () => {
    const text = await sendCmd('clear');
    expect(text).toBe('__CLEAR__');
  });

  it('handles unknown command', async () => {
    const text = await sendCmd('flap');
    expect(text).toContain('什么');
  });

  it('handles multiple sequential commands', async () => {
    const r1 = await sendCmd('who');
    expect(r1).toContain('游客');

    const r2 = await sendCmd('help');
    expect(r2).toContain('look');

    const r3 = await sendCmd('look');
    expect(r3).toContain('练武场');
  });

  it('handles empty input', async () => {
    const text = await sendCmd('');
    expect(text).toBe('');
  });

  it('health endpoint returns ok', async () => {
    const res = await fetch(`http://localhost:${port}/health`);
    const body = await res.json();
    expect(body).toEqual({ status: 'ok' });
  });
});
