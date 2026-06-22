import { describe, it, expect, beforeEach } from 'vitest';
import { ChatSystem } from './ChatSystem.js';
import { PlayerManager } from './PlayerManager.js';
import { TestSystemClock } from '../time/SystemClock.js';
import { Player, createPlayer } from '../models/Player.js';

describe('ChatSystem', () => {
  let chat: ChatSystem;
  let players: PlayerManager;
  let player1: Player;
  let player2: Player;

  function makePlayer(id: string, name: string, room: string, schoolId?: string, schoolName?: string): Player {
    return {
      ...createPlayer(id, name, { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 }),
      currentRoom: room,
      schoolId,
      schoolName,
    };
  }

  beforeEach(() => {
    const clock = new TestSystemClock(0);
    players = new PlayerManager(clock);
    chat = new ChatSystem(players);
    player1 = makePlayer('p1', '张无忌', 'town/square', 'wudang', '武当派');
    player2 = makePlayer('p2', '令狐冲', 'town/square', 'huashan', '华山派');
    players.setPlayer(player1);
    players.setPlayer(player2);
  });

  describe('say', () => {
    it('sends room broadcast to other players', () => {
      const result = chat.say(player1, '大家好');
      expect(result.self).toContain('你说道：「大家好」');
      expect(result.broadcasts).toHaveLength(1);
      expect(result.broadcasts[0].type).toBe('room');
      expect(result.broadcasts[0].targetId).toBe('town/square');
      expect(result.broadcasts[0].excludePlayerId).toBe('p1');
      expect(result.broadcasts[0].text).toContain('张无忌');
      expect(result.broadcasts[0].text).toContain('大家好');
    });

    it('returns prompt for empty message', () => {
      const result = chat.say(player1, '');
      expect(result.self).toContain('你想说什么？');
      expect(result.broadcasts).toHaveLength(0);
    });
  });

  describe('tell', () => {
    it('sends private message to target player', () => {
      const result = chat.tell(player1, '令狐冲', '你好吗');
      expect(result.self).toContain('你对 令狐冲 悄悄说道：「你好吗」');
      expect(result.broadcasts).toHaveLength(1);
      expect(result.broadcasts[0].type).toBe('player');
      expect(result.broadcasts[0].targetId).toBe('p2');
      expect(result.broadcasts[0].text).toContain('张无忌');
      expect(result.broadcasts[0].text).toContain('你好吗');
    });

    it('returns error if target offline', () => {
      const result = chat.tell(player1, '张三丰', '你好');
      expect(result.self).toContain('在线玩家中没有叫「张三丰」');
      expect(result.broadcasts).toHaveLength(0);
    });

    it('returns error if self-target', () => {
      const result = chat.tell(player1, '张无忌', '自言自语');
      expect(result.self).toContain('不能对自己说悄悄话');
      expect(result.broadcasts).toHaveLength(0);
    });
  });

  describe('shout', () => {
    it('broadcasts to all online players', () => {
      const result = chat.shout(player1, '天下英雄听令');
      expect(result.self).toContain('你大声喊道：「天下英雄听令」');
      expect(result.broadcasts).toHaveLength(1);
      expect(result.broadcasts[0].type).toBe('world');
      expect(result.broadcasts[0].excludePlayerId).toBe('p1');
      expect(result.broadcasts[0].text).toContain('【江湖】');
      expect(result.broadcasts[0].text).toContain('张无忌');
    });

    it('returns prompt for empty message', () => {
      const result = chat.shout(player1, '');
      expect(result.self).toContain('你想喊什么？');
      expect(result.broadcasts).toHaveLength(0);
    });
  });

  describe('schoolChat', () => {
    it('broadcasts to school members', () => {
      const result = chat.schoolChat(player1, '武当弟子听令');
      expect(result.self).toContain('【武当派】你说道：「武当弟子听令」');
      expect(result.broadcasts).toHaveLength(1);
      expect(result.broadcasts[0].type).toBe('school');
      expect(result.broadcasts[0].targetId).toBe('wudang');
      expect(result.broadcasts[0].excludePlayerId).toBe('p1');
      expect(result.broadcasts[0].text).toContain('【武当派】');
      expect(result.broadcasts[0].text).toContain('张无忌');
    });

    it('returns error if not in a school', () => {
      player1.schoolId = undefined;
      player1.schoolName = undefined;
      const result = chat.schoolChat(player1, 'hello');
      expect(result.self).toContain('还没有加入门派');
    });
  });
});
