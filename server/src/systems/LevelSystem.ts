import { Player, PlayerAttributes, recalcPlayerStats, ATTRIBUTE_NAMES } from '../models/Player.js';

/** Derived level from combat experience. Mirrors oiuv_mud cube-root scaling. */
export function deriveLevel(exp: number): number {
  return Math.floor(Math.pow(exp * 10, 1 / 3)) + 1;
}

export interface LevelUpResult {
  leveledUp: boolean;
  newLevel: number;
  levelsGained: number;
  messages: string[];
}

export class LevelSystem {
  /** Check and apply level-ups. Returns summary. */
  checkLevelUp(player: Player): LevelUpResult {
    const oldLevel = player.level || 1;
    const newLevel = deriveLevel(player.exp || 0);
    const levelsGained = Math.max(0, newLevel - oldLevel);
    const messages: string[] = [];

    if (levelsGained > 0) {
      for (let lv = oldLevel + 1; lv <= newLevel; lv++) {
        // Per-level rewards.
        player.maxHp += Math.round(player.attributes.con * 2);
        player.maxMp += Math.round(player.attributes.int * 1.5);
        player.attrPoints = (player.attrPoints || 0) + 2;
        messages.push(`你升到了 Lv.${lv}！气血上限 +${Math.round(player.attributes.con * 2)}，内力上限 +${Math.round(player.attributes.int * 1.5)}，获得 2 点属性点。`);
      }
      player.level = newLevel;
      // Clamp current HP/MP to new maxima.
      player.hp = Math.min(player.hp, player.maxHp);
      player.mp = Math.min(player.mp, player.maxMp);
    }

    return { leveledUp: levelsGained > 0, newLevel, levelsGained, messages };
  }

  /** Spend attribute points. Returns error message or null on success. */
  spendAttributePoint(player: Player, attr: keyof PlayerAttributes, amount: number = 1): string | null {
    if (!player.attrPoints || player.attrPoints < amount) {
      return `属性点不足！你需要 ${amount} 点（当前 ${player.attrPoints || 0}）。`;
    }
    const key = this.resolveAttributeKey(attr);
    if (!key) {
      return `没有"${attr}"这个属性。可用：str/臂力、int/悟性、con/根骨、dex/身法、per/容貌、kar/福缘。`;
    }
    player.attributes[key] += amount;
    player.attrPoints -= amount;
    recalcPlayerStats(player);
    return null;
  }

  private resolveAttributeKey(input: keyof PlayerAttributes | string): keyof PlayerAttributes | null {
    const map: Record<string, keyof PlayerAttributes> = {
      str: 'str', 臂力: 'str',
      int: 'int', 悟性: 'int',
      con: 'con', 根骨: 'con',
      dex: 'dex', 身法: 'dex',
      per: 'per', 容貌: 'per',
      kar: 'kar', 福缘: 'kar',
    };
    return map[input] || null;
  }

  formatLevelInfo(player: Player): string {
    const nextLevel = (player.level || 1) + 1;
    const nextExp = Math.ceil(Math.pow(nextLevel - 1, 3) / 10);
    const a = player.attributes;
    return [
      '',
      `  等级: Lv.${player.level || 1}`,
      `  经验: ${player.exp || 0} / ${nextExp}（下一级）`,
      `  属性点: ${player.attrPoints || 0}`,
      '',
      `  臂力(str): ${a.str}    悟性(int): ${a.int}    容貌(per): ${a.per}`,
      `  根骨(con): ${a.con}    身法(dex): ${a.dex}    福缘(kar): ${a.kar}`,
      '',
      `  用法：tianfu <属性> [数量]  分配属性点`,
      '',
    ].join('\n') + '\n';
  }
}
