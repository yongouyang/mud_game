import { BroadcastTarget } from '../models/ChatTypes.js';
import { Player } from '../models/Player.js';
import { PlayerManager } from './PlayerManager.js';

export class ChatSystem {
  constructor(private players: PlayerManager) {}

  /** The player speaks to everyone in the same room. */
  say(speaker: Player, message: string): { self: string; broadcasts: BroadcastTarget[] } {
    const broadcasts: BroadcastTarget[] = [];
    if (message.length > 0) {
      broadcasts.push({
        type: 'room',
        targetId: speaker.currentRoom,
        excludePlayerId: speaker.id,
        text: `\n  你听到 ${speaker.name} 说道：「${message}」\n`,
      });
    }
    return {
      self: message.length > 0 ? `\n  你说道：「${message}」\n` : '\n  你想说什么？\n',
      broadcasts,
    };
  }

  /** Private message to a specific player anywhere in the world. */
  tell(speaker: Player, targetName: string, message: string): { self: string; broadcasts: BroadcastTarget[] } {
    if (!message) return { self: '\n  你想说什么？用法：tell <玩家名> <消息>\n', broadcasts: [] };

    const target = this.findOnlinePlayerByName(targetName);
    if (!target) return { self: `\n  在线玩家中没有叫「${targetName}」的人。\n`, broadcasts: [] };
    if (target.id === speaker.id) return { self: '\n  你不能对自己说悄悄话。\n', broadcasts: [] };

    return {
      self: `\n  你对 ${target.name} 悄悄说道：「${message}」\n`,
      broadcasts: [
        {
          type: 'player',
          targetId: target.id,
          text: `\n  ${speaker.name} 对你悄悄说道：「${message}」\n`,
        },
      ],
    };
  }

  /** Shout to the entire world (all online players). */
  shout(speaker: Player, message: string): { self: string; broadcasts: BroadcastTarget[] } {
    if (!message) return { self: '\n  你想喊什么？用法：shout <消息>\n', broadcasts: [] };
    return {
      self: `\n  你大声喊道：「${message}」\n`,
      broadcasts: [
        {
          type: 'world',
          excludePlayerId: speaker.id,
          text: `\n  【江湖】${speaker.name} 大声说道：「${message}」\n`,
        },
      ],
    };
  }

  /** School channel — broadcast to all online members of the same school. */
  schoolChat(speaker: Player, message: string): { self: string; broadcasts: BroadcastTarget[] } {
    if (!message) return { self: '\n  你想在门派频道说什么？用法：chat <消息>\n', broadcasts: [] };
    if (!speaker.schoolId) return { self: '\n  你还没有加入门派，无法使用门派频道。\n', broadcasts: [] };

    const schoolName = speaker.schoolName || '未知';
    return {
      self: `\n  【${schoolName}】你说道：「${message}」\n`,
      broadcasts: [
        {
          type: 'school',
          targetId: speaker.schoolId,
          excludePlayerId: speaker.id,
          text: `\n  【${schoolName}】${speaker.name}：「${message}」\n`,
        },
      ],
    };
  }

  private findOnlinePlayerByName(name: string): Player | undefined {
    const online = this.players.getAllPlayers();
    return online.find((p) => p.name === name);
  }
}
