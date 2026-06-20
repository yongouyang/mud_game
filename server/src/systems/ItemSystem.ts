import { Player } from '../models/Player.js';
import { ItemDef, InventoryItem, ItemType } from '../models/Item.js';
import itemsData from '../data/items.json' assert { type: 'json' };

export class ItemSystem {
  private defs = new Map<string, ItemDef>();

  constructor() {
    for (const item of itemsData as ItemDef[]) {
      this.defs.set(item.id, item);
    }
  }

  getDef(itemId: string): ItemDef | undefined {
    return this.defs.get(itemId);
  }

  findDefByName(name: string): ItemDef | undefined {
    for (const def of this.defs.values()) {
      if (def.name === name) return def;
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
          bonus[key] = (bonus[key] || 0) + val;
        }
      }
    }
    return bonus;
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
