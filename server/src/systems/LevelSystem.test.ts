import { describe, it, expect, beforeEach } from 'vitest';
import { LevelSystem, deriveLevel } from './LevelSystem.js';
import { Player, createPlayer, PlayerAttributes } from '../models/Player.js';

describe('LevelSystem', () => {
  let system: LevelSystem;

  beforeEach(() => {
    system = new LevelSystem();
  });

  it('deriveLevel matches cube-root formula', () => {
    expect(deriveLevel(0)).toBe(1);
    expect(deriveLevel(100)).toBeGreaterThan(1);
  });

  it('checkLevelUp awards rewards when crossing thresholds', () => {
    const player = createPlayer('p1', '测试', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    const baseMaxHp = player.maxHp;
    player.exp = 5000; // enough for several levels
    const result = system.checkLevelUp(player);
    expect(result.leveledUp).toBe(true);
    expect(result.levelsGained).toBeGreaterThan(0);
    expect(player.level).toBe(result.newLevel);
    expect(player.attrPoints).toBeGreaterThan(0);
    expect(player.maxHp).toBeGreaterThan(baseMaxHp);
  });

  it('does not level up without enough exp', () => {
    const player = createPlayer('p1', '测试', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    player.exp = 0;
    const result = system.checkLevelUp(player);
    expect(result.leveledUp).toBe(false);
    expect(player.attrPoints).toBe(0);
  });

  it('spends attribute points', () => {
    const player = createPlayer('p1', '测试', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    player.attrPoints = 5;
    const err = system.spendAttributePoint(player, 'str', 2);
    expect(err).toBeNull();
    expect(player.attributes.str).toBe(12);
    expect(player.attrPoints).toBe(3);
  });

  it('spends attribute points by Chinese name', () => {
    const player = createPlayer('p1', '测试', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    player.attrPoints = 2;
    const err = system.spendAttributePoint(player, '臂力' as keyof PlayerAttributes, 1);
    expect(err).toBeNull();
    expect(player.attributes.str).toBe(11);
  });

  it('rejects spending without enough points', () => {
    const player = createPlayer('p1', '测试', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    player.attrPoints = 0;
    const err = system.spendAttributePoint(player, 'str', 1);
    expect(err).toContain('属性点不足');
  });

  it('rejects invalid attribute', () => {
    const player = createPlayer('p1', '测试', { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    player.attrPoints = 5;
    const err = system.spendAttributePoint(player, 'foo' as keyof PlayerAttributes, 1);
    expect(err).toContain('没有');
  });

  it('formatLevelInfo labels base attributes without skill/equipment bonuses', () => {
    const player = createPlayer('p1', '测试', { str: 12, int: 10, con: 10, dex: 10, per: 10, kar: 10 });
    const info = system.formatLevelInfo(player);
    expect(info).toContain('基础属性（不含武功/装备加成）：');
    expect(info).toContain('臂力(str): 12');
    expect(info).not.toContain('（含武功/装备加成）');
  });
});
