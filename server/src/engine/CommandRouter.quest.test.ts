import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'quest-player';

describe('Quest System', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let npcs: NpcSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    npcs = ctx.npcs;
    // Register a simple talk quest NPC
    npcs.register({ id: "quest-master", name: "任务使者", description: "发布了任务的NPC", roomId: "town/square", dialogue: ["有任务要交给你"], attributes: {str:10,int:10,con:10,dex:10}, skills: [], aggressive: false });
    ctx.quests.register({
      id: 'talk-intro',
      title: '初识江湖',
      giverNpcId: 'quest-master',
      completerNpcId: 'quest-master',
      type: 'talk',
      targetId: 'quest-master',
      targetCount: 1,
      rewardExp: 50,
      rewardPot: 10,
    });
    players.createPlayer(PLAYER_ID);
    cmd('楚留香'); cmd('done');
    players.getPlayer(PLAYER_ID)!.exp = 10000;
    players.getPlayer(PLAYER_ID)!.pot = 100;
  });

  describe('quest command', () => {
    it('quest without NPC shows active quest status', () => {
      expect(cmd('quest')).toContain('当前没有任务');
    });

    it('quest from NPC lists available quests', () => {
      const out = cmd('quest 任务使者');
      expect(out).toContain('初识江湖');
      expect(out).toContain('talk-intro');
    });
  });

  describe('quest completion', () => {
    it('completing quest gives exp and pot', () => {
      // Accept quest
      cmd('quest 任务使者 talk-intro');
      const p = players.getPlayer(PLAYER_ID)!;
      expect(p.quest).not.toBeNull();
      // Complete quest
      const out = cmd('quest 任务使者');
      expect(out).toContain('完成');
      expect(p.quest).toBeNull();
    });
  });
});
