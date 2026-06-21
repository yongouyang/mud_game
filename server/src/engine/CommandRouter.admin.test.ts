import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { createTestContext } from '../test-utils.js';

const GM_ID = 'gm-player';
const VICTIM_ID = 'victim-player';

describe('CommandRouter: GM tooling', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;

  function cmd(input: string, pid = GM_ID): string { return router.handle(input, pid); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;

    players.createPlayer(GM_ID);
    cmd('楚留香', GM_ID);
    cmd('done', GM_ID);
    players.getPlayer(GM_ID)!.isAdmin = true;

    players.createPlayer(VICTIM_ID);
    router.handle('李寻欢', VICTIM_ID);
    router.handle('done', VICTIM_ID);
  });

  it('rejects gm commands for non-admins', () => {
    const out = cmd('gm list', VICTIM_ID);
    expect(out).toContain('没有权限');
  });

  it('lists online players', () => {
    const out = cmd('gm list');
    expect(out).toContain('楚留香');
    expect(out).toContain('李寻欢');
  });

  it('inspects another player', () => {
    const out = cmd('gm inspect 李寻欢');
    expect(out).toContain('李寻欢');
    expect(out).toContain('气血');
  });

  it('kicks a player', () => {
    expect(cmd('gm kick 李寻欢')).toContain('移出游戏');
    expect(players.getPlayer(VICTIM_ID)).toBeUndefined();
  });

  it('teleports the GM to a room', () => {
    expect(cmd('gm goto shaolin/hall')).toContain('传送');
    expect(players.getPlayer(GM_ID)!.currentRoom).toBe('shaolin/hall');
  });

  it('sets a player field', () => {
    cmd('gm set 李寻欢 hp 50');
    expect(players.getPlayer(VICTIM_ID)!.hp).toBe(50);
  });

  it('spawns an NPC clone', () => {
    const roomId = players.getPlayer(GM_ID)!.currentRoom;
    const before = npcs.getNpcsInRoom(roomId).filter((n) => n.def.id === 'bandit').length;
    const out = cmd('gm spawn bandit');
    const after = npcs.getNpcsInRoom(roomId).filter((n) => n.def.id.startsWith('bandit')).length;
    expect(out).toContain('召唤了 山贼');
    expect(after).toBe(before + 1);
  });
});
