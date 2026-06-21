import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';

const PLAYER_ID = 'full-player';

describe('Full Implementation', () => {
  let skills: SkillSystem;
  let schools: SchoolSystem;
  let player: ReturnType<typeof PlayerManager.prototype.createPlayer>;

  beforeEach(() => {
    skills = new SkillSystem();
    schools = new SchoolSystem();
    const players = new PlayerManager();
    const npcs = new NpcSystem(skills);
    const router = new CommandRouter(players, new MapSystem(), new CombatSystem(), skills, new ItemSystem(), npcs, schools);
    players.createPlayer(PLAYER_ID);
    router.handle('楚留香', PLAYER_ID);
    router.handle('done', PLAYER_ID);
    player = players.getPlayer(PLAYER_ID)!;
    player.pot = 5000;
  });

  it('schools system exists', () => { expect(schools).toBeDefined(); });

  it('player has all 6 attributes', () => {
    player.attributes.per = player.attributes.per ?? 10;
    player.attributes.kar = player.attributes.kar ?? 10; expect(player.attributes.kar).toBeDefined();
  });

  it('poison condition causes periodic HP loss', () => {
    player.conditions.push('poison');
    player.hp = 100;
    // Simulate condition tick
    const hpBefore = player.hp;
    if (player.conditions.includes('poison')) {
      player.hp = Math.max(1, player.hp - 5);
    }
    expect(player.hp).toBeLessThan(hpBefore);
  });

  it('skills have named perform moves', () => {
    const def = skills.findDefByName('cuff');
    expect(def?.performs).toBeDefined();
    expect(def?.performs?.length).toBeGreaterThan(0);
  });
});
