import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PersistenceManager, AUTOSAVE_INTERVAL_MS } from './PersistenceManager.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { PersistenceSystem } from '../systems/PersistenceSystem.js';
import { TestSystemClock } from '../time/SystemClock.js';
import { Scheduler } from '../time/Scheduler.js';
import { createPlayer } from '../models/Player.js';

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

function cleanup() {
  if (fs.existsSync(PLAYERS_FILE)) fs.unlinkSync(PLAYERS_FILE);
}

describe('PersistenceManager', () => {
  let clock: TestSystemClock;
  let scheduler: Scheduler;
  let players: PlayerManager;
  let persistence: PersistenceSystem;
  let manager: PersistenceManager;

  beforeEach(() => {
    cleanup();
    clock = new TestSystemClock(0);
    scheduler = new Scheduler(clock);
    players = new PlayerManager(clock);
    persistence = new PersistenceSystem();
    manager = new PersistenceManager(players, persistence, scheduler, clock);
  });

  afterEach(() => {
    cleanup();
  });

  it('loads saved players into the PlayerManager', () => {
    const p = createPlayer('u1', '楚留香', { str: 12, int: 10, con: 10, dex: 8, per: 10, kar: 10 });
    persistence.saveAll([p]);
    players.removePlayer('u1'); // ensure fresh

    manager.loadAll();
    const loaded = players.getPlayer('u1');
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('楚留香');
  });

  it('saves online players', () => {
    const p = createPlayer('u1', '楚留香', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    p.hp = 123;
    players.setPlayer(p);

    manager.saveAll();
    const saved = persistence.loadAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].hp).toBe(123);
  });

  it('autosaves on schedule', () => {
    const p = createPlayer('u1', '楚留香', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    players.setPlayer(p);
    manager.startAutosave();

    p.hp = 99;
    clock.advance(AUTOSAVE_INTERVAL_MS);
    scheduler.tick();

    const saved = persistence.loadAll();
    expect(saved[0].hp).toBe(99);
  });

  it('re-keys and removes the transient socket mapping on disconnect', () => {
    const p = createPlayer('socket-42', '楚留香', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    p.hp = 77;
    players.setPlayer(p);

    manager.onDisconnect('socket-42', 'u1');

    // Socket key removed.
    expect(players.getPlayer('socket-42')).toBeUndefined();
    // Username key retained.
    const retained = players.getPlayer('u1');
    expect(retained).toBeDefined();
    expect(retained?.id).toBe('u1');
    expect(retained?.hp).toBe(77);

    const saved = persistence.loadAll();
    expect(saved).toHaveLength(1);
    expect(saved[0].id).toBe('u1');
  });
});
