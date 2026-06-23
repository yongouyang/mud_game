import { describe, it, expect, vi } from 'vitest';
import { createTestContext } from '../test-utils.js';
import { createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

const ID = 'edge-player';

function setup() {
  const ctx = createTestContext(0);
  ctx.players.createPlayer(ID);
  ctx.players.setPlayerName(ID, '边缘人');
  ctx.players.finalizePlayer(ID);
  const player = ctx.players.getPlayer(ID)!;
  // Grant a basic force skill so dazuo/practice work.
  player.skills.push({ skillId: 'force', level: 10 });
  return ctx;
}

describe('CommandRouter edge cases', () => {
  it('meditation ends after duration elapses', () => {
    const { router, players, clock, scheduler } = setup();
    const player = players.getPlayer(ID)!;
    player.hp = 200;
    player.mp = 10;

    const start = router.handle('dazuo 3', ID);
    expect(start).toContain('开始打坐');
    expect(player.isMeditating).toBe(true);

    clock.advance(4000);
    scheduler.tick();

    expect(player.isMeditating).toBe(false);
    expect(player.meditationTaskId).toBeUndefined();
  });

  it('meditation stops when combat starts', () => {
    const { router, players, scheduler, clock } = setup();
    const player = players.getPlayer(ID)!;
    router.handle('dazuo 100', ID);
    expect(player.isMeditating).toBe(true);

    player.state = 'fighting';
    clock.advance(1000);
    scheduler.tick();

    expect(player.isMeditating).toBe(false);
  });

  it('practice respects cooldown', () => {
    const { router, players } = setup();
    const player = players.getPlayer(ID)!;
    // Ensure a known basic skill exists and can be practiced.
    player.skills.push({ skillId: 'cuff', level: 1 });

    const first = router.handle('practice 基本拳脚', ID);
    expect(first).not.toContain('休息');

    const second = router.handle('practice 基本拳脚', ID);
    expect(second).toContain('休息');
  });

  it('practice rejects skills above level cap', () => {
    const { router, players } = setup();
    const player = players.getPlayer(ID)!;
    player.skills.push({ skillId: 'cuff', level: 10 });
    player.level = 1;

    const result = router.handle('practice 基本拳脚', ID);
    expect(result).toContain('极限');
  });

  it('cannot practice in combat', () => {
    const { router, players } = setup();
    const player = players.getPlayer(ID)!;
    player.state = 'fighting';
    player.skills.push({ skillId: 'cuff', level: 1 });

    const result = router.handle('practice 基本拳脚', ID);
    expect(result).toContain('战斗中');
  });

  it('rejects invalid exert action', () => {
    const { router } = setup();
    const result = router.handle('exert foo', ID);
    expect(result).toContain('没有');
  });

  it('rejects invalid meditation duration', () => {
    const { router } = setup();
    expect(router.handle('dazuo abc', ID)).toContain('用法');
    expect(router.handle('dazuo 0', ID)).toContain('用法');
    expect(router.handle('dazuo 301', ID)).toContain('用法');
  });

  it('meditation can raise max MP when full', () => {
    const { router, players, clock, scheduler } = setup();
    const player = players.getPlayer(ID)!;
    player.skills = [{ skillId: 'force', level: 20 }];
    player.hp = 200;
    player.mp = player.maxMp;
    const beforeMaxMp = player.maxMp;

    router.handle('dazuo 1', ID);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    clock.advance(1000);
    scheduler.tick();

    expect(player.maxMp).toBe(beforeMaxMp + 1);
  });
});
