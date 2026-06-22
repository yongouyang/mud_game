import { BroadcastTarget } from '../models/ChatTypes.js';
import { Guild, GuildMember, GuildRank } from '../models/Guild.js';
import { Player } from '../models/Player.js';
import { PlayerManager } from './PlayerManager.js';

const NAME_RE = /^[\u4e00-\u9fff]{2,8}$/;

export class GuildSystem {
  private guilds = new Map<string, Guild>();

  constructor(private players: PlayerManager) {}

  /** Create a new guild. The creator becomes the leader. */
  createGuild(leader: Player, name: string): string {
    if (!name) return '\n  用法：guild create <帮会名>\n';
    if (!NAME_RE.test(name)) return '\n  帮会名须为2-8个中文字。\n';
    if (leader.guildId) return '\n  你已经有所属帮会了。\n';

    for (const g of this.guilds.values()) {
      if (g.name === name) return `\n  帮会「${name}」已经存在。\n`;
    }

    const id = 'guild-' + name;
    const guild: Guild = {
      id,
      name,
      leaderId: leader.name,
      members: [{ playerName: leader.name, rank: 'leader', joinedAt: Date.now() }],
      created: Date.now(),
    };
    this.guilds.set(id, guild);
    leader.guildId = id;

    for (const g of this.guilds.values()) {
      if (g.id !== id) {
        g.members = g.members.filter((m) => m.playerName !== leader.name);
      }
    }

    return `\n  恭喜！你创建了帮会「${name}」！\n  你现在是帮主了。\n`;
  }

  /** Join an existing guild. */
  joinGuild(player: Player, name: string): string {
    if (!name) return '\n  用法：guild join <帮会名>\n';
    if (player.guildId) return '\n  你已经有所属帮会了。\n';

    const guild = this.findByName(name);
    if (!guild) return `\n  帮会「${name}」不存在。\n`;
    if (guild.members.some((m) => m.playerName === player.name)) {
      return `\n  你已经在帮会「${name}」中了。\n`;
    }
    if (guild.members.length >= 50) {
      return `\n  帮会「${name}」已满（上限50人）。\n`;
    }

    guild.members.push({ playerName: player.name, rank: 'member', joinedAt: Date.now() });
    player.guildId = guild.id;
    return `\n  你加入了帮会「${guild.name}」！\n`;
  }

  leaveGuild(player: Player): string {
    if (!player.guildId) return '\n  你还没有加入任何帮会。\n';
    const guild = this.guilds.get(player.guildId);
    if (!guild) { player.guildId = undefined; return '\n  该帮会已不存在。\n'; }
    if (guild.leaderId === player.name) {
      return '\n  你是帮主，无法直接离开。请先转让帮主或解散帮会（guild disband）。\n';
    }
    guild.members = guild.members.filter((m) => m.playerName !== player.name);
    player.guildId = undefined;
    return `\n  你离开了帮会「${guild.name}」。\n`;
  }

  disbandGuild(leader: Player): string {
    if (!leader.guildId) return '\n  你还没有所属帮会。\n';
    const guild = this.guilds.get(leader.guildId);
    if (!guild) { leader.guildId = undefined; return '\n  该帮会已不存在。\n'; }
    if (guild.leaderId !== leader.name) return '\n  只有帮主才能解散帮会。\n';

    for (const m of guild.members) {
      const p = this.findOnlinePlayer(m.playerName);
      if (p) p.guildId = undefined;
    }
    this.guilds.delete(guild.id);
    return `\n  你解散了帮会「${guild.name}」。\n`;
  }

  promoteMember(leader: Player, targetName: string): string {
    if (!leader.guildId) return '\n  你还没有所属帮会。\n';
    const guild = this.guilds.get(leader.guildId);
    if (!guild) { leader.guildId = undefined; return '\n  该帮会已不存在。\n'; }
    if (guild.leaderId !== leader.name) return '\n  只有帮主才能任命长老。\n';

    const member = guild.members.find((m) => m.playerName === targetName);
    if (!member) return `\n  ${targetName} 不是帮会成员。\n`;
    if (member.rank === 'leader') return '\n  不能提拔帮主。\n';
    if (member.rank === 'elder') return `\n  ${targetName} 已经是长老了。\n`;

    member.rank = 'elder';
    return `\n  你任命 ${targetName} 为长老。\n`;
  }

  demoteMember(leader: Player, targetName: string): string {
    if (!leader.guildId) return '\n  你还没有所属帮会。\n';
    const guild = this.guilds.get(leader.guildId);
    if (!guild) { leader.guildId = undefined; return '\n  该帮会已不存在。\n'; }
    if (guild.leaderId !== leader.name) return '\n  只有帮主才能降职长老。\n';

    const member = guild.members.find((m) => m.playerName === targetName);
    if (!member) return `\n  ${targetName} 不是帮会成员。\n`;
    if (member.rank !== 'elder') return `\n  ${targetName} 不是长老。\n`;

    member.rank = 'member';
    return `\n  你将 ${targetName} 降为普通成员。\n`;
  }

  listGuilds(): string {
    if (this.guilds.size === 0) return '\n  目前还没有任何帮会。输入 guild create <帮会名> 创建一个。\n';
    const lines: string[] = [];
    for (const g of this.guilds.values()) {
      lines.push(`  ${g.name}（帮主: ${g.leaderId}，${g.members.length}人）`);
    }
    return `\n  江湖帮会（${this.guilds.size}个）：\n${lines.join('\n')}\n`;
  }

  infoGuild(player: Player, name?: string): string {
    const guildId = name ? this.findByName(name)?.id : player.guildId;
    if (!guildId) return '\n  用法：guild info <帮会名> 或直接输入 guild info 查看本帮信息。\n';
    const guild = this.guilds.get(guildId);
    if (!guild) return '\n  该帮会不存在。\n';

    const members = guild.members.map((m) => {
      const rankLabel = m.rank === 'leader' ? '帮主' : m.rank === 'elder' ? '长老' : '成员';
      const online = this.findOnlinePlayer(m.playerName) ? '【在线】' : '【离线】';
      return `  ${online} ${m.playerName}（${rankLabel}）`;
    });
    return [
      '',
      `  ─── 帮会「${guild.name}」───`,
      `  帮主: ${guild.leaderId}`,
      `  成员: ${guild.members.length} 人`,
      `  创建: ${new Date(guild.created).toLocaleString()}`,
      '',
      '  成员列表：',
      ...members,
      '',
    ].join('\n') + '\n';
  }



  guildChat(speaker: Player, message: string): { self: string; broadcasts: BroadcastTarget[] } {
    if (!message) return { self: '\n  用法：guild chat <消息>\n', broadcasts: [] };
    if (!speaker.guildId) return { self: '\n  你还没有加入帮会。\n', broadcasts: [] };
    const guild = this.guilds.get(speaker.guildId);
    if (!guild) { speaker.guildId = undefined; return { self: '\n  你的帮会已不存在。\n', broadcasts: [] }; }

    const broadcastTargets: BroadcastTarget[] = [];
    for (const m of guild.members) {
      if (m.playerName === speaker.name) continue;
      const online = this.findOnlinePlayer(m.playerName);
      if (online) {
        broadcastTargets.push({
          type: 'player',
          targetId: online.id,
          text: `\n  【${guild.name}帮会】${speaker.name}：「${message}」\n`,
        });
      }
    }
    return {
      self: `\n  【${guild.name}帮会】你说道：「${message}」\n`,
      broadcasts: broadcastTargets,
    };
  }

  getGuildByName(name: string): Guild | undefined {
    return this.findByName(name);
  }

  getGuildForPlayer(player: Player): Guild | undefined {
    if (!player.guildId) return undefined;
    return this.guilds.get(player.guildId);
  }

  private findByName(name: string): Guild | undefined {
    for (const g of this.guilds.values()) {
      if (g.name === name) return g;
    }
    return undefined;
  }

  private findOnlinePlayer(name: string): Player | undefined {
    return this.players.getAllPlayers().find((p) => p.name === name);
  }
}
