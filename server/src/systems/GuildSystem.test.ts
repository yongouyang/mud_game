import { describe, it, expect, beforeEach } from 'vitest';
import { GuildSystem } from './GuildSystem.js';
import { PlayerManager } from './PlayerManager.js';
import { TestSystemClock } from '../time/SystemClock.js';
import { Player, createPlayer } from '../models/Player.js';

describe('GuildSystem', () => {
  let guilds: GuildSystem;
  let players: PlayerManager;
  let leader: Player;
  let member: Player;

  function makePlayer(id: string, name: string): Player {
    return {
      ...createPlayer(id, name, { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 10 }),
      currentRoom: 'town/square',
    };
  }

  beforeEach(() => {
    const clock = new TestSystemClock(0);
    players = new PlayerManager(clock);
    guilds = new GuildSystem(players);
    leader = makePlayer('p1', '张三丰');
    member = makePlayer('p2', '张无忌');
    players.setPlayer(leader);
    players.setPlayer(member);
  });

  describe('create guild', () => {
    it('creates a guild and makes player the leader', () => {
      const result = guilds.createGuild(leader, '武当联盟');
      expect(result).toContain('你创建了帮会「武当联盟」');
      expect(result).toContain('帮主');
      expect(leader.guildId).toBe('guild-武当联盟');
    });

    it('rejects non-Chinese name', () => {
      const result = guilds.createGuild(leader, 'abc');
      expect(result).toContain('帮会名须为2-8个中文字');
    });

    it('rejects duplicate name', () => {
      guilds.createGuild(leader, '武当联盟');
      const result = guilds.createGuild(member, '武当联盟');
      expect(result).toContain('已经存在');
    });

    it('rejects player already in a guild', () => {
      guilds.createGuild(leader, '武当联盟');
      const result = guilds.createGuild(leader, '少林联盟');
      expect(result).toContain('你已经有所属帮会了');
    });
  });

  describe('join guild', () => {
    it('allows player to join existing guild', () => {
      guilds.createGuild(leader, '武当联盟');
      const result = guilds.joinGuild(member, '武当联盟');
      expect(result).toContain('你加入了帮会「武当联盟」');
      expect(member.guildId).toBe('guild-武当联盟');
    });

    it('rejects joining if already in guild', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.joinGuild(member, '少林派');
      expect(result).toContain('你已经有所属帮会了');
    });

    it('rejects joining non-existent guild', () => {
      const result = guilds.joinGuild(member, '不存在');
      expect(result).toContain('不存在');
    });
  });

  describe('leave guild', () => {
    it('allows member to leave', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.leaveGuild(member);
      expect(result).toContain('离开了帮会');
      expect(member.guildId).toBeUndefined();
    });

    it('prevents leader from leaving', () => {
      guilds.createGuild(leader, '武当联盟');
      const result = guilds.leaveGuild(leader);
      expect(result).toContain('无法直接离开');
      expect(leader.guildId).toBeDefined();
    });
  });

  describe('disband guild', () => {
    it('allows leader to disband', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.disbandGuild(leader);
      expect(result).toContain('解散了帮会');
      expect(leader.guildId).toBeUndefined();
      expect(member.guildId).toBeUndefined();
    });

    it('prevents non-leader from disbanding', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.disbandGuild(member);
      expect(result).toContain('只有帮主才能解散');
    });
  });

  describe('promote/demote', () => {
    it('promotes member to elder', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.promoteMember(leader, '张无忌');
      expect(result).toContain('任命 张无忌 为长老');
    });

    it('demotes elder to member', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      guilds.promoteMember(leader, '张无忌');
      const result = guilds.demoteMember(leader, '张无忌');
      expect(result).toContain('降为普通成员');
    });

    it('prevents non-leader from promoting', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.promoteMember(member, '张无忌');
      expect(result).toContain('只有帮主');
    });
  });

  describe('list / info', () => {
    it('lists guilds', () => {
      guilds.createGuild(leader, '武当联盟');
      const result = guilds.listGuilds();
      expect(result).toContain('武当联盟');
      expect(result).toContain('张三丰');
      expect(result).toContain('1人');
    });

    it('shows empty list', () => {
      const result = guilds.listGuilds();
      expect(result).toContain('还没有任何帮会');
    });

    it('shows guild info', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.infoGuild(leader);
      expect(result).toContain('武当联盟');
      expect(result).toContain('张三丰');
      expect(result).toContain('张无忌');
      expect(result).toContain('2 人');
      expect(result).toContain('【在线】');
    });
  });

  describe('guildChat', () => {
    it('broadcasts to online guild members', () => {
      guilds.createGuild(leader, '武当联盟');
      guilds.joinGuild(member, '武当联盟');
      const result = guilds.guildChat(leader, '大家好');
      expect(result.self).toContain('【武当联盟帮会】你说道：「大家好」');
      expect(result.broadcasts.length).toBeGreaterThanOrEqual(1);
      const toMember = result.broadcasts.find((b) => b.targetId === 'p2');
      expect(toMember).toBeDefined();
      expect(toMember!.text).toContain('【武当联盟帮会】');
      expect(toMember!.text).toContain('张三丰');
    });

    it('returns error if not in guild', () => {
      const result = guilds.guildChat(member, 'hello');
      expect(result.self).toContain('还没有加入帮会');
    });
  });
});
