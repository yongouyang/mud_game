import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';

const PLAYER_ID = 'gap2-player';

describe('Remaining Gaps', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;
  let items: ItemSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    players = new PlayerManager();
    const map = new MapSystem();
    const combat = new CombatSystem();
    const skills = new SkillSystem();
    items = new ItemSystem();
    npcs = new NpcSystem(skills);
    const schools = new SchoolSystem();
    router = new CommandRouter(players, map, combat, skills, items, npcs, schools);
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
  });

  describe('NPC respawn', () => {
    beforeEach(() => {
      npcs.register({ id: "respawn-test", name: "复活测试怪", description: "a test creature", roomId: "town/training", dialogue: [], attributes: {str:5,int:5,con:5,dex:5}, skills: [], aggressive: false });
    });

    it('NPC respawns after being killed', () => {
      const npc = npcs.getNpc('respawn-test');
      expect(npc).toBeTruthy();
      npc!.hp = 0;
      npc!.state = 'idle';
      expect(npc!.hp).toBe(0);
      npcs.respawn('respawn-test');
      const revived = npcs.getNpc('respawn-test');
      expect(revived?.hp).toBeGreaterThan(0);
      expect(revived?.state).toBe('idle');
    });
  });

  describe('shop system', () => {
    it('buy command exists and rejects with no target', () => {
      expect(cmd('buy')).toContain('用法');
    });

    it('buy requires silver', () => {
      const result = cmd('buy 金疮药');
      expect(result).toContain('不足');
    });

    it('can buy when having enough silver', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'silver', 100);
      p.pot = 0;
      const result = cmd('buy 金疮药');
      expect(result).toContain('买');
    });
  });
});
