import { Player } from '../models/Player.js';
import { PlayerCondition, ConditionDef } from '../models/Condition.js';
import { SystemClock } from '../time/SystemClock.js';
import conditionsData from '../data/conditions.json' assert { type: 'json' };

export interface ConditionTickResult {
  messages: string[];
  damageHp: number;
  damageMp: number;
}

export class ConditionSystem {
  private defs = new Map<string, ConditionDef>();

  constructor(private clock: SystemClock) {
    for (const def of conditionsData as ConditionDef[]) {
      this.defs.set(def.id, def);
    }
  }

  getDef(id: string): ConditionDef | undefined {
    return this.defs.get(id);
  }

  hasCondition(player: Player, id: string): boolean {
    return player.conditions.some((c) => c.id === id);
  }

  getCondition(player: Player, id: string): PlayerCondition | undefined {
    return player.conditions.find((c) => c.id === id);
  }

  /**
   * Apply a condition to a player. If the player already has the condition,
   * the level is raised to the maximum of the two and remain is refreshed.
   */
  applyCondition(player: Player, id: string, level: number = 1, source?: string): string | null {
    const def = this.defs.get(id);
    if (!def) return null;

    const existing = player.conditions.find((c) => c.id === id);
    if (existing) {
      if (level > existing.level) {
        existing.level = level;
      }
      existing.remain = Math.max(existing.remain, this.initialRemain(def, existing.level));
      existing.source = source || existing.source;
      return `\n  ${def.messages.apply}\n  你的${def.name}加剧了（Lv.${existing.level}）。\n`;
    }

    player.conditions.push({
      id,
      name: def.name,
      level,
      remain: this.initialRemain(def, level),
      source,
      appliedAt: this.clock.now(),
    });
    return `\n  ${def.messages.apply}\n  你中了${def.name}（Lv.${level}）。\n`;
  }

  private initialRemain(def: ConditionDef, level: number): number {
    // Higher level conditions last longer.
    return 6 + level * 2;
  }

  removeCondition(player: Player, id: string): boolean {
    const idx = player.conditions.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    player.conditions.splice(idx, 1);
    return true;
  }

  /** Cure by item effect. Returns a message if successful. */
  cureByItem(player: Player, id: string): string | null {
    const def = this.defs.get(id);
    if (!def) return null;
    const removed = this.removeCondition(player, id);
    if (!removed) return null;
    return `\n  ${def.messages.cure}\n`;
  }

  /** Cure the first condition matching a category. Returns a message or null. */
  cureByCategory(player: Player, category: string): string | null {
    const cond = player.conditions?.find((c) => {
      const def = this.defs.get(c.id);
      return def?.category === category;
    });
    if (!cond) return null;
    const def = this.defs.get(cond.id);
    this.removeCondition(player, cond.id);
    return def ? `\n  ${def.messages.cure}\n` : '\n  异常状态解除了。\n';
  }

  /**
   * Attempt to dispel a condition using force skill.
   * Returns a message describing the outcome, or null if no such condition.
   */
  dispelCondition(player: Player, id: string, forceLv: number): string | null {
    const def = this.defs.get(id);
    const cond = this.getCondition(player, id);
    if (!def || !cond) return null;
    return this.dispelSingleCondition(player, cond, def, forceLv);
  }

  /** Dispel all conditions in a category. Returns a summary message or null. */
  dispelCategory(player: Player, category: string, forceLv: number): string | null {
    const matches = (player.conditions || []).filter((c) => {
      const def = this.defs.get(c.id);
      return def?.category === category;
    });
    if (matches.length === 0) return null;

    const messages: string[] = [];
    for (const cond of matches) {
      const def = this.defs.get(cond.id);
      if (!def) continue;
      const msg = this.dispelSingleCondition(player, cond, def, forceLv);
      if (msg) messages.push(msg.trim());
    }
    if (messages.length === 0) return null;
    return '\n  ' + messages.join('\n  ') + '\n';
  }

  private dispelSingleCondition(
    player: Player,
    cond: PlayerCondition,
    def: ConditionDef,
    forceLv: number,
  ): string | null {
    const cost = def.dispelCostBase * cond.level;
    if (player.mp < cost) {
      return `内力不足！驱散${def.name}需要 ${cost} 点内力。`;
    }

    player.mp -= cost;

    // Success chance scales with force skill vs condition level.
    const chance = Math.min(0.95, 0.3 + (forceLv / Math.max(1, cond.level)) * 0.1);
    if (Math.random() < chance) {
      this.removeCondition(player, cond.id);
      return `${def.messages.dispel}\n  你成功驱散了${def.name}。`;
    }

    // Partial progress: reduce remain.
    cond.remain = Math.max(0, cond.remain - Math.max(1, Math.floor(forceLv / 5)));
    if (cond.remain <= 0) {
      this.removeCondition(player, cond.id);
      return `${def.messages.dispel}\n  你勉强将${def.name}压制住了。`;
    }
    return `你试图运功驱散${def.name}，但只压制了一部分（剩余 ${cond.remain} tick）。`;
  }

  /**
   * Tick all conditions on a player. Should be called every condition tick interval.
   * forceLv is the player's force skill level (reduces damage and aids decay).
   */
  tick(player: Player, forceLv: number): ConditionTickResult {
    const result: ConditionTickResult = { messages: [], damageHp: 0, damageMp: 0 };
    if (!player.conditions || player.conditions.length === 0) return result;

    // Iterate backwards so we can remove safely.
    for (let i = player.conditions.length - 1; i >= 0; i--) {
      const cond = player.conditions[i];
      const def = this.defs.get(cond.id);
      if (!def) {
        player.conditions.splice(i, 1);
        continue;
      }

      // Natural damage: reduced by force skill and innate resistance.
      const resistance = Math.floor(forceLv / 10);
      const effectiveLevel = Math.max(1, cond.level - resistance);
      const damage = Math.floor(def.baseDamage * effectiveLevel);
      if (damage > 0) {
        if (def.damageType === 'hp') {
          result.damageHp += damage;
          player.hp = Math.max(0, player.hp - damage);
        } else if (def.damageType === 'mp') {
          result.damageMp += damage;
          player.mp = Math.max(0, player.mp - damage);
        }
        result.messages.push(`${def.messages.tick}（${def.name}Lv.${cond.level} 造成 ${damage} 点${def.damageType === 'hp' ? '气血' : '内力'}伤害）`);
      } else {
        result.messages.push(`${def.messages.tick}（${def.name}Lv.${cond.level}）`);
      }

      // Decay: stronger force/poison resistance reduces remain faster.
      let decay = 1;
      if (forceLv + resistance >= cond.level * 5) {
        decay += 1;
      }
      cond.remain -= decay;

      if (cond.remain <= 0) {
        player.conditions.splice(i, 1);
        result.messages.push(`${def.name} 逐渐消退了。`);
      }
    }

    return result;
  }
}
