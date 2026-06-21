import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

const files: Record<string, string> = {};

vi.mock('node:fs', () => ({
  default: {
    existsSync: (p: string) => Object.prototype.hasOwnProperty.call(files, p),
    mkdirSync: () => {},
    writeFileSync: (p: string, data: string) => { files[p] = String(data); },
    readFileSync: (p: string) => {
      if (!Object.prototype.hasOwnProperty.call(files, p)) {
        const err = new Error(`ENOENT: ${p}`) as any;
        err.code = 'ENOENT';
        throw err;
      }
      return files[p];
    },
  },
}));

// Import after mocking.
const { PersistenceSystem } = await import('./PersistenceSystem.js');

describe('PersistenceSystem', () => {
  beforeEach(() => {
    for (const key of Object.keys(files)) delete files[key];
  });

  it('returns empty players when file does not exist', () => {
    const ps = new PersistenceSystem();
    expect(ps.loadAll()).toEqual([]);
  });

  it('saves and loads players', () => {
    const ps = new PersistenceSystem();
    const p = createPlayer('u1', '楚留香', DEFAULT_ATTRIBUTES);
    ps.saveAll([p]);
    const loaded = ps.loadAll();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].name).toBe('楚留香');
    expect(loaded[0].version).toBe(1);
  });

  it('migrates a legacy v0 player', () => {
    const ps = new PersistenceSystem();
    const legacy: any = {
      id: 'legacy',
      name: '老玩家',
      attributes: { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 },
      hp: 100,
      mp: 100,
      state: 'fighting',
      targetEnemy: 'npc:foo',
      combatTargets: ['npc:foo'],
      isMeditating: true,
      meditationTaskId: 123,
      powerupExpiry: 999999,
      comboCount: 3,
      comboSkill: 'cuff',
    };
    ps.saveAll([legacy]);
    const [loaded] = ps.loadAll();
    expect(loaded.version).toBe(1);
    expect(loaded.state).toBe('playing');
    expect(loaded.targetEnemy).toBeNull();
    expect(loaded.combatTargets).toEqual([]);
    expect(loaded.isMeditating).toBe(false);
    expect(loaded.meditationTaskId).toBeUndefined();
    expect(loaded.powerupExpiry).toBeUndefined();
    expect(loaded.comboCount).toBe(0);
    expect(loaded.comboSkill).toBeUndefined();
    expect(loaded.inventory).toEqual([]);
    expect(loaded.equipped).toEqual([]);
    expect(loaded.conditions).toEqual([]);
    expect(loaded.skills).toEqual([]);
    expect(loaded.bankSilver).toBe(0);
    expect(loaded.bankInventory).toEqual([]);
    expect(loaded.shen).toBe(0);
    expect(loaded.kills).toEqual({ players: 0, npcs: 0 });
    expect(loaded.level).toBe(1);
  });

  it('saves and loads user password hashes', () => {
    const ps = new PersistenceSystem();
    ps.saveUser('alice', 'hashed-secret');
    expect(ps.getUserHash('alice')).toBe('hashed-secret');
    expect(ps.getUserHash('bob')).toBeNull();
  });

  it('returns null for missing user hash when users file does not exist', () => {
    const ps = new PersistenceSystem();
    expect(ps.getUserHash('anyone')).toBeNull();
  });
});
