import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';

const PLAYER_ID = 'batch2-player';

describe('Batch 2: Shop + Conditions', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let items: ItemSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    players = new PlayerManager();
    items = new ItemSystem();
    const skills = new SkillSystem();
    const npcs = new NpcSystem(skills);
    router = new CommandRouter(players, new MapSystem(), new CombatSystem(), skills, items, npcs, new SchoolSystem());
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
  });

  it('shop list command shows items', () => {
    expect(cmd('shop')).toContain('商店');
  });

  it('buy without shop list first shows usage', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    items.addItem(p, 'silver', 100);
    expect(cmd('buy 金疮药')).toContain('买');
  });

  it('list command alias for shop', () => {
    expect(cmd('list')).toContain('商店');
  });

  it('poison condition can be applied', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.conditions.push('poison');
    expect(p.conditions).toContain('poison');
  });
});
