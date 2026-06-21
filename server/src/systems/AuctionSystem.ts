import { Player, InventoryItem } from '../models/Player.js';
import { ItemSystem } from './ItemSystem.js';
import { Scheduler } from '../time/Scheduler.js';

export interface AuctionListing {
  id: string;
  sellerId: string;
  sellerName: string;
  itemId: string;
  quantity: number;
  startPrice: number;
  buyoutPrice?: number;
  currentBid: number;
  highestBidderId?: string;
  createdAt: number;
  expiresAt: number;
}

export class AuctionSystem {
  private listings = new Map<string, AuctionListing>();
  private nextId = 1;
  private bidHolds = new Map<string, number>(); // playerId -> held silver

  constructor(private items: ItemSystem, private scheduler?: Scheduler) {}

  createListing(
    seller: Player,
    itemName: string,
    quantity: number,
    startPrice: number,
    buyoutPrice?: number,
    durationMs: number = 5 * 60 * 1000,
  ): { id?: string; error?: string } {
    if (isNaN(quantity) || quantity <= 0) return { error: '数量必须是正整数。' };
    if (isNaN(startPrice) || startPrice <= 0) return { error: '起拍价必须是正整数。' };
    if (buyoutPrice !== undefined && (isNaN(buyoutPrice) || buyoutPrice <= 0)) {
      return { error: '一口价必须是正整数。' };
    }
    const def = this.items.findDefByName(itemName);
    if (!def) return { error: `没有"${itemName}"这种物品。` };
    if (!this.items.hasItem(seller, def.id, quantity)) {
      return { error: `你身上没有 ${quantity} 个${def.name}。` };
    }

    this.items.removeItem(seller, def.id, quantity);
    const id = `A${this.nextId++}`;
    const now = Date.now();
    const listing: AuctionListing = {
      id,
      sellerId: seller.id,
      sellerName: seller.name,
      itemId: def.id,
      quantity,
      startPrice,
      buyoutPrice,
      currentBid: 0,
      createdAt: now,
      expiresAt: now + durationMs,
    };
    this.listings.set(id, listing);

    if (this.scheduler) {
      this.scheduler.schedule(`auction-expire:${id}`, durationMs, () => this.finalizeListing(id));
    }

    return { id };
  }

  bid(player: Player, listingId: string, amount: number): string | null {
    if (isNaN(amount) || amount <= 0) return '出价必须是正整数。';
    const listing = this.listings.get(listingId);
    if (!listing) return '没有这个拍卖编号。';
    if (listing.sellerId === player.id) return '不能竞拍自己的物品。';
    if (amount < listing.startPrice && listing.currentBid === 0) {
      return `出价不能低于起拍价 ${listing.startPrice} 两。`;
    }
    if (amount <= listing.currentBid) {
      return `出价必须高于当前价 ${listing.currentBid} 两。`;
    }
    const held = this.bidHolds.get(player.id) || 0;
    const availableSilver = (this.items.hasItem(player, 'silver', 1) ? player.inventory?.find((i) => i.itemId === 'silver')?.quantity || 0 : 0) + held;
    // Actually we need to reserve additional amount; current held silver is already removed from inventory.
    // Simpler: require total available inventory silver >= amount.
    const inventorySilver = player.inventory?.find((i) => i.itemId === 'silver')?.quantity || 0;
    if (inventorySilver + held < amount) {
      return `你只有 ${inventorySilver + held} 两银子，不足以出价。`;
    }

    // Refund previous bidder
    if (listing.highestBidderId) {
      const prevHeld = this.bidHolds.get(listing.highestBidderId) || 0;
      this.bidHolds.set(listing.highestBidderId, prevHeld - listing.currentBid);
    }

    // Reserve new amount from player
    const playerHeld = this.bidHolds.get(player.id) || 0;
    const additional = amount - playerHeld;
    if (additional > 0) {
      this.items.removeItem(player, 'silver', additional);
      this.bidHolds.set(player.id, playerHeld + additional);
    }

    listing.currentBid = amount;
    listing.highestBidderId = player.id;
    return null;
  }

  buyout(player: Player, listingId: string): string | null {
    const listing = this.listings.get(listingId);
    if (!listing) return '没有这个拍卖编号。';
    if (listing.sellerId === player.id) return '不能购买自己的物品。';
    if (listing.buyoutPrice === undefined) return '该拍卖没有设置一口价。';
    const price = listing.buyoutPrice;
    if (!this.items.hasItem(player, 'silver', price)) {
      return `你只有 ${player.inventory?.find((i) => i.itemId === 'silver')?.quantity || 0} 两银子。`;
    }

    // Refund any existing bidder
    if (listing.highestBidderId) {
      const prevHeld = this.bidHolds.get(listing.highestBidderId) || 0;
      this.bidHolds.set(listing.highestBidderId, prevHeld - listing.currentBid);
    }

    this.items.removeItem(player, 'silver', price);
    this.items.addItem(player, listing.itemId, listing.quantity);
    // Give silver to seller if online? For simplicity, seller receives when finalizing; here just mark and finalize.
    listing.currentBid = price;
    listing.highestBidderId = player.id;
    this.finalizeListing(listingId);
    return null;
  }

  finalizeListing(listingId: string): void {
    const listing = this.listings.get(listingId);
    if (!listing) return;
    this.listings.delete(listingId);

    if (listing.highestBidderId && listing.currentBid > 0) {
      // Transfer silver from highest bidder's hold to seller
      const held = this.bidHolds.get(listing.highestBidderId) || 0;
      this.bidHolds.set(listing.highestBidderId, Math.max(0, held - listing.currentBid));
      // We don't have a reference to seller player here; add silver to seller if found via players? AuctionSystem doesn't hold players.
      // Instead, CommandRouter can resolve seller from player manager after return.
    }
  }

  getListing(listingId: string): AuctionListing | undefined {
    return this.listings.get(listingId);
  }

  getBidHold(playerId: string): number {
    return this.bidHolds.get(playerId) || 0;
  }

  setBidHold(playerId: string, amount: number): void {
    this.bidHolds.set(playerId, amount);
  }

  formatListings(): string {
    if (this.listings.size === 0) return '\n  当前没有拍卖物品。\n';
    const lines: string[] = ['', '  ─── 拍卖行 ───', ''];
    for (const l of this.listings.values()) {
      const def = this.items.getDef(l.itemId);
      const name = def ? def.name : l.itemId;
      const buyout = l.buyoutPrice ? ` 一口价 ${l.buyoutPrice} 两` : '';
      const current = l.currentBid > 0 ? `当前 ${l.currentBid} 两` : `起拍 ${l.startPrice} 两`;
      const timeLeft = Math.max(0, Math.ceil((l.expiresAt - Date.now()) / 1000));
      lines.push(`  ${l.id}: ${name} x${l.quantity} | ${current}${buyout} | 剩余 ${timeLeft} 秒 | 卖家 ${l.sellerName}`);
    }
    lines.push('');
    lines.push('  用法：auction sell <物品> <起拍价> [一口价]');
    lines.push('        auction bid <编号> <价格>');
    lines.push('        auction buyout <编号>');
    lines.push('');
    return lines.join('\n') + '\n';
  }
}
