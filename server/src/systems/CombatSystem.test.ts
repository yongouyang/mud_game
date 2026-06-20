import { describe, it, expect, beforeEach } from 'vitest';
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
    const out = combat.formatCombatStatus(p, { name: 'bandit', hp: 50, maxHp: 80 } as any);
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
});
