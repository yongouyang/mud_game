import { describe, it, expect, vi } from 'vitest';
import { ConditionSystem } from './ConditionSystem.js';
import { Player, createPlayer } from '../models/Player.js';
import { TestSystemClock } from '../time/SystemClock.js';

describe('ConditionSystem', () => {
  let clock: TestSystemClock;
  let system: ConditionSystem;
  let player: Player;

  beforeEach(() => {
    clock = new TestSystemClock(0);
    system = new ConditionSystem(clock);
    player = createPlayer('p1', '测试', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
  });

  it('applies poison and tracks level/remain', () => {
    const msg = system.applyCondition(player, 'poison', 2, '山贼');
    expect(msg).toContain('中毒');
    expect(player.conditions).toHaveLength(1);
    expect(player.conditions[0].level).toBe(2);
    expect(player.conditions[0].name).toBe('中毒');
    expect(system.hasCondition(player, 'poison')).toBe(true);
  });

  it('merges condition level when re-applied', () => {
    system.applyCondition(player, 'poison', 2);
    system.applyCondition(player, 'poison', 3);
    expect(player.conditions[0].level).toBe(3);
  });

  it('ticks poison damage and decays over time', () => {
    system.applyCondition(player, 'poison', 2);
    const beforeHp = player.hp;
    const result = system.tick(player, 0);
    expect(result.damageHp).toBeGreaterThan(0);
    expect(player.hp).toBeLessThan(beforeHp);
    expect(result.messages.length).toBeGreaterThan(0);
  });

  it('force level reduces poison damage', () => {
    system.applyCondition(player, 'poison', 2);
    const resultLow = system.tick(player, 0);
    const player2 = createPlayer('p2', '测试2', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    system.applyCondition(player2, 'poison', 2);
    const resultHigh = system.tick(player2, 100);
    expect(resultHigh.damageHp).toBeLessThan(resultLow.damageHp);
  });

  it('cures poison by item', () => {
    system.applyCondition(player, 'poison', 2);
    const msg = system.cureByItem(player, 'poison');
    expect(msg).toContain('清除');
    expect(system.hasCondition(player, 'poison')).toBe(false);
  });

  it('dispels poison with force skill', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0); // force success
    system.applyCondition(player, 'poison', 2);
    player.mp = 100;
    const msg = system.dispelCondition(player, 'poison', 100);
    expect(msg).toContain('驱散');
    expect(system.hasCondition(player, 'poison')).toBe(false);
  });

  it('dispel fails without enough mp', () => {
    system.applyCondition(player, 'poison', 10);
    player.mp = 5;
    const msg = system.dispelCondition(player, 'poison', 100);
    expect(msg).toContain('内力不足');
  });

  it('condition expires after enough ticks', () => {
    system.applyCondition(player, 'poison', 1);
    for (let i = 0; i < 20; i++) {
      system.tick(player, 0);
    }
    expect(system.hasCondition(player, 'poison')).toBe(false);
  });
});
