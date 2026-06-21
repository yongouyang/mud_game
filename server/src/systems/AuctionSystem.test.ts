import { describe, it, expect, beforeEach } from 'vitest';
import { AuctionSystem } from './AuctionSystem.js';
import { ItemSystem } from './ItemSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';
import { Scheduler } from '../time/Scheduler.js';
import { TestSystemClock } from '../time/SystemClock.js';

function makePlayer(name: string, silver: number): Player {
  const p = createPlayer(name, name, DEFAULT_ATTRIBUTES);
  p.inventory = [{ itemId: 'silver', quantity: silver }];
  return p;
}

describe('AuctionSystem', () => {
  let items: ItemSystem;
  let auction: AuctionSystem;
  let clock: TestSystemClock;

  beforeEach(() => {
    items = new ItemSystem();
    clock = new TestSystemClock(0);
    auction = new AuctionSystem(items, new Scheduler(clock));
  });

  it('lists an item for auction', () => {
    const seller = makePlayer('seller', 100);
    seller.inventory.push({ itemId: 'herb', quantity: 5 });
    const result = auction.createListing(seller, 'herb', 2, 10, 50);
    expect(result.error).toBeUndefined();
    expect(result.id).toMatch(/^A\d+$/);
    expect(items.hasItem(seller, 'herb', 3)).toBe(true);
    const listing = auction.getListing(result.id!);
    expect(listing).toBeDefined();
    expect(listing!.buyoutPrice).toBe(50);
  });

  it('rejects invalid listing parameters', () => {
    const seller = makePlayer('seller', 100);
    seller.inventory.push({ itemId: 'herb', quantity: 5 });
    expect(auction.createListing(seller, 'herb', 0, 10).error).toContain('数量');
    expect(auction.createListing(seller, 'herb', 2, 0).error).toContain('起拍价');
    expect(auction.createListing(seller, 'herb', 2, 10, 0).error).toContain('一口价');
    expect(auction.createListing(seller, 'dragon-sword', 1, 10).error).toContain('没有');
    seller.inventory = [{ itemId: 'silver', quantity: 100 }];
    expect(auction.createListing(seller, 'herb', 1, 10).error).toContain('身上没有');
  });

  it('accepts bids and refunds previous bidder', () => {
    const seller = makePlayer('seller', 0);
    seller.inventory.push({ itemId: 'herb', quantity: 1 });
    const { id } = auction.createListing(seller, 'herb', 1, 10);

    const bidderA = makePlayer('a', 100);
    expect(auction.bid(bidderA, id!, 10)).toBeNull();
    expect(items.hasItem(bidderA, 'silver', 90)).toBe(true);
    expect(auction.getBidHold('a')).toBe(10);

    const bidderB = makePlayer('b', 100);
    expect(auction.bid(bidderB, id!, 20)).toBeNull();
    // Previous bidder's hold is cleared; the silver remains reserved in the system.
    expect(auction.getBidHold('a')).toBe(0);
    expect(auction.getBidHold('b')).toBe(20);

    const listing = auction.getListing(id!);
    expect(listing!.currentBid).toBe(20);
    expect(listing!.highestBidderId).toBe('b');
  });

  it('rejects invalid bids', () => {
    const seller = makePlayer('seller', 0);
    seller.inventory.push({ itemId: 'herb', quantity: 1 });
    const { id } = auction.createListing(seller, 'herb', 1, 10);

    expect(auction.bid(seller, id!, 20)).toContain('自己的');
    const bidder = makePlayer('bid', 100);
    expect(auction.bid(bidder, 'A999', 20)).toContain('没有');
    expect(auction.bid(bidder, id!, 5)).toContain('起拍价');
    expect(auction.bid(bidder, id!, 10)).toBeNull();
    expect(auction.bid(bidder, id!, 10)).toContain('高于当前价');
    expect(auction.bid(bidder, id!, 200)).toContain('银子');
  });

  it('supports buyout', () => {
    const seller = makePlayer('seller', 0);
    seller.inventory.push({ itemId: 'herb', quantity: 1 });
    const { id } = auction.createListing(seller, 'herb', 1, 10, 50);

    const buyer = makePlayer('buyer', 100);
    expect(auction.buyout(buyer, id!)).toBeNull();
    expect(items.hasItem(buyer, 'herb', 1)).toBe(true);
    expect(items.hasItem(buyer, 'silver', 50)).toBe(true);
    expect(auction.getListing(id!)).toBeUndefined();
  });

  it('rejects invalid buyout', () => {
    const seller = makePlayer('seller', 0);
    seller.inventory.push({ itemId: 'herb', quantity: 1 });
    const { id } = auction.createListing(seller, 'herb', 1, 10);

    expect(auction.buyout(seller, id!)).toContain('自己的');
    const buyer = makePlayer('buyer', 100);
    expect(auction.buyout(buyer, 'A999')).toContain('没有');
    expect(auction.buyout(buyer, id!)).toContain('一口价');

    const withMoney = makePlayer('money', 20);
    seller.inventory.push({ itemId: 'herb', quantity: 1 });
    const { id: id2 } = auction.createListing(seller, 'herb', 1, 10, 50);
    expect(auction.buyout(withMoney, id2!)).toContain('银子');
  });

  it('finalizes a listing and releases bid hold', () => {
    const seller = makePlayer('seller', 0);
    seller.inventory.push({ itemId: 'herb', quantity: 1 });
    const { id } = auction.createListing(seller, 'herb', 1, 10);

    const bidder = makePlayer('bidder', 100);
    auction.bid(bidder, id!, 20);
    auction.finalizeListing(id!);

    expect(auction.getListing(id!)).toBeUndefined();
    expect(auction.getBidHold('bidder')).toBe(0);
  });

  it('formats empty and populated listings', () => {
    expect(auction.formatListings()).toContain('当前没有拍卖物品');
    const seller = makePlayer('seller', 0);
    seller.inventory.push({ itemId: 'herb', quantity: 1 });
    auction.createListing(seller, 'herb', 1, 10, 50);
    const formatted = auction.formatListings();
    expect(formatted).toContain('草药');
    expect(formatted).toContain('起拍 10 两');
    expect(formatted).toContain('一口价 50 两');
  });
});
