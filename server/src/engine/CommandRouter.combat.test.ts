import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { createTestContext } from '../test-utils.js';
import { NpcDef } from '../models/Npc.js';

const PLAYER_ID = 'combat-player';

function dummyNpc(id: string, name: string, roomId: string, con: number): NpcDef {
  return {
    id,
    name,
    description: '练功木桩',
    roomId,
    dialogue: [],
    attributes: { str: 5, int: 5, con, dex: 5 },
    skills: [],
    aggressive: false,
    respawnSeconds: 0,
  };
}

describe('CommandRouter: advanced combat', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香');
    cmd('done');
    const p = players.getPlayer(PLAYER_ID)!;
    p.attributes = { ...p.attributes, str: 100, dex: 50 };
  });

  it('increases damage when wielding a weapon with a matching weapon skill', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    npcs.register(dummyNpc('dummy-low', '木桩', 'town/square', 20));
    p.skills = [
      { skillId: 'cuff', level: 10 },
      { skillId: 'sword', level: 10 },
    ];

    const firstOut = cmd('kill 木桩');
    let unarmedDmg = 0;
    for (let i = 0; i < 20 && p.state === 'fighting' && unarmedDmg === 0; i++) {
      const out = i === 0 ? firstOut : cmd('hit');
      const m = out.match(/对 木桩 造成了 (\d+) 点伤害/);
      if (m) unarmedDmg = parseInt(m[1], 10);
    }
    expect(unarmedDmg).toBeGreaterThan(0);

    cmd('flee');
    p.equipped.push('iron-sword');

    const secondOut = cmd('kill 木桩');
    let swordDmg = 0;
    for (let i = 0; i < 20 && p.state === 'fighting' && swordDmg === 0; i++) {
      const out = i === 0 ? secondOut : cmd('hit');
      const m = out.match(/对 木桩 造成了 (\d+) 点伤害/);
      if (m) swordDmg = parseInt(m[1], 10);
    }
    expect(swordDmg).toBeGreaterThan(unarmedDmg);
  });

  it('builds combo damage on consecutive hits', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    npcs.register(dummyNpc('dummy-high', '木桩', 'town/square', 25));
    p.skills = [{ skillId: 'cuff', level: 10 }];

    cmd('kill 木桩');
    const damages: number[] = [];
    for (let i = 0; i < 20 && p.state === 'fighting'; i++) {
      const out = cmd('hit');
      const m = out.match(/对 木桩 造成了 (\d+) 点伤害/);
      if (m) damages.push(parseInt(m[1], 10));
    }
    expect(damages.length).toBeGreaterThan(1);
    const max = Math.max(...damages);
    const min = Math.min(...damages);
    expect(max).toBeGreaterThan(min);
  });
});
