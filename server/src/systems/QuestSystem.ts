import { Player } from '../models/Player.js';
import { ItemSystem } from './ItemSystem.js';
import { LevelSystem } from './LevelSystem.js';
import questData from '../data/quests.json' assert { type: 'json' };

export interface QuestDef {
  id: string;
  title: string;
  giverNpcId: string;
  completerNpcId?: string;
  type: 'kill' | 'collect' | 'delivery' | 'talk';
  targetId: string; // NPC id for kill/talk, item id for collect/delivery
  targetCount: number;
  rewardExp: number;
  rewardPot: number;
  rewardShen?: number;
  rewardItemId?: string;
}

export interface QuestResult {
  message: string;
  completed?: boolean;
}

export class QuestSystem {
  private defs = new Map<string, QuestDef>();

  constructor(
    private items: ItemSystem,
    private levels: LevelSystem,
  ) {
    for (const def of questData as QuestDef[]) {
      this.defs.set(def.id, def);
    }
  }

  register(def: QuestDef): void {
    this.defs.set(def.id, def);
  }

  getDef(questId: string): QuestDef | undefined {
    return this.defs.get(questId);
  }

  /** List quests available from a given NPC. */
  availableQuests(npcId: string): QuestDef[] {
    const result: QuestDef[] = [];
    for (const def of this.defs.values()) {
      if (def.giverNpcId === npcId) result.push(def);
    }
    return result;
  }

  /** Accept a quest if the NPC offers it and player has no active quest. */
  accept(player: Player, questId: string): QuestResult {
    if (player.quest) {
      return { message: `你还有一个任务未完成（${player.quest.title || player.quest.type}）。` };
    }
    const def = this.defs.get(questId);
    if (!def) return { message: '没有该任务。' };
    player.quest = {
      questId: def.id,
      title: def.title,
      type: def.type,
      target: def.type === 'kill' ? this.npcName(def.targetId) : this.itemName(def.targetId),
      targetId: def.targetId,
      targetCount: def.targetCount,
      progress: 0,
      exp: def.rewardExp,
      pot: def.rewardPot,
      itemId: def.type === 'delivery' ? def.targetId : undefined,
      rewardShen: def.rewardShen,
      rewardItemId: def.rewardItemId,
    };
    if (def.type === 'delivery') {
      this.items.addItem(player, def.targetId);
    }
    return {
      message: `你接取了任务「${def.title}」。\n${this.describeObjective(player.quest)}`,
    };
  }

  /** Advance a kill quest when the player kills a matching NPC. */
  onNpcKill(player: Player, npcId: string): string {
    const q = player.quest;
    if (!q || q.type !== 'kill' || q.targetId !== npcId) return '';
    q.progress = (q.progress || 0) + 1;
    if ((q.progress || 0) >= (q.targetCount || 1)) {
      return `\n  任务目标达成：${q.target} (${q.progress}/${q.targetCount})，回去交差吧。\n`;
    }
    return `\n  任务进度：${q.target} ${q.progress}/${q.targetCount}。\n`;
  }

  /** Try to complete the active quest at the given NPC. */
  complete(player: Player, npcId: string): QuestResult {
    const q = player.quest;
    if (!q) return { message: '你当前没有任务。' };
    const def = q.questId ? this.defs.get(q.questId) : undefined;
    const completerId = def?.completerNpcId || def?.giverNpcId;
    if (def && completerId !== npcId) {
      return { message: `「${q.title || q.type}」不是在这里交任务的。` };
    }

    if (q.type === 'kill') {
      if ((q.progress || 0) < (q.targetCount || 1)) {
        return { message: `任务还没完成：${q.target} ${q.progress || 0}/${q.targetCount || 1}。` };
      }
    } else if (q.type === 'collect') {
      const needed = q.targetCount || 1;
      if (!this.items.hasItem(player, q.targetId!) || (this.items.getItemCount?.(player, q.targetId!) || 0) < needed) {
        return { message: `你还没有收集够 ${needed} 个${q.target}。` };
      }
      this.items.removeItem(player, q.targetId!, needed);
    } else if (q.type === 'delivery') {
      if (!this.items.hasItem(player, q.targetId!)) {
        return { message: `你还没有拿到要交付的${q.target}。` };
      }
      this.items.removeItem(player, q.targetId!, 1);
    }

    return this.grantRewards(player, q);
  }

  /** Format the active quest for display. */
  formatActive(player: Player): string {
    const q = player.quest;
    if (!q) return '\n  你当前没有任务。\n';
    let progress = '';
    if (q.type === 'kill') {
      progress = `进度：${q.progress || 0}/${q.targetCount || 1}`;
    } else if (q.type === 'collect') {
      const count = this.items.getItemCount?.(player, q.targetId!) || 0;
      progress = `进度：${count}/${q.targetCount || 1}`;
    }
    return [
      '',
      `  ─── 当前任务 ───`,
      `  ${q.title || q.type}`,
      `  目标：${this.describeObjective(q)}`,
      progress ? `  ${progress}` : '',
      `  奖励：经验 ${q.exp}  潜能 ${q.pot}${q.rewardShen ? `  善恶 ${q.rewardShen > 0 ? '+' : ''}${q.rewardShen}` : ''}`,
      '',
    ].join('\n') + '\n';
  }

  private grantRewards(player: Player, q: NonNullable<Player['quest']>): QuestResult {
    player.exp = (player.exp || 0) + q.exp;
    player.pot = (player.pot || 0) + q.pot;
    if (q.rewardShen) player.shen = (player.shen || 0) + q.rewardShen;
    if (q.rewardItemId) this.items.addItem(player, q.rewardItemId);
    player.quest = null;
    let msg = `任务完成！你获得了 ${q.exp} 点经验和 ${q.pot} 点潜能。`;
    if (q.rewardShen) msg += ` 善恶值 ${q.rewardShen > 0 ? '+' : ''}${q.rewardShen}。`;
    if (q.rewardItemId) msg += ` 获得 ${this.itemName(q.rewardItemId)}。`;
    const levelResult = this.levels.checkLevelUp(player);
    if (levelResult.leveledUp) {
      msg += '\n  ' + levelResult.messages.join('\n  ');
    }
    return { message: msg, completed: true };
  }

  private describeObjective(q: NonNullable<Player['quest']>): string {
    switch (q.type) {
      case 'kill':
        return `杀死 ${q.targetCount || 1} 个${q.target}`;
      case 'collect':
        return `收集 ${q.targetCount || 1} 个${q.target}`;
      case 'delivery':
        return `把${q.target}送到指定地点`;
      case 'talk':
        return `与 ${q.target} 对话`;
      default:
        return q.target;
    }
  }

  private npcName(npcId: string): string {
    // Best-effort name lookup; falls back to id.
    return npcId;
  }

  private itemName(itemId: string): string {
    const def = this.items.getDef(itemId);
    return def?.name || itemId;
  }
}
