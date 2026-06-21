import { describe, it, expect, beforeEach } from 'vitest';
import { SkillSystem } from './SkillSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

function makePlayer(name: string): Player {
  return createPlayer('test', name, DEFAULT_ATTRIBUTES);
}

describe('SkillSystem', () => {
  let sys: SkillSystem;

  beforeEach(() => {
    sys = new SkillSystem();
  });

  it('finds skill definitions by id', () => {
    expect(sys.getDef('cuff')?.name).toBe('基本拳脚');
    expect(sys.getDef('taiji-quan')?.name).toBe('太极拳');
    expect(sys.getDef('nonexistent')).toBeUndefined();
  });

  it('finds skill definitions by Chinese name', () => {
    expect(sys.findDefByName('太极拳')?.id).toBe('taiji-quan');
    expect(sys.findDefByName('基本内功')?.id).toBe('force');
    expect(sys.findDefByName('不存在')).toBeUndefined();
  });

  it('learns a new skill at level 1', () => {
    const p = makePlayer('test');
    sys.learnSkill(p, 'cuff');
    expect(sys.getSkillLevel(p, 'cuff')).toBe(1);
    expect(p.skills).toHaveLength(1);
  });

  it('levels up existing skill', () => {
    const p = makePlayer('test');
    sys.learnSkill(p, 'cuff');
    sys.learnSkill(p, 'cuff');
    expect(sys.getSkillLevel(p, 'cuff')).toBe(2);
    expect(p.skills).toHaveLength(1);
  });

  it('caps skill level at 100', () => {
    const p = makePlayer('test');
    for (let i = 0; i < 150; i++) sys.learnSkill(p, 'cuff');
    expect(sys.getSkillLevel(p, 'cuff')).toBe(100);
  });

  it('returns error for unknown skill', () => {
    const p = makePlayer('test');
    expect(sys.learnSkill(p, 'unknown')).toBe('没有"unknown"这个武功。');
  });

  it('gets best strike skill', () => {
    const p = makePlayer('test');
    for (let i = 0; i < 10; i++) sys.learnSkill(p, 'cuff');
    sys.learnSkill(p, 'taiji-quan');
    const best = sys.getBestStrike(p);
    expect(best).not.toBeNull();
    expect(best!.damage).toBeGreaterThan(5);
  });

  it('gets dodge level from best dodge skill', () => {
    const p = makePlayer('test');
    sys.learnSkill(p, 'dodge');
    sys.learnSkill(p, 'dodge');
    sys.learnSkill(p, 'qinggong');
    expect(sys.getDodgeLevel(p)).toBe(2);
  });

  it('formats empty skills', () => {
    const p = makePlayer('test');
    expect(sys.formatSkills(p)).toContain('尚未学习任何武功');
  });

  it('formats learned skills', () => {
    const p = makePlayer('test');
    sys.learnSkill(p, 'cuff');
    sys.learnSkill(p, 'dodge');
    const out = sys.formatSkills(p);
    expect(out).toContain('基本拳脚');
    expect(out).toContain('基本轻功');
  });

  it('rejects skill with unmet prerequisite', () => {
    const p = makePlayer('test');
    const err = sys.learnSkill(p, 'taiji-quan');
    expect(err).toContain('需要基本拳脚');
    expect(sys.getSkillLevel(p, 'taiji-quan')).toBe(0);
  });

  it('allows skill when prerequisite met', () => {
    const p = makePlayer('test');
    for (let i = 0; i < 10; i++) sys.learnSkill(p, 'cuff');
    expect(sys.learnSkill(p, 'taiji-quan')).toBeNull();
    expect(sys.getSkillLevel(p, 'taiji-quan')).toBe(1);
  });

  it('gets parry level', () => {
    const p = makePlayer('test');
    sys.learnSkill(p, 'parry');
    expect(sys.getParryLevel(p)).toBe(1);
  });

  it('gets force level', () => {
    const p = makePlayer('test');
    sys.learnSkill(p, 'force');
    expect(sys.getForceLevel(p)).toBe(1);
  });

  it('zero parry/force/dodge with no skills', () => {
    const p = makePlayer('test');
    expect(sys.getParryLevel(p)).toBe(0);
    expect(sys.getForceLevel(p)).toBe(0);
    expect(sys.getDodgeLevel(p)).toBe(0);
  });
});
