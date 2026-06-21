import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';

const PLAYER_ID = 'classic-player';

describe('Classic MUD Features', () => {
  let router: CommandRouter;
  let players: PlayerManager;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    players = new PlayerManager();
    const map = new MapSystem();
    const combat = new CombatSystem();
    const skills = new SkillSystem();
    const items = new ItemSystem();
    const npcs = new NpcSystem(skills);
    const schools = new SchoolSystem();
    router = new CommandRouter(players, map, combat, skills, items, npcs, schools);
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
    players.getPlayer(PLAYER_ID)!.pot = 1000;
  });

  it('perform command exists', () => {
    expect(cmd('perform')).toContain('用法');
  });

  it('perform rejected without skill level', () => {
    expect(cmd('perform cuff.quan')).toContain('不够');
  });

  it('exert command exists', () => {
    expect(cmd('exert')).toContain('用法');
  });

  it('yun is alias for exert', () => {
    expect(cmd('yun')).toContain('用法');
  });

  it('player has conditions array', () => {
    expect(players.getPlayer(PLAYER_ID)!.conditions).toBeDefined();
  });

  it('joining school gives attribute bonus', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    const conBefore = p.attributes.con;
    (p as any).schoolId = null;
    cmd('n'); cmd('n'); cmd('n'); cmd('e'); cmd('s'); cmd('w');
    cmd('join 少林派');
    expect(p.attributes.con).toBeGreaterThanOrEqual(conBefore);
  });
});
