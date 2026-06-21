import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';
import { SkillSystem } from '../systems/SkillSystem.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { NpcSystem } from '../systems/NpcSystem.js';
import { SchoolSystem } from '../systems/SchoolSystem.js';

const PLAYER_ID = 'polish-player';

describe('Polish: minimum playable loop', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let items: ItemSystem;
  let skills: SkillSystem;
  let npcs: NpcSystem;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    players = new PlayerManager();
    const map = new MapSystem();
    const combat = new CombatSystem();
    skills = new SkillSystem();
    items = new ItemSystem();
    npcs = new NpcSystem(skills);
    const schools = new SchoolSystem();
    router = new CommandRouter(players, map, combat, skills, items, npcs, schools);
    players.createPlayer(PLAYER_ID);
    cmd('楚留香');
    cmd('done');
    const p = players.getPlayer(PLAYER_ID)!;
    p.pot = 1000;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('equipment bonuses', () => {
    it('wearing a weapon increases combat damage', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'iron-sword', 1);
      cmd('wear 铁剑');
      const attrs = items.getEffectiveAttributes(p);
      expect(attrs.str).toBe(p.attributes.str + 8);
    });


  });

  describe('perform deals real damage', () => {
    it('perform requires combat', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      skills.learnSkill(p, 'cuff', { currentRoom: 'town/training' });
      // cuff level 1 < 10
      expect(cmd('perform 基本拳脚.黑虎掏心')).toContain('不够');
    });

    it('perform kills a weak NPC when skill level is high enough', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      p.skills.push({ skillId: 'cuff', level: 10 });
      p.mp = 100;
      // Move to forest1 and start fight with bandit, weaken it but keep it alive.
      cmd('n'); cmd('n');
      const bandit = npcs.getNpc('bandit')!;
      bandit.hp = 10;
      p.state = 'fighting';
      p.targetEnemy = 'npc:bandit';
      bandit.state = 'fighting';
      bandit.targetPlayerId = PLAYER_ID;
      const out = cmd('perform 基本拳脚.黑虎掏心');
      expect(out).toContain('造成');
      expect(bandit.hp).toBe(0);
    });
  });

  describe('exert powerup', () => {
    it('powerup boosts strike damage', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      p.skills.push({ skillId: 'cuff', level: 20 });
      p.mp = 100;
      cmd('exert powerup');
      expect(p.powerupExpiry).toBeGreaterThan(Date.now());
      const strike = (router as any).poweredBestStrike(p);
      expect(strike.damage).toBeGreaterThan(2 + 0.3 * 20); // unboosted base
    });

    it('powerup is shown in score', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      p.mp = 100;
      cmd('exert powerup');
      expect(cmd('hp')).toContain('战力提升');
    });
  });

  describe('medicine effects', () => {
    it('neili-dan restores MP', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'neili-dan', 1);
      p.mp = 0;
      const out = cmd('use 内力丹');
      expect(out).toContain('恢复了 50 点内力');
      expect(p.mp).toBe(50);
    });

    it('jiedu-wan cures poison', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'jiedu-wan', 1);
      p.conditions.push('poison');
      const out = cmd('use 解毒丸');
      expect(out).toContain('解除了 poison 状态');
      expect(p.conditions).not.toContain('poison');
    });

    it('attribute pill permanently raises attribute and recalculates stats', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'str-dan', 1);
      const strBefore = p.attributes.str;
      const out = cmd('use 力量丹');
      expect(out).toContain('臂力永久 +1');
      expect(p.attributes.str).toBe(strBefore + 1);
    });
  });

  describe('NPC respawn', () => {
    it('dead NPC respawns after configured seconds', () => {
      vi.useFakeTimers();
      const bandit = npcs.getNpc('bandit')!;
      bandit.hp = 0;
      bandit.state = 'idle';
      bandit.targetPlayerId = null;
      expect(npcs.getNpcsInRoom('wilderness/forest1')).toHaveLength(0);
      npcs.scheduleRespawn('bandit');
      vi.advanceTimersByTime(30000);
      expect(bandit.hp).toBe(bandit.maxHp);
      expect(npcs.getNpcsInRoom('wilderness/forest1')).toHaveLength(1);
    });
  });

  describe('room item respawn', () => {
    it('picked-up room item respawns after interval', () => {
      vi.useFakeTimers();
      const map = (router as any).map as MapSystem;
      cmd('s'); // town/training
      expect(cmd('get 木剑')).toContain('捡起了木剑');
      expect(map.getRoom('town/training')!.items).not.toContain('木剑');
      vi.advanceTimersByTime(60000);
      expect(map.getRoom('town/training')!.items).toContain('木剑');
    });
  });

  describe('real delivery quest', () => {
    it('accept from 说书人 and complete at 王掌柜', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      // 说书人 is in town/square (starting room)
      const accept = cmd('quest 说书人');
      expect(accept).toContain('信件');
      expect(p.quest).not.toBeNull();
      expect(items.hasItem(p, 'letter')).toBe(true);

      // Travel to town/inn: square -> east
      cmd('e');
      const complete = cmd('quest 王掌柜');
      expect(complete).toContain('完成');
      expect(p.quest).toBeNull();
      expect(items.hasItem(p, 'letter')).toBe(false);
    });

    it('cannot complete delivery quest without letter', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      cmd('quest 说书人');
      items.removeItem(p, 'letter');
      cmd('e');
      const out = cmd('quest 王掌柜');
      expect(out).toContain('信呢');
      expect(p.quest).not.toBeNull();
    });
  });
});
