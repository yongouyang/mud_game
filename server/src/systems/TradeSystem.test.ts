import { describe, it, expect, beforeEach } from 'vitest';
import { TradeSystem } from './TradeSystem.js';
import { PlayerManager } from './PlayerManager.js';
import { ItemSystem } from './ItemSystem.js';
import { ConditionSystem } from './ConditionSystem.js';
import { TestSystemClock } from '../time/SystemClock.js';
import { Player, createPlayer } from '../models/Player.js';
import { Scheduler } from '../time/Scheduler.js';

describe('TradeSystem', () => {
  let trade: TradeSystem;
  let players: PlayerManager;
  let items: ItemSystem;
  let player1: Player;
  let player2: Player;

  function makePlayer(id: string, name: string, room: string): Player {
    return {
      ...createPlayer(id, name, { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 }),
      currentRoom: room,
    };
  }

  beforeEach(() => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    players = new PlayerManager(clock);
    const conditions = new ConditionSystem(clock);
    items = new ItemSystem(conditions);
    trade = new TradeSystem(players, items);
    player1 = makePlayer('p1', '张无忌', 'town/square');
    player2 = makePlayer('p2', '令狐冲', 'town/square');
    players.setPlayer(player1);
    players.setPlayer(player2);
  });

  describe('give', () => {
    it('transfers item to another player in same room', () => {
      // Give player1 some silver
      items.addItem(player1, 'silver');
      expect(items.hasItem(player1, 'silver')).toBe(true);

      const result = trade.give(player1, '令狐冲', '银子');
      expect(result.self).toContain('你把银子交给了令狐冲');
      expect(result.broadcasts).toHaveLength(1);
      expect(result.broadcasts[0].type).toBe('player');
      expect(result.broadcasts[0].targetId).toBe('p2');
      expect(items.hasItem(player1, 'silver')).toBe(false);
      expect(items.hasItem(player2, 'silver')).toBe(true);
    });

    it('returns error if target not in room', () => {
      items.addItem(player2, 'silver');
      player2.currentRoom = 'town/inn';
      const result = trade.give(player1, '令狐冲', '银子');
      expect(result.self).toContain('没有叫「令狐冲」的玩家');
    });

    it('returns error if item not owned', () => {
      const result = trade.give(player1, '令狐冲', '银子');
      expect(result.self).toContain('你没有「银子」');
    });

    it('returns error for insufficient params', () => {
      const result = trade.give(player1, '', '');
      expect(result.self).toContain('用法：give <玩家名> <物品名>');
    });
  });

  describe('mail', () => {
    it('sends mail to another player (online)', () => {
      const result = trade.sendMail(player1, '令狐冲', '明日华山论剑');
      expect(result.self).toContain('你给 令狐冲 发了一封邮件');
      expect(player2.mailbox).toBeDefined();
      expect(player2.mailbox!.length).toBe(1);
      expect(player2.mailbox![0].from).toBe('张无忌');
      expect(player2.mailbox![0].body).toBe('明日华山论剑');
      expect(player2.mailbox![0].read).toBe(false);
    });

    it('notifies online target', () => {
      const result = trade.sendMail(player1, '令狐冲', 'hello');
      expect(result.broadcasts).toHaveLength(1);
      expect(result.broadcasts[0].text).toContain('新邮件');
    });

    it('returns error for self-target', () => {
      const result = trade.sendMail(player1, '张无忌', 'test');
      expect(result.self).toContain('不能给自己发邮件');
    });

    it('returns error if target not found', () => {
      const result = trade.sendMail(player1, '不存在', 'test');
      expect(result.self).toContain('找不到玩家');
    });
  });

  describe('checkmail / readmail', () => {
    it('shows empty mailbox', () => {
      const result = trade.checkMail(player1);
      expect(result).toContain('邮箱是空的');
    });

    it('shows mail list', () => {
      trade.sendMail(player2, '张无忌', '你好');
      const result = trade.checkMail(player1);
      expect(result).toContain('1');
      expect(result).toContain('令狐冲');
    });

    it('reads a specific mail', () => {
      trade.sendMail(player2, '张无忌', '机密消息');
      const result = trade.readMail(player1, '1');
      expect(result).toContain('机密消息');
      expect(result).toContain('令狐冲');
      expect(player1.mailbox![0].read).toBe(true);
    });

    it('returns error for invalid index', () => {
      const result = trade.readMail(player1, '99');
      expect(result).toContain('请输入有效邮件序号');
    });
  });

  describe('friend', () => {
    it('adds a friend', () => {
      const result = trade.addFriend(player1, '令狐冲');
      expect(result).toContain('你将 令狐冲 添加为好友');
      expect(player1.friends).toContain('令狐冲');
    });

    it('removes a friend', () => {
      trade.addFriend(player1, '令狐冲');
      const result = trade.removeFriend(player1, '令狐冲');
      expect(result).toContain('从好友列表中移除');
      expect(player1.friends).not.toContain('令狐冲');
    });

    it('lists friends with online status', () => {
      trade.addFriend(player1, '令狐冲');
      const result = trade.listFriends(player1);
      expect(result).toContain('令狐冲');
      expect(result).toContain('【在线】');
    });

    it('shows empty friend list', () => {
      const result = trade.listFriends(player1);
      expect(result).toContain('还没有好友');
    });
  });
});
