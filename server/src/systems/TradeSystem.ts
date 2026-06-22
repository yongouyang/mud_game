import { BroadcastTarget } from '../models/ChatTypes.js';
import { Player, MailMessage, nextMailId } from '../models/Player.js';
import { PlayerManager } from './PlayerManager.js';
import { ItemSystem } from './ItemSystem.js';

export class TradeSystem {
  constructor(
    private players: PlayerManager,
    private items: ItemSystem,
  ) {}

  /** Give an item to another player in the same room. */
  give(giver: Player, targetName: string, itemName: string): { self: string; broadcasts: BroadcastTarget[] } {
    if (!targetName || !itemName) {
      return { self: '\n  用法：give <玩家名> <物品名>\n', broadcasts: [] };
    }

    const others = this.players.getPlayersInRoom(giver.currentRoom);
    const target = others.find((p) => p.name === targetName);
    if (!target) return { self: `\n  这里没有叫「${targetName}」的玩家。\n`, broadcasts: [] };
    if (target.id === giver.id) return { self: '\n  你不能给自己东西。\n', broadcasts: [] };

    // Find item in giver's inventory by Chinese name
    const invEntry = (giver.inventory || []).find((inv) => {
      const def = this.items.getDef(inv.itemId);
      return def && def.name === itemName;
    });
    if (!invEntry) return { self: `\n  你没有「${itemName}」。\n`, broadcasts: [] };

    this.items.removeItem(giver, invEntry.itemId);
    this.items.addItem(target, invEntry.itemId);

    return {
      self: `\n  你把${itemName}交给了${target.name}。\n`,
      broadcasts: [
        {
          type: 'player',
          targetId: target.id,
          text: `\n  ${giver.name} 把${itemName}交给了你。\n`,
        },
      ],
    };
  }

  /** Send an offline mail message to a player (online or offline). */
  sendMail(sender: Player, targetName: string, body: string): { self: string; broadcasts: BroadcastTarget[] } {
    if (!targetName || !body) {
      return { self: '\n  用法：mail <玩家名> <消息>\n', broadcasts: [] };
    }

    // Find target player — could be online or we look them up from persistence
    const target = this.findPlayer(targetName);
    if (!target) return { self: `\n  找不到玩家「${targetName}」。\n`, broadcasts: [] };
    if (target.id === sender.id) return { self: '\n  你不能给自己发邮件。\n', broadcasts: [] };

    const msg: MailMessage = {
      id: nextMailId(),
      from: sender.name,
      body,
      timestamp: Date.now(),
      read: false,
    };

    if (!target.mailbox) target.mailbox = [];
    target.mailbox.push(msg);

    const broadcasts: BroadcastTarget[] = [];
    // If target is online, notify them
    if (this.players.getPlayer(target.id)) {
      broadcasts.push({
        type: 'player',
        targetId: target.id,
        text: `\n  你收到了一封来自 ${sender.name} 的新邮件。输入 checkmail 查看。\n`,
      });
    }

    return {
      self: `\n  你给 ${target.name} 发了一封邮件。\n`,
      broadcasts,
    };
  }

  /** Check and display mailbox. */
  checkMail(player: Player): string {
    const mailbox = player.mailbox || [];
    if (mailbox.length === 0) return '\n  你的邮箱是空的。\n';
    const unread = mailbox.filter((m) => !m.read).length;
    const lines = mailbox.map((m, i) => {
      const status = m.read ? '✓' : '✉';
      return `  [${i + 1}] ${status} 来自: ${m.from}  时间: ${new Date(m.timestamp).toLocaleString()}`;
    });
    return `\n  你的邮箱（共 ${mailbox.length} 封，${unread} 封未读）：\n${lines.join('\n')}\n  输入 readmail <序号> 阅读邮件。\n`;
  }

  /** Read a specific mail by index (1-based). */
  readMail(player: Player, indexStr: string): string {
    const mailbox = player.mailbox || [];
    const idx = parseInt(indexStr, 10);
    if (isNaN(idx) || idx < 1 || idx > mailbox.length) {
      return `\n  请输入有效邮件序号（1-${mailbox.length}）。\n`;
    }
    const mail = mailbox[idx - 1];
    mail.read = true;
    return `\n  ─── 邮件 #${idx} ───\n  来自: ${mail.from}\n  时间: ${new Date(mail.timestamp).toLocaleString()}\n\n  ${mail.body}\n  ───────────────\n`;
  }

  /** Add a friend to the player's friend list. */
  addFriend(player: Player, targetName: string): string {
    if (!targetName) return '\n  用法：friend add <玩家名>\n';
    if (targetName === player.name) return '\n  你不能加自己为好友。\n';
    const target = this.findPlayer(targetName);
    if (!target) return `\n  找不到玩家「${targetName}」。\n`;
    if (!player.friends) player.friends = [];
    if (player.friends.includes(targetName)) return `\n  ${targetName} 已经是你的好友了。\n`;
    player.friends.push(targetName);
    return `\n  你将 ${targetName} 添加为好友。\n`;
  }

  /** Remove a friend from the player's friend list. */
  removeFriend(player: Player, targetName: string): string {
    if (!targetName) return '\n  用法：friend remove <玩家名>\n';
    if (!player.friends || !player.friends.includes(targetName)) {
      return `\n  ${targetName} 不是你的好友。\n`;
    }
    player.friends = player.friends.filter((f) => f !== targetName);
    return `\n  你将 ${targetName} 从好友列表中移除。\n`;
  }

  /** List friends with online status. */
  listFriends(player: Player): string {
    const friends = player.friends || [];
    if (friends.length === 0) return '\n  你还没有好友。输入 friend add <玩家名> 添加好友。\n';
    const onlineNames = new Set(this.players.getAllPlayers().map((p) => p.name));
    const lines = friends.map((f) => {
      const online = onlineNames.has(f) ? '【在线】' : '【离线】';
      return `  ${online} ${f}`;
    });
    return `\n  你的好友（${friends.length}人）：\n${lines.join('\n')}\n`;
  }

  private findPlayer(name: string): Player | undefined {
    // Check online first
    const online = this.players.getAllPlayers().find((p) => p.name === name);
    if (online) return online;
    // Check player manager for any cached players (may have been loaded from save)
    return this.players.getAllPlayers().find((p) => p.name === name);
  }
}
