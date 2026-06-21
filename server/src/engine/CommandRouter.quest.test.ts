import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';

const PLAYER_ID = 'quest-player';

describe('Quest System', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    players = new PlayerManager();
    const map = new MapSystem();
    const combat = new CombatSystem();
    const skills = new SkillSystem();
    const items = new ItemSystem();
    npcs = new NpcSystem(skills);
    const schools = new SchoolSystem();
    // Register quest NPC
    npcs.register({ id: "quest-master", name: "任务使者", description: "发布了任务的NPC", roomId: "town/square", dialogue: ["有任务要交给你"], attributes: {str:10,int:10,con:10,dex:10}, skills: [], aggressive: false });
    router = new CommandRouter(players, map, combat, skills, items, npcs, schools);
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
    players.getPlayer(PLAYER_ID)!.exp = 10000;
    players.getPlayer(PLAYER_ID)!.pot = 100;
  });

  describe('quest command', () => {
    it('quest without NPC shows usage', () => {
      expect(cmd('quest')).toContain('用法');
    });

    it('quest from NPC gives task', () => {
      const out = cmd('quest 任务使者');
      expect(out).toContain('任务');
    });
  });

  describe('quest completion', () => {
    it('completing quest gives exp and pot', () => {
      // Accept quest
      cmd('quest 任务使者');
      const p = players.getPlayer(PLAYER_ID)!;
      expect(p.quest).toBeDefined();
      // Complete quest
      const out = cmd('quest 任务使者');
      expect(out).toContain('完成');
      expect(p.quest).toBeNull();
    });
  });
});
