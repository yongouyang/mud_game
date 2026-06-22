import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CombatSystem } from './CombatSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

function player(overrides?: Partial<Player>): Player {
  return { ...createPlayer('test', 'test', DEFAULT_ATTRIBUTES), ...overrides };
}

describe('CombatSystem', () => {
  let combat: CombatSystem;

  beforeEach(() => {
    combat = new CombatSystem();
  });

  it('attack deals damage to defender', () => {
    const a = player({ attributes: { str: 15, int: 10, con: 10, dex: 10 } });
    const d = player({ attributes: { str: 10, int: 10, con: 10, dex: 10 }, name: 'enemy' });
    const result = combat.attack(a, d);
    expect(result.defenderDead).toBe(false);
    expect(d.hp).toBeLessThan(d.maxHp);
    expect(result.message).toContain('伤害');
  });

  it('attack can kill defender', () => {
    const a = player({ attributes: { str: 15, int: 10, con: 10, dex: 10 } });
    const d = player({ hp: 1, maxHp: 100, attributes: { str: 5, int: 5, con: 5, dex: 1 }, name: 'enemy' });
    const result = combat.attack(a, d);
    expect(result.defenderDead).toBe(true);
    expect(result.message).toContain('倒下了');
  });

  it('formatCombatStatus works with minimal CombatTarget', () => {
    const p = player({ name: 'hero', hp: 80, maxHp: 100 });
    // Should work without needing full Player — just name, hp, maxHp
    const out = combat.formatCombatStatus(p, p.mp || 0, p.maxMp || 0, { name: 'bandit', hp: 50, maxHp: 80 });
    expect(out).toContain('hero');
    expect(out).toContain('bandit');
    expect(out).toContain('80/100');
    expect(out).toContain('50/80');
  });

  it('damage formula is consistent (no duplicate implementations)', () => {
    const a = player({ attributes: { str: 15, int: 10, con: 10, dex: 10 } });
    const d = player({ attributes: { str: 10, int: 10, con: 10, dex: 10 } });
    // Run 10 attacks and verify damage is within expected range
    for (let i = 0; i < 10; i++) {
      const defender = player({ ...d, hp: d.maxHp });
      combat.attack(a, defender);
      expect(defender.hp).toBeGreaterThanOrEqual(0);
      expect(defender.hp).toBeLessThan(defender.maxHp);
    }
  });

  it('executeRound reports when enemy kills player', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1); // no parry/dodge, no crit
    const p = player({ name: 'hero', hp: 1, maxHp: 100, mp: 0, maxMp: 100 });
    const enemy = {
      name: 'boss', hp: 100, maxHp: 100, mp: 0, maxMp: 100,
      attributes: { str: 50, dex: 10 },
      skills: { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: null },
    };
    const result = combat.executeRound(
      p,
      { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: null },
      enemy,
    );
    expect(result.attackerDead).toBe(true);
    expect(result.message).toContain('被击败了');
  });

  it('executeRound handles parry path', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const p = player({ name: 'hero', hp: 100, maxHp: 100, mp: 0, maxMp: 100 });
    const enemy = {
      name: 'bandit', hp: 100, maxHp: 100, mp: 0, maxMp: 100,
      attributes: { str: 10, dex: 10 },
      skills: { parryLv: 100, dodgeLv: 0, forceLv: 0, bestStrike: null },
    };
    const result = combat.executeRound(
      p,
      { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: { name: '拳', damage: 10 } },
      enemy,
    );
    expect(result.message).toContain('招架');
  });

  it('executeRound handles dodge path', () => {
    // First random decides parry (fail), second decides dodge (success).
    vi.spyOn(Math, 'random').mockReturnValueOnce(1).mockReturnValueOnce(0);
    const p = player({ name: 'hero', hp: 100, maxHp: 100, mp: 0, maxMp: 100 });
    const enemy = {
      name: 'bandit', hp: 100, maxHp: 100, mp: 0, maxMp: 100,
      attributes: { str: 10, dex: 10 },
      skills: { parryLv: 0, dodgeLv: 100, forceLv: 0, bestStrike: null },
    };
    const result = combat.executeRound(
      p,
      { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: { name: '拳', damage: 10 } },
      enemy,
    );
    expect(result.message).toContain('躲开了');
  });

  it('executeRound applies force absorption', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const p = player({ name: 'hero', hp: 100, maxHp: 100, mp: 100, maxMp: 100 });
    const enemy = {
      name: 'bandit', hp: 100, maxHp: 100, mp: 100, maxMp: 100,
      attributes: { str: 10, dex: 10 },
      skills: { parryLv: 0, dodgeLv: 0, forceLv: 10, bestStrike: null },
    };
    const result = combat.executeRound(
      p,
      { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: { name: '拳', damage: 30 } },
      enemy,
    );
    expect(result.message).toContain('内力吸收');
  });

  it('executeMultiRound reports player death from extra enemies', () => {
    vi.spyOn(Math, 'random').mockReturnValue(1);
    const p = player({ name: 'hero', hp: 30, maxHp: 100, mp: 0, maxMp: 100 });
    const primary = {
      name: 'leader', hp: 100, maxHp: 100, mp: 0, maxMp: 100,
      attributes: { str: 5, dex: 10 },
      skills: { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: null },
    };
    const extra = {
      name: 'minion', hp: 100, maxHp: 100, mp: 0, maxMp: 100,
      attributes: { str: 50, dex: 10 },
      skills: { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: null },
    };
    const result = combat.executeMultiRound(
      p,
      { parryLv: 0, dodgeLv: 0, forceLv: 0, bestStrike: null },
      primary,
      [extra],
    );
    expect(result.attackerDead).toBe(true);
  });
});

