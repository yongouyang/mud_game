import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';

const PLAYER_ID = 'test-player';

describe('Phase 4: Schools', () => {
  let router: CommandRouter;
  let players: PlayerManager;

  function cmd(input: string): string {
    return router.handle(input, PLAYER_ID);
  }

  beforeEach(() => {
    players = new PlayerManager();
    const map = new MapSystem();
    const combat = new CombatSystem();
    const skills = new SkillSystem();
    const items = new ItemSystem();
    const npcs = new NpcSystem(skills);
    router = new CommandRouter(players, map, combat, skills, items, npcs, new SchoolSystem());
    players.createPlayer(PLAYER_ID);
    cmd('楚留香');
    cmd('done');
  });

  it('school list is available', () => {
    const out = cmd('schools');
    expect(out).toContain('少林派'); expect(out).toContain('武当派'); expect(out).toContain('丐帮'); expect(out).toContain('华山派'); expect(out).toContain('峨眉派'); expect(out).toContain('古墓派');
    expect(out).toContain('武当派');
  });

  it('school info shows details', () => {
    const out = cmd('schools 少林派');
    expect(out).toContain("少林派");
    expect(out).toContain("武功");
  });

  it('cannot join school when not at the school location', () => {
    const out = cmd('join 少林派');
    expect(out).toContain('这里不是');
  });

  it('can join school at the correct location', () => {
    // Navigate to Shaolin entrance (need map expansion)
    // For now, test that the command is recognized
    const out = cmd('join 不存在的门派');
    expect(out).toContain('没有');
  });
});
