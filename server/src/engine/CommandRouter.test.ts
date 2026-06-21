import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'test-player';

describe('CommandRouter', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let items: ItemSystem;

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    items = ctx.items;
    players.createPlayer(PLAYER_ID);
  });

  function cmd(input: string): string {
    return router.handle(input, PLAYER_ID);
  }

  describe('character creation', () => {
    it('prompts for name on first connect', () => {
      const output = cmd('');
      expect(output).toContain('欢迎来到炎黄群侠传');
      expect(output).toContain('请输入你的名字');
    });

    it('rejects invalid names', () => {
      const output = cmd('ab');
      expect(output).toContain('名字须为2-6个中文字');
    });

    it('accepts a valid Chinese name', () => {
      const output = cmd('楚留香');
      expect(output).toContain('楚留香');
      expect(output).toContain('分配属性点数');
    });

    it('rejects attribute out of range', () => {
      cmd('楚留香');
      const output = cmd('set 臂力 3');
      expect(output).toContain('属性值须为 5-20');
    });

    it('rejects attribute if points exceeded', () => {
      cmd('楚留香');
      const output = cmd('set 臂力 25');
      expect(output).toContain('属性值须为 5-20');
    });

    it('accepts English attribute key (str)', () => {
      cmd('楚留香');
      const output = cmd('set str 15');
      expect(output).toContain('臂力(str): 15');
      expect(output).toContain('剩余 5 点');
    });

    it('accepts uppercase English key (STR)', () => {
      cmd('楚留香');
      const output = cmd('set STR 14');
      expect(output).toContain('臂力(str): 14');
    });

    it('accepts all four English keys (str/int/con/dex)', () => {
      cmd('楚留香');
      let out = cmd('set str 12');
      expect(out).toContain('臂力(str): 12');
      out = cmd('set int 13');
      expect(out).toContain('悟性(int): 13');
      out = cmd('set dex 14');
      expect(out).toContain('身法(dex): 14');
      out = cmd('set con 11');
      expect(out).toContain('根骨(con): 11');
    });

    it('shows remaining points correctly', () => {
      cmd('楚留香');
      // Default: 10 each = 40 total, remaining = 10
      let output = cmd('');
      expect(output).toContain('剩余 10 点');

      // Allocate 3 to arm strength
      output = cmd('set 臂力 13');
      expect(output).toContain('剩余 7 点');

      // Allocate 4 to constitution (English key)
      output = cmd('set con 14');
      expect(output).toContain('剩余 3 点');
    });

    it('completes character creation with done', () => {
      cmd('楚留香');
      const output = cmd('done');
      expect(output).toContain('角色创建成功');
      expect(output).toContain('无名小镇');
    });

    it('shows help during creation', () => {
      const output = cmd('help');
      expect(output).toContain('创建角色流程');
    });
  });

  describe('after character creation', () => {
    beforeEach(() => {
      cmd('楚留香');
      cmd('done');
    });

    it('look shows room description', () => {
      const output = cmd('look');
      expect(output).toContain('无名小镇·广场');
      expect(output).toContain('古井');
    });

    it('l is an alias for look', () => {
      const output = cmd('l');
      expect(output).toContain('无名小镇·广场');
    });

    it('hp shows status', () => {
      const output = cmd('hp');
      expect(output).toContain('楚留香');
      expect(output).toContain('气血');
      expect(output).toContain('内力');
    });

    it('score shows attributes', () => {
      const output = cmd('score');
      expect(output).toContain('臂力');
      expect(output).toContain('悟性');
      expect(output).toContain('根骨');
      expect(output).toContain('身法');
    });

    it('n moves north', () => {
      const output = cmd('n');
      expect(output).toContain('主街');
    });

    it('south moves south', () => {
      const output = cmd('south');
      expect(output).toContain('练武场');
    });

    it('movement alias works (s for south)', () => {
      const output = cmd('s');
      expect(output).toContain('练武场');
    });

    it('cannot move through walls', () => {
      const output = cmd('w');
      expect(output).toContain('这个方向没有路');
    });

    it('help lists new commands', () => {
      const output = cmd('help');
      expect(output).toContain('n s e w u d');
      expect(output).toContain('kill');
      expect(output).toContain('skills');
    });

    it('clear returns clear token', () => {
      expect(cmd('clear')).toBe('__CLEAR__');
    });

    it('no box-drawing chars in responses', () => {
      const outputs = [cmd('look'), cmd('hp'), cmd('help'), cmd('n')];
      for (const out of outputs) {
        expect(out).not.toContain('╔');
        expect(out).not.toContain('║');
        expect(out).not.toContain('╠');
        expect(out).not.toContain('╣');
      }
    });

    it('returns confused for unknown command', () => {
      const output = cmd('xyzzy');
      expect(output).toContain('什么');
    });
  });

  describe('combat', () => {
    let player2Id: string;

    beforeEach(() => {
      cmd('楚留香');
      cmd('done');
      // Move to training yard
      cmd('s');

      // Create a second player for combat
      player2Id = 'test-player-2';
      players.createPlayer(player2Id);
      const ctx2 = createTestContext(0, players);
      const router2 = ctx2.router;
      router2.handle('李寻欢', player2Id);
      router2.handle('done', player2Id);
      router2.handle('s', player2Id); // Move to same room
    });

    it('kill initiates combat', () => {
      const output = cmd('kill 李寻欢');
      expect(output).toContain('战斗');
      expect(output).toContain('李寻欢');
      expect(output).toContain('战斗');
    });

    it('kill requires a target name', () => {
      const output = cmd('kill');
      expect(output).toContain('你想攻击谁');
    });

    it('hit during combat deals damage', () => {
      cmd('kill 李寻欢');
      const output = cmd('hit');
      expect(output).toContain('战斗');
    });

    it('combat speed scales with dex and dodge', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      const spd1 = router.getCombatSpeed(PLAYER_ID);
      expect(spd1).toBeGreaterThanOrEqual(600);
      expect(spd1).toBeLessThanOrEqual(2000);
      p.attributes.dex = 20;
      const spd2 = router.getCombatSpeed(PLAYER_ID);
      expect(spd2).toBeLessThan(spd1);
    });
  });

  describe('skills and items', () => {
    beforeEach(() => {
      cmd('楚留香');
      cmd('done');
    });

    it('learn learns a new skill', () => {
      const output = cmd('learn 基本拳脚');
      expect(output).toContain('你学会了基本拳脚');
      expect(output).toContain('Lv.1');
    });

    it('learn levels up existing skill', () => {
      cmd('learn 基本拳脚');
      const output = cmd('learn 基本拳脚');
      expect(output).toContain('Lv.2');
    });

    it('learn rejects unknown skill', () => {
      const output = cmd('learn 不存在的武功');
      expect(output).toContain('没有"不存在的武功"这个武功');
    });

    it('skills lists learned skills', () => {
      cmd('learn 基本拳脚');
      const output = cmd('skills');
      expect(output).toContain('基本拳脚');
    });

    it('skills shows empty message when none learned', () => {
      const output = cmd('skills');
      expect(output).toContain('尚未学习任何武功');
    });

    it('i shows inventory', () => {
      const output = cmd('i');
      expect(output).toContain('空空如也');
    });

    it('get picks up silver', () => {
      const output = cmd('get 银子');
      expect(output).toContain('捡起了 5 两银子');
      const inv = cmd('i');
      expect(inv).toContain('银子');
    });

    it('drop discards an item', () => {
      cmd('get 银子');
      const output = cmd('drop 银子');
      expect(output).toContain('丢掉了银子');
      expect(cmd('i')).toContain('银子 x4');
    });

    it('drop rejects item not in inventory', () => {
      const output = cmd('drop 铁剑');
      expect(output).toContain('你没有"铁剑"');
    });

    it('get picks up room-placed items', () => {
      cmd('s'); // training yard has 木剑 and 金疮药
      expect(cmd('get 木剑')).toContain('捡起了木剑');
    });

    it('use consumes medicine and heals', () => {
      // Give player a medicine via inventory directly
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'jinchuang-yao', 1);
      p.hp = 50; // damage player first

      const output = cmd('use 金疮药');
      expect(output).toContain('恢复了 50 点气血');
      expect(p.hp).toBe(100);
    });

    it('wear equips an item', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      items.addItem(p, 'iron-sword', 1);

      const output = cmd('wear 铁剑');
      expect(output).toContain('装备了铁剑');
      expect(p.equipped).toContain('iron-sword');
    });

    it('remove unequips an item', () => {
      const p = players.getPlayer(PLAYER_ID)!;
      p.equipped.push('wooden-sword');

      const output = cmd('remove 木剑');
      expect(output).toContain('脱下了木剑');
    });

    it('remove rejects item not equipped', () => {
      const output = cmd('remove 铁剑');
      expect(output).toContain('你没有装备"铁剑"');
    });


    it('learn rejects unmet prerequisite', () => {
      expect(cmd('learn 太极拳')).toContain('需要基本拳脚');
    });

    it('learn allows skill after prerequisite met', () => {
      for (let i = 0; i < 10; i++) cmd('learn 基本拳脚');
      const p = players.getPlayer(PLAYER_ID)!;
    (p as any).schoolId = 'wudang'; p.currentRoom = 'wudang/hall';
    expect(cmd('learn 太极拳')).toContain('你学会了太极拳');
    });

    it('exp and pot are visible in score', () => {
      expect(cmd('score')).toContain('经验');
    });

    it('ask talks to NPC', () => {
      const ctx2 = createTestContext(0, players);
      const newRouter = ctx2.router;
      ctx2.npcs.register({ id: "wang", name: "王掌柜", description: "test", roomId: "town/inn", dialogue: ["hello"], attributes: {str:5,int:5,con:5,dex:5}, skills: [], aggressive: false });
      cmd = (input: string) => newRouter.handle(input, PLAYER_ID);
      newRouter.handle("楚留香", PLAYER_ID);
      newRouter.handle("done", PLAYER_ID);
      cmd('e');
      const output = cmd('ask 王掌柜');
      expect(output).toContain('王掌柜说道');
    });
  });

  describe('NPC behaviors', () => {
    let npcs: NpcSystem;
    let npcRouter: CommandRouter;

    beforeEach(() => {
      const ctx2 = createTestContext();
      players = ctx2.players;
      npcs = ctx2.npcs;
      // Register a few test NPCs
      npcs.register({ id: "test-merchant", name: "商人", description: "a merchant", roomId: "town/square", dialogue: ["欢迎光临"], attributes: {str:5,int:5,con:5,dex:5}, skills: [], aggressive: false });
      npcs.register({ id: "test-wolf", name: "野狼", description: "a wolf", roomId: "town/mainstreet", dialogue: ["嗷呜"], attributes: {str:8,int:3,con:6,dex:10}, skills: [], aggressive: true });
      npcs.register({ id: "test-master", name: "师父", description: "master", roomId: "town/training", dialogue: ["刻苦练功"], attributes: {str:10,int:10,con:10,dex:10}, skills: [], aggressive: false });
      npcRouter = ctx2.router;
      players.createPlayer(PLAYER_ID);
      npcRouter.handle("楚留香", PLAYER_ID);
      npcRouter.handle("done", PLAYER_ID);
    });

    function cmd(input: string): string { return npcRouter.handle(input, PLAYER_ID); }

    it('ask neutral NPC returns dialogue', () => {
      const out = cmd('ask 商人');
      expect(out).toContain('欢迎光临');
    });

    it('ask NPC by ID returns dialogue', () => {
      const out = cmd('ask test-merchant');
      expect(out).toContain('欢迎光临');
    });

    it('ask non-existent NPC returns not found', () => {
      expect(cmd('ask 不存在的NPC')).toContain('没有');
    });

    it('aggressive NPC triggers encounter on room entry', () => {
      const out = cmd('n'); // square → mainstreet where wolf is
      expect(out).toContain('野狼 向你扑了过来');
    });

    it('kill NPC by English ID works', () => {
      cmd('n');
      const out = cmd('kill test-wolf');
      expect(out).toContain('战斗');
    });

    it('master NPC can be asked', () => {
      cmd('s'); // square → training
      const out = cmd('ask 师父');
      expect(out).toContain('刻苦练功');
    });
  });
});
