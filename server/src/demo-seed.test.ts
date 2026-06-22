import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { seedDemoAccounts, DEMO_ACCOUNTS, shouldSeedDemoAccounts } from './demo-seed.js';
import { PersistenceSystem } from './systems/PersistenceSystem.js';
import { PlayerManager } from './systems/PlayerManager.js';
import { SchoolSystem } from './systems/SchoolSystem.js';
import { RealSystemClock } from './time/SystemClock.js';

const DATA_DIR = path.resolve(import.meta.dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');

function resetDataFiles() {
  if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
  if (fs.existsSync(PLAYERS_FILE)) fs.unlinkSync(PLAYERS_FILE);
}

describe('demo-seed', () => {
  let persistence: PersistenceSystem;
  let players: PlayerManager;
  let schools: SchoolSystem;
  const clock = new RealSystemClock();

  beforeEach(() => {
    resetDataFiles();
    process.env['NODE_ENV'] = 'test';
    persistence = new PersistenceSystem();
    players = new PlayerManager(clock);
    schools = new SchoolSystem();
  });

  afterEach(() => {
    resetDataFiles();
    delete process.env['NODE_ENV'];
    delete process.env['ENABLE_DEMO_ACCOUNTS'];
  });

  it('creates all demo accounts on first seed', () => {
    const result = seedDemoAccounts(persistence, players, schools);
    expect(result.created).toEqual(DEMO_ACCOUNTS.map((d) => d.username));
    expect(result.skipped).toEqual([]);

    for (const demo of DEMO_ACCOUNTS) {
      const player = players.getPlayer(demo.username);
      expect(player).toBeDefined();
      expect(player!.name).toBe(demo.name);
      expect(player!.currentRoom).toBe(demo.roomId);
      expect(player!.pot).toBe(demo.pot);
      expect(player!.isAdmin).toBe(true);
      if (demo.silver > 0) {
        const silver = player!.inventory.find((i) => i.itemId === 'silver');
        expect(silver?.quantity).toBe(demo.silver);
      }
      if (demo.schoolId) {
        expect(player!.schoolId).toBe(demo.schoolId);
        expect(player!.schoolName).toBe(schools.getSchool(demo.schoolId)!.name);
      }
    }
  });

  it('skips existing demo accounts', () => {
    seedDemoAccounts(persistence, players, schools);
    const result = seedDemoAccounts(persistence, players, schools);
    expect(result.created).toEqual([]);
    expect(result.skipped).toEqual(DEMO_ACCOUNTS.map((d) => d.username));
  });

  it('applies school attribute bonus', () => {
    seedDemoAccounts(persistence, players, schools);
    const shaolin = players.getPlayer('shaolin')!;
    // base con 15 + shaolin bonus +3 = 18
    expect(shaolin.attributes.con).toBe(18);
  });

  it('respects production guard', () => {
    const originalNodeEnv = process.env['NODE_ENV'];
    process.env['NODE_ENV'] = 'production';
    try {
      expect(shouldSeedDemoAccounts()).toBe(false);
      const result = seedDemoAccounts(persistence, players, schools);
      expect(result.created).toEqual([]);
      expect(players.getAllPlayers()).toEqual([]);

      process.env['ENABLE_DEMO_ACCOUNTS'] = 'true';
      expect(shouldSeedDemoAccounts()).toBe(true);
      const result2 = seedDemoAccounts(persistence, players, schools);
      expect(result2.created.length).toBeGreaterThan(0);
    } finally {
      process.env['NODE_ENV'] = originalNodeEnv;
      delete process.env['ENABLE_DEMO_ACCOUNTS'];
    }
  });
});
