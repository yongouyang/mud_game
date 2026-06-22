import { describe, it, expect, beforeEach } from 'vitest';
import { PlayerManager } from './PlayerManager.js';
import { TestSystemClock } from '../time/SystemClock.js';
import { Player, DEFAULT_ATTRIBUTES } from '../models/Player.js';

describe('PlayerManager', () => {
  let clock: TestSystemClock;
  let manager: PlayerManager;

  beforeEach(() => {
    clock = new TestSystemClock(0);
    manager = new PlayerManager(clock);
  });

  it('tracks dirty state', () => {
    expect(manager.hasDirty()).toBe(false);
    manager.createPlayer('p1');
    expect(manager.hasDirty()).toBe(true);
    manager.clearDirty();
    expect(manager.hasDirty()).toBe(false);
  });

  it('creates and finalizes a player', () => {
    manager.createPlayer('p1');
    expect(manager.getPlayer('p1')?.state).toBe('creating');

    const err = manager.setPlayerName('p1', '楚留香');
    expect(err).toBeNull();
    expect(manager.hasDirty()).toBe(true);

    manager.clearDirty();
    const finalizeErr = manager.finalizePlayer('p1');
    expect(finalizeErr).toBeNull();
    expect(manager.getPlayer('p1')?.state).toBe('playing');
    expect(manager.getPlayer('p1')?.hp).toBeGreaterThan(0);
    expect(manager.hasDirty()).toBe(true);
  });

  it('validates player name', () => {
    manager.createPlayer('p1');
    expect(manager.setPlayerName('p1', 'a')).toContain('2-6');
    expect(manager.setPlayerName('p1', '楚留香')).toBeNull();
  });

  it('formats creating prompt', () => {
    const p = { state: 'creating', name: '', attributes: { ...DEFAULT_ATTRIBUTES }, id: 'p1' } as unknown as Player;
    manager.setPlayer(p);
    expect(manager.formatCreatingPrompt(p)).toContain('请输入你的名字');
    p.name = '楚留香';
    expect(manager.formatCreatingPrompt(p)).toContain('分配属性点数');
  });

  it('formatStatus shows creating message', () => {
    const p = { state: 'creating', name: '', attributes: { ...DEFAULT_ATTRIBUTES }, id: 'p1' } as unknown as Player;
    expect(manager.formatStatus(p)).toContain('尚未完成角色创建');
  });

  it('formatStatus includes powerup, meditation and conditions', () => {
    manager.createPlayer('p1');
    manager.setPlayerName('p1', '楚留香');
    manager.finalizePlayer('p1');
    const player = manager.getPlayer('p1')!;
    player.powerupExpiry = clock.now() + 5000;
    player.isMeditating = true;
    player.conditions = [{ id: 'poison', name: '中毒', level: 2, remain: 5, appliedAt: 0 }];

    const status = manager.formatStatus(player);
    expect(status).toContain('战力提升');
    expect(status).toContain('正在打坐');
    expect(status).toContain('中毒');
  });

  it('shenTitle covers all alignment ranges', () => {
    // Access via casting to any for the private method.
    const title = (manager as any).shenTitle.bind(manager);
    expect(title(2000)).toBe('一代大侠');
    expect(title(700)).toBe('侠义之士');
    expect(title(200)).toBe('正道人士');
    expect(title(0)).toBe('亦正亦邪');
    expect(title(-200)).toBe('邪道人士');
    expect(title(-700)).toBe('恶名昭彰');
    expect(title(-2000)).toBe('武林公敌');
  });
});
