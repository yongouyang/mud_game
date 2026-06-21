import { describe, it, expect, beforeEach } from 'vitest';
import { ShopSystem } from './ShopSystem.js';
import { ItemSystem } from './ItemSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

function makePlayer(name: string, silver: number): Player {
  const p = createPlayer(name, name, DEFAULT_ATTRIBUTES);
  p.inventory = [{ itemId: 'silver', quantity: silver }];
  return p;
}

describe('ShopSystem', () => {
  let items: ItemSystem;
  let shops: ShopSystem;

  beforeEach(() => {
    items = new ItemSystem();
    shops = new ShopSystem(items);
  });

  it('finds the town shop in the correct room', () => {
    expect(shops.getShopInRoom('town/square')).toBeDefined();
    // The general shop has roomId: null, so it acts as a fallback everywhere.
    expect(shops.getShopInRoom('wilderness/forest1')).toBeDefined();
  });

  it('buys an item from a shop', () => {
    const player = makePlayer('p', 100);
    const result = shops.buy(player, 'town/square', '金疮药');
    expect(result).toContain('买了');
    expect(items.hasItem(player, 'jinchuang-yao', 1)).toBe(true);
    expect(items.hasItem(player, 'silver', 70)).toBe(true);
  });

  it('rejects buy when item is unavailable or unaffordable', () => {
    const player = makePlayer('p', 100);
    expect(shops.buy(player, 'wilderness/forest1', '龙剑')).toContain('没有');
    expect(shops.buy(player, 'town/square', '龙剑')).toContain('没有');
    expect(shops.buy(player, 'town/square', '解毒丸')).toContain('不出售');

    const poor = makePlayer('poor', 1);
    expect(shops.buy(poor, 'town/square', '金疮药')).toContain('银子');
  });

  it('sells an item back to the shop', () => {
    const player = makePlayer('p', 0);
    player.inventory.push({ itemId: 'herb', quantity: 5 });
    const result = shops.sell(player, 'town/square', 'herb', 2);
    expect(result).toContain('卖给');
    expect(items.hasItem(player, 'herb', 3)).toBe(true);
    expect(items.getItemCount(player, 'silver')).toBeGreaterThan(0);
  });

  it('rejects invalid sell attempts', () => {
    const player = makePlayer('p', 0);
    expect(shops.sell(player, 'wilderness/forest1', '龙剑', 1)).toContain('没有');
    expect(shops.sell(player, 'town/square', '龙剑', 1)).toContain('没有');
    expect(shops.sell(player, 'town/square', 'silver', 1)).toContain('银子不能直接');
    expect(shops.sell(player, 'town/square', 'herb', 1)).toContain('身上没有');
  });

  it('formats a shop', () => {
    const player = makePlayer('p', 0);
    const formatted = shops.formatShop(player, 'town/square');
    expect(formatted).toContain('货物');
    expect(formatted).toContain('金疮药');
    expect(shops.formatShop(player, 'wilderness/forest1')).toContain('杂货铺');
  });
});
