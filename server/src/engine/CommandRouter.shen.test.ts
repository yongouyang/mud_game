import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { createTestContext } from '../test-utils.js';
import { NpcDef } from '../models/Npc.js';

const PLAYER_ID = 'test-player';

function makeNpc(
  id: string,
  name: string,
  roomId: string,
  opts: { aggressive?: boolean; faction?: string } = {},
): NpcDef {
  return {
    id,
    name,
    description: '测试目标',
    roomId,
    dialogue: [],
    attributes: { str: 5, int: 5, con: 30, dex: 5 },
    skills: [],
    aggressive: opts.aggressive || false,
    respawnSeconds: 0,
    faction: opts.faction,
  };
}

describe('CommandRouter: killer tracking + 善恶 (shen)', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;

  function cmd(input: string, pid = PLAYER_ID): string {
    return router.handle(input, pid);
  }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香');
    cmd('done');
    const player = players.getPlayer(PLAYER_ID)!;
    player.attributes = { ...player.attributes, str: 80, dex: 80 };
  });

  it('killing an aggressive NPC raises shen and counts as an NPC kill', () => {
    const roomId = players.getPlayer(PLAYER_ID)!.currentRoom;
    npcs.register(makeNpc('test-wolf', '野狼', roomId, { aggressive: true }));

    cmd('kill 野狼');
    for (let i = 0; i < 50; i++) {
      const out = cmd('hit');
      if (out.includes('获得了')) break;
    }

    const player = players.getPlayer(PLAYER_ID)!;
    expect(player.kills.npcs).toBeGreaterThan(0);
    expect(player.shen).toBe(10);
  });

  it('killing a faction NPC lowers shen', () => {
    const roomId = players.getPlayer(PLAYER_ID)!.currentRoom;
    npcs.register(makeNpc('test-disciple', '青城弟子', roomId, { faction: 'qingcheng' }));

    cmd('kill 青城弟子');
    for (let i = 0; i < 50; i++) {
      const out = cmd('hit');
      if (out.includes('获得了')) break;
    }

    const player = players.getPlayer(PLAYER_ID)!;
    expect(player.kills.npcs).toBeGreaterThan(0);
    expect(player.shen).toBe(-50);
  });

  it('records the last killer when a player dies to an NPC', () => {
    const roomId = players.getPlayer(PLAYER_ID)!.currentRoom;
    npcs.register(makeNpc('test-brute', '悍匪', roomId, { aggressive: true }));
    const player = players.getPlayer(PLAYER_ID)!;
    player.hp = 1;

    for (let i = 0; i < 10; i++) {
      cmd('kill 悍匪');
      if (player.hp === 1 && player.state === 'playing') break;
    }

    expect(player.kills.lastKillerName).toBe('悍匪');
  });

  it('records player kills and adjusts shen based on victim alignment', () => {
    const victimId = 'test-victim';
    players.createPlayer(victimId);
    const victimRouter = createTestContext(0, players).router;
    victimRouter.handle('李寻欢', victimId);
    victimRouter.handle('done', victimId);
    victimRouter.handle('s', victimId); // move to training yard
    cmd('s'); // move to training yard as well

    const victim = players.getPlayer(victimId)!;
    victim.attributes = { ...victim.attributes, con: 5, dex: 5 };
    victim.hp = 10;

    // Make the victim a good person.
    victim.shen = 600;

    cmd('kill 李寻欢');
    for (let i = 0; i < 20; i++) {
      const out = cmd('hit');
      if (out.includes('损失了')) break;
    }

    const player = players.getPlayer(PLAYER_ID)!;
    expect(player.kills.players).toBe(1);
    expect(player.shen).toBeLessThan(0);
    expect(victim.kills.lastKillerName).toBe('楚留香');
  });

  it('displays shen and kill counts in score', () => {
    const player = players.getPlayer(PLAYER_ID)!;
    player.shen = 200;
    player.kills.npcs = 5;
    player.kills.players = 2;

    const out = cmd('score');
    expect(out).toContain('善恶值');
    expect(out).toContain('200');
    expect(out).toContain('玩家 2');
    expect(out).toContain('NPC 5');
  });
});
