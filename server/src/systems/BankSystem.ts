import { Player } from '../models/Player.js';
import { InventoryItem } from '../models/Item.js';
import { ItemSystem } from './ItemSystem.js';

export class BankSystem {
  constructor(private items: ItemSystem) {}

  depositItem(player: Player, name: string, qty: number = 1): string | null {
    const def = this.items.findDefByName(name);
    if (!def) return `没有"${name}"这种物品。`;
    if (def.id === 'silver') return `请用 "deposit silver <数量>" 存银子。`;
    if (!this.items.hasItem(player, def.id, qty)) return `你身上没有 ${qty} 个${def.name}。`;
    this.items.removeItem(player, def.id, qty);
    const existing = player.bankInventory.find((i) => i.itemId === def.id);
    if (existing) {
      existing.quantity += qty;
    } else {
      player.bankInventory.push({ itemId: def.id, quantity: qty });
    }
    return null;
  }

  withdrawItem(player: Player, name: string, qty: number = 1): string | null {
    const def = this.items.findDefByName(name);
    if (!def) return `没有"${name}"这种物品。`;
    if (def.id === 'silver') return `请用 "withdraw silver <数量>" 取银子。`;
    const existing = player.bankInventory.find((i) => i.itemId === def.id);
    if (!existing || existing.quantity < qty) return `钱庄里没有 ${qty} 个${def.name}。`;
    existing.quantity -= qty;
    if (existing.quantity <= 0) {
      player.bankInventory = player.bankInventory.filter((i) => i.itemId !== def.id);
    }
    this.items.addItem(player, def.id, qty);
    return null;
  }

  depositSilver(player: Player, qty: number): string | null {
    if (isNaN(qty) || qty <= 0) return '数量必须是正整数。';
    if (!this.items.hasItem(player, 'silver', qty)) return `你身上没有 ${qty} 两银子。`;
    this.items.removeItem(player, 'silver', qty);
    player.bankSilver += qty;
    return null;
  }

  withdrawSilver(player: Player, qty: number): string | null {
    if (isNaN(qty) || qty <= 0) return '数量必须是正整数。';
    if (player.bankSilver < qty) return `钱庄里只有 ${player.bankSilver} 两银子。`;
    player.bankSilver -= qty;
    this.items.addItem(player, 'silver', qty);
    return null;
  }

  formatBank(player: Player): string {
    const lines: string[] = ['', '  ─── 钱庄 ───', ''];
    lines.push(`  存银: ${player.bankSilver} 两`);
    lines.push('');
    if (player.bankInventory.length === 0) {
      lines.push('  无存物');
    } else {
      lines.push('  存物:');
      for (const inv of player.bankInventory) {
        const def = this.items.getDef(inv.itemId);
        if (def) lines.push(`    ${def.name} x${inv.quantity}`);
      }
    }
    lines.push('');
    lines.push('  用法：');
    lines.push('    deposit <物品> [数量]      存入物品');
    lines.push('    deposit silver <数量>      存入银子');
    lines.push('    withdraw <物品> [数量]     取出物品');
    lines.push('    withdraw silver <数量>     取出银子');
    lines.push('');
    return lines.join('\n') + '\n';
  }
}
