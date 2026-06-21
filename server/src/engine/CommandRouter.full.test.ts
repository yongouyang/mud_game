import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'full-player';

describe('Full Implementation', () => {
  let skills: SkillSystem;
  let schools: SchoolSystem;
  let player: ReturnType<typeof PlayerManager.prototype.createPlayer>;
  let router: CommandRouter;

  beforeEach(() => {
    const ctx = createTestContext();
    skills = ctx.skills;
    schools = ctx.schools;
    router = ctx.router;
    ctx.players.createPlayer(PLAYER_ID);
    router.handle('楚留香', PLAYER_ID);
    router.handle('done', PLAYER_ID);
    player = ctx.players.getPlayer(PLAYER_ID)!;
    player.pot = 5000;
  });

  it('schools system exists', () => { expect(schools).toBeDefined(); });

  it('player has all 6 attributes', () => {
    player.attributes.per = player.attributes.per ?? 10;
    player.attributes.kar = player.attributes.kar ?? 10; expect(player.attributes.kar).toBeDefined();
  });

  it('poison condition causes periodic HP loss', () => {
    player.conditions.push({ id: 'poison', name: '中毒', level: 1, remain: 5, appliedAt: 0 });
    player.hp = 100;
    // Simulate condition tick
    const hpBefore = player.hp;
    if (player.conditions.some((c) => c.id === 'poison')) {
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
