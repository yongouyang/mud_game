import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { MapSystem } from '../systems/MapSystem.js';
import { CombatSystem } from '../systems/CombatSystem.js';

const PLAYER_ID = 'test-player';

describe('CommandRouter', () => {
  let router: CommandRouter;
  let players: PlayerManager;

  beforeEach(() => {
    players = new PlayerManager();
    const map = new MapSystem();
    const combat = new CombatSystem();
    router = new CommandRouter(players, map, combat);
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
      expect(output).toContain('score');
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
      const router2 = new CommandRouter(players, new MapSystem(), new CombatSystem());
      router2.handle('李寻欢', player2Id);
      router2.handle('done', player2Id);
      router2.handle('s', player2Id); // Move to same room
    });

    it('kill initiates combat', () => {
      const output = cmd('kill 李寻欢');
      expect(output).toContain('发起了攻击');
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
      expect(output).toContain('伤害');
    });
  });
});
