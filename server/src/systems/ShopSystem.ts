import { Player } from '../models/Player.js';
import { ItemSystem } from './ItemSystem.js';
import shopsData from '../data/shops.json' assert { type: 'json' };

export interface ShopDef {
  id: string;
  name: string;
  roomId: string | null;
  npcName: string | null;
  items: Record<string, number>;
  buybackRate: number;
}

export class ShopSystem {
  private shops: ShopDef[];

  constructor(private items: ItemSystem) {
    this.shops = (shopsData as ShopDef[]).map((s) => ({ ...s }));
  }

  private findShopForRoom(roomId: string): ShopDef | undefined {
    const roomShop = this.shops.find((s) => s.roomId === roomId);
    if (roomShop) return roomShop;
    return this.shops.find((s) => s.roomId === null);
  }

  getShopInRoom(roomId: string): ShopDef | undefined {
    return this.findShopForRoom(roomId);
  }

  getPrice(shop: ShopDef, itemId: string): number | undefined {
    return shop.items[itemId];
  }

  buy(player: Player, roomId: string, itemName: string): string | null {
    const shop = this.findShopForRoom(roomId);
    if (!shop) return '这里没有商店。';
    const def = this.items.findDefByName(itemName);
    if (!def) return `没有"${itemName}"这种物品。`;
    const price = shop.items[def.id];
    if (price === undefined) return `本店不出售${def.name}。`;
    if (!this.items.hasItem(player, 'silver', price)) {
      return `你只有 ${player.inventory?.find((i) => i.itemId === 'silver')?.quantity || 0} 两银子，不足购买${def.name}。`;
    }
    this.items.removeItem(player, 'silver', price);
    this.items.addItem(player, def.id);
    return `你花 ${price} 两银子买了${def.name}。`;
  }

  sell(player: Player, roomId: string, itemName: string, qty: number = 1): string | null {
    const shop = this.findShopForRoom(roomId);
    if (!shop) return '这里没有商人收购物品。';
    const def = this.items.findDefByName(itemName);
    if (!def) return `没有"${itemName}"这种物品。`;
    if (def.id === 'silver') return '银子不能直接出售。';
    if (!this.items.hasItem(player, def.id, qty)) {
      return `你身上没有 ${qty} 个${def.name}。`;
    }
    const shopPrice = shop.items[def.id];
    const unitPrice = shopPrice !== undefined ? shopPrice : 10;
    const total = Math.max(1, Math.floor(unitPrice * shop.buybackRate * qty));
    this.items.removeItem(player, def.id, qty);
    this.items.addItem(player, 'silver', total);
    return `你把 ${qty} 个${def.name}卖给了${shop.name}，获得 ${total} 两银子。`;
  }

  formatShop(player: Player, roomId: string): string {
    const shop = this.findShopForRoom(roomId);
    if (!shop) return '\n  这里没有商店。\n';
    const lines: string[] = ['', `  ─── ${shop.name} · 商店 ───`, ''];
    const npc = shop.npcName ? `（掌柜：${shop.npcName}）` : '';
    if (npc) lines.push(`  ${npc}`);
    lines.push('  货物：');
    for (const [itemId, price] of Object.entries(shop.items)) {
      const def = this.items.getDef(itemId);
      if (!def) continue;
      lines.push(`    ${def.name} — ${price} 两`);
    }
    lines.push('');
    lines.push(`  回购折扣：${Math.round(shop.buybackRate * 100)}%`);
    lines.push('');
    lines.push('  用法：buy <物品名>    购买');
    lines.push('        sell <物品名> [数量]  出售');
    lines.push('');
    return lines.join('\n') + '\n';
  }
}
