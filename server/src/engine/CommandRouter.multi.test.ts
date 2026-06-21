import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { createTestContext } from '../test-utils.js';
import { NpcDef } from '../models/Npc.js';

const PLAYER_ID = 'test-player';

function weakNpc(
  id: string,
  name: string,
  roomId: string,
  faction?: string,
  guarder?: boolean,
  con = 1,
): NpcDef {
  return {
    id,
    name,
    description: '测试用路人',
    roomId,
    dialogue: [],
    attributes: { str: 5, int: 5, con, dex: 5 },
    skills: [],
    aggressive: false,
    respawnSeconds: 0,
    faction,
    guarder,
  };
}

describe('CommandRouter: multi-enemy combat', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;

  function cmd(input: string): string {
    return router.handle(input, PLAYER_ID);
  }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香');
    cmd('done');
    // Make the player overpowered so randomness does not drag tests out.
    const player = players.getPlayer(PLAYER_ID)!;
    player.attributes = { ...player.attributes, str: 80, dex: 80 };
  });

  it('keeps additional targets active after the primary enemy falls', () => {
    const roomId = players.getPlayer(PLAYER_ID)!.currentRoom;
    // High constitution so the first enemy survives the initial round.
    npcs.register(weakNpc('test-enemy-a', '敌人甲', roomId, undefined, undefined, 20));
    npcs.register(weakNpc('test-enemy-b', '敌人乙', roomId, undefined, undefined, 20));

    cmd('kill 敌人甲');
    cmd('kill 敌人乙');

    const player = players.getPlayer(PLAYER_ID)!;
    expect(player.state).toBe('fighting');
    expect(player.combatTargets).toContain('npc:test-enemy-a');
    expect(player.combatTargets).toContain('npc:test-enemy-b');

    // Hit until the primary target dies; the secondary target should remain.
    for (let i = 0; i < 40 && player.state === 'fighting'; i++) {
      cmd('hit');
      if (player.targetEnemy === 'npc:test-enemy-b') break;
    }

    expect(player.state).toBe('fighting');
    expect(player.combatTargets).toContain('npc:test-enemy-b');
    expect(player.targetEnemy).toBe('npc:test-enemy-b');
  });

  it('lets same-faction guarders join when their ally is attacked', () => {
    const roomId = players.getPlayer(PLAYER_ID)!.currentRoom;
    npcs.register(weakNpc('test-guard-target', '守门弟子', roomId, 'shaolin', false, 20));
    npcs.register(weakNpc('test-guard-a', '护院武僧甲', roomId, 'shaolin', true, 20));
    npcs.register(weakNpc('test-guard-b', '护院武僧乙', roomId, 'shaolin', true, 20));

    cmd('kill 守门弟子');

    const player = players.getPlayer(PLAYER_ID)!;
    expect(player.combatTargets).toContain('npc:test-guard-target');
    expect(player.combatTargets).toContain('npc:test-guard-a');
    expect(player.combatTargets).toContain('npc:test-guard-b');
    expect(player.combatTargets).toHaveLength(3);
  });

  it('caps active enemies at four', () => {
    const roomId = players.getPlayer(PLAYER_ID)!.currentRoom;
    for (let i = 1; i <= 5; i++) {
      npcs.register(weakNpc(`test-cap-${i}`, `弟子${i}`, roomId, undefined, undefined, 30));
    }

    for (let i = 1; i <= 4; i++) {
      cmd(`kill 弟子${i}`);
    }

    const player = players.getPlayer(PLAYER_ID)!;
    expect(player.combatTargets.length).toBe(4);

    const output = cmd('kill 弟子5');
    expect(output).toContain('同时应付的敌人太多了');
  });

  it('includes extra enemies in combat round output', () => {
    const roomId = players.getPlayer(PLAYER_ID)!.currentRoom;
    npcs.register(weakNpc('test-multi-primary', '前锋', roomId, undefined, undefined, 20));
    npcs.register(weakNpc('test-multi-extra', '侧翼', roomId, undefined, undefined, 20));

    cmd('kill 前锋');
    cmd('kill 侧翼');

    const output = cmd('hit');
    // The extra enemy gets a counter-attack, so its name appears in the round log.
    expect(output).toContain('侧翼');
  });
});
