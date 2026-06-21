import { Player, recalcPlayerStats } from '../models/Player.js';
import { ItemDef, InventoryItem, ItemType } from '../models/Item.js';
import { ConditionSystem } from './ConditionSystem.js';
import itemsData from '../data/items.json' assert { type: 'json' };

export class ItemSystem {
  private defs = new Map<string, ItemDef>();

  constructor(private conditions?: ConditionSystem) {
    for (const item of itemsData as ItemDef[]) {
      this.defs.set(item.id, item);
    }
  }

  getDef(itemId: string): ItemDef | undefined {
    return this.defs.get(itemId);
  }

  findDefByName(name: string): ItemDef | undefined {
    for (const def of this.defs.values()) {
      if (def.name === name || def.id === name) return def;
    }
    return undefined;
  }

  addItem(player: Player, itemId: string, qty: number = 1): void {
    if (!player.inventory) player.inventory = [];
    const existing = player.inventory.find((i) => i.itemId === itemId);
    if (existing) {
      existing.quantity += qty;
    } else {
      player.inventory.push({ itemId, quantity: qty });
    }
  }

  removeItem(player: Player, itemId: string, qty: number = 1): boolean {
    const idx = player.inventory?.findIndex((i) => i.itemId === itemId);
    if (idx === undefined || idx === -1) return false;
    const inv = player.inventory!;
    inv[idx].quantity -= qty;
    if (inv[idx].quantity <= 0) {
      inv.splice(idx, 1);
    }
    return true;
  }

  hasItem(player: Player, itemId: string, qty: number = 1): boolean {
    const item = player.inventory?.find((i) => i.itemId === itemId);
    return !!item && item.quantity >= qty;
  }

  /** Apply weapon/armor stat bonuses to player */
  getEquipBonus(player: Player): Partial<Record<string, number>> {
    const bonus: Record<string, number> = {};
    if (!player.equipped) return bonus;
    for (const itemId of player.equipped) {
      const def = this.defs.get(itemId);
      if (def?.attrBonus) {
        for (const [key, val] of Object.entries(def.attrBonus)) {
          if (val !== undefined) {
            bonus[key] = (bonus[key] || 0) + val;
          }
        }
      }
    }
    return bonus;
  }

  /**
   * Compute player attributes including equipment bonuses.
   * Important: permanent attribute pills should already be applied to player.attributes.
   */
  getEffectiveAttributes(player: Player): { str: number; int: number; con: number; dex: number } {
    const bonus = this.getEquipBonus(player);
    return {
      str: player.attributes.str + (bonus.str || 0),
      int: player.attributes.int + (bonus.int || 0),
      con: player.attributes.con + (bonus.con || 0),
      dex: player.attributes.dex + (bonus.dex || 0),
    };
  }

  /**
   * Apply a medicine/consumable effect. Returns a user-facing result message,
   * or null if the item is not a usable consumable.
   */
  applyConsumable(player: Player, def: ItemDef): string | null {
    const effect = def.effect || (def.hpRestore ? { hp: def.hpRestore } : undefined);
    if (!effect) return null;

    const parts: string[] = [];

    if (effect.hp) {
      const before = player.hp;
      player.hp = Math.min(player.maxHp, player.hp + effect.hp);
      const healed = player.hp - before;
      if (healed > 0) parts.push(`恢复了 ${healed} 点气血`);
    }

    if (effect.mp) {
      const before = player.mp;
      player.mp = Math.min(player.maxMp, player.mp + effect.mp);
      const restored = player.mp - before;
      if (restored > 0) parts.push(`恢复了 ${restored} 点内力`);
    }

    if (effect.cure) {
      if (this.conditions) {
        const cured = this.conditions.cureByItem(player, effect.cure);
        if (cured) {
          parts.push(`解除了 ${effect.cure} 状态`);
        } else {
          parts.push(`你并没有 ${effect.cure} 状态`);
        }
      } else {
        // Fallback if no ConditionSystem is injected (legacy/tests).
        const idx = player.conditions?.findIndex((c) => c.id === effect.cure) ?? -1;
        if (idx !== -1) {
          player.conditions.splice(idx, 1);
          parts.push(`解除了 ${effect.cure} 状态`);
        } else {
          parts.push(`你并没有 ${effect.cure} 状态`);
        }
      }
    }

    const attrKeys: Array<keyof typeof effect & ('str' | 'int' | 'con' | 'dex')> = ['str', 'int', 'con', 'dex'];
    for (const key of attrKeys) {
      const val = effect[key];
      if (val && val > 0) {
        player.attributes[key] += val;
        recalcPlayerStats(player);
        parts.push(`${key === 'str' ? '臂力' : key === 'int' ? '悟性' : key === 'con' ? '根骨' : '身法'}永久 +${val}`);
      }
    }

    if (parts.length === 0) return null;
    return `你服下了${def.name}，` + parts.join('，') + `。\n  当前气血：${player.hp}/${player.maxHp}，内力：${player.mp}/${player.maxMp}`;
  }

  formatInventory(player: Player): string {
    if (!player.inventory || player.inventory.length === 0) {
      return '\n  你身上空空如也。\n';
    }
    const lines: string[] = ['', '  ─── 背包 ───', ''];
    for (const inv of player.inventory) {
      const def = this.defs.get(inv.itemId);
      if (def) {
        const typeLabel = typeNames[def.type] || def.type;
        lines.push(`  [${typeLabel}] ${def.name} x${inv.quantity}`);
      }
    }
    if (player.equipped && player.equipped.length > 0) {
      lines.push('');
      lines.push('  ─── 装备中 ───');
      for (const itemId of player.equipped) {
        const def = this.defs.get(itemId);
        if (def) lines.push(`  ${def.name}`);
      }
    }
    return lines.join('\n') + '\n\n';
  }
}

const typeNames: Record<ItemType, string> = {
  weapon: '武',
  armor: '防',
  medicine: '药',
  misc: '杂',
};
