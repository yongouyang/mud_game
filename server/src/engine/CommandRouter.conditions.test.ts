import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'condition-player';

describe('Condition flows via CommandRouter', () => {
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
    p.pot = 1000;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
  });

  it('use 解毒丸 cures poison', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    router.handle('get 木剑', PLAYER_ID); // grab starting item to have inventory access
    p.conditions.push({ id: 'poison', name: '中毒', level: 2, remain: 5, appliedAt: 0 });
    // Give jiedu-wan
    (router as any).items.addItem(p, 'jiedu-wan', 1);
    const out = cmd('use 解毒丸');
    expect(out).toContain('解除');
    expect(p.conditions).toHaveLength(0);
  });

  it('exert dispel attempts to remove poison', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const p = players.getPlayer(PLAYER_ID)!;
    p.conditions.push({ id: 'poison', name: '中毒', level: 1, remain: 5, appliedAt: 0 });
    p.mp = 100;
    const out = cmd('exert dispel poison');
    expect(out).toContain('驱散');
    expect(p.conditions).toHaveLength(0);
  });

  it('exert dispel poison removes any poison-category condition', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const p = players.getPlayer(PLAYER_ID)!;
    p.conditions.push({ id: 'fire_poison', name: '火毒', level: 1, remain: 5, appliedAt: 0 });
    p.mp = 100;
    const out = cmd('exert dispel poison');
    expect(out).toContain('驱散');
    expect(p.conditions).toHaveLength(0);
  });

  it('jiedu-wan cures fire_poison via category', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.conditions.push({ id: 'fire_poison', name: '火毒', level: 1, remain: 5, appliedAt: 0 });
    (router as any).items.addItem(p, 'jiedu-wan', 1);
    const out = cmd('use 解毒丸');
    expect(out).toContain('解除');
    expect(p.conditions).toHaveLength(0);
  });

  it('score shows active conditions', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.conditions.push({ id: 'poison', name: '中毒', level: 3, remain: 5, appliedAt: 0 });
    const out = cmd('score');
    expect(out).toContain('中毒');
    expect(out).toContain('Lv.3');
  });

  it('movement interrupts meditation', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.skills.push({ skillId: 'force', level: 10 });
    p.mp = 0;
    cmd('dazuo 5');
    expect(p.isMeditating).toBe(true);
    cmd('s'); // move south to training yard
    expect(p.isMeditating).toBe(false);
  });
});
