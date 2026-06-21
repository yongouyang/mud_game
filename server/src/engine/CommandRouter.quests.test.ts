import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { Scheduler } from '../time/Scheduler.js';
import { TestSystemClock } from '../time/SystemClock.js';
import { createTestContext } from '../test-utils.js';
import { NpcDef } from '../models/Npc.js';

const PLAYER_ID = 'quest-expanded-player';

function weakNpc(id: string, name: string, roomId: string): NpcDef {
  return {
    id,
    name,
    description: '任务目标',
    roomId,
    dialogue: [],
    attributes: { str: 5, int: 5, con: 1, dex: 5 },
    skills: [],
    aggressive: false,
    respawnSeconds: 0,
  };
}

describe('CommandRouter: expanded quests', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;
  let clock: TestSystemClock;
  let scheduler: Scheduler;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;
    clock = ctx.clock;
    scheduler = ctx.scheduler;

    // Quest giver and targets in the starting room.
    npcs.register(weakNpc('quest-hunter', '猎人', 'town/square'));
    npcs.register({ ...weakNpc('rat', '老鼠', 'town/square'), aggressive: true, respawnSeconds: 1 });

    ctx.quests.register({
      id: 'kill-rats',
      title: '灭鼠',
      giverNpcId: 'quest-hunter',
      completerNpcId: 'quest-hunter',
      type: 'kill',
      targetId: 'rat',
      targetCount: 2,
      rewardExp: 40,
      rewardPot: 15,
      rewardShen: 5,
    });
    ctx.quests.register({
      id: 'collect-herbs',
      title: '采药',
      giverNpcId: 'quest-hunter',
      completerNpcId: 'quest-hunter',
      type: 'collect',
      targetId: 'herb',
      targetCount: 3,
      rewardExp: 30,
      rewardPot: 10,
    });

    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
    const p = players.getPlayer(PLAYER_ID)!;
    p.attributes = { ...p.attributes, str: 80, dex: 80 };
  });

  it('tracks kill quest progress and completes at the giver', () => {
    cmd('quest 猎人 kill-rats');
    const p = players.getPlayer(PLAYER_ID)!;
    expect(p.quest?.type).toBe('kill');

    cmd('kill 老鼠');
    for (let i = 0; i < 30 && p.state === 'fighting'; i++) cmd('hit');

    expect(p.quest?.progress).toBeGreaterThanOrEqual(1);

    // Let the rat respawn before the second kill.
    clock.advance(2000);
    scheduler.tick();

    cmd('kill 老鼠');
    for (let i = 0; i < 30 && p.state === 'fighting'; i++) cmd('hit');

    const beforeShen = p.shen;
    const out = cmd('quest 猎人');
    expect(out).toContain('完成');
    expect(p.quest).toBeNull();
    expect(p.shen).toBe(beforeShen + 5);
  });

  it('tracks collect quest progress and consumes items on complete', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.inventory = [{ itemId: 'herb', quantity: 3 }];

    cmd('quest 猎人 collect-herbs');
    expect(p.quest?.type).toBe('collect');

    const out = cmd('quest 猎人');
    expect(out).toContain('完成');
    expect(p.quest).toBeNull();
    expect(p.inventory.find((i) => i.itemId === 'herb')?.quantity || 0).toBe(0);
  });

  it('shows active quest details with quest command', () => {
    cmd('quest 猎人 kill-rats');
    const out = cmd('quest');
    expect(out).toContain('灭鼠');
    expect(out).toContain('进度');
  });
});
