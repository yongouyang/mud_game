import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { ItemSystem } from '../systems/ItemSystem.js';
import { AuctionSystem } from '../systems/AuctionSystem.js';
import { createTestContext } from '../test-utils.js';

const SELLER_ID = 'eco-seller';
const BUYER_ID = 'eco-buyer';

describe('Economy commands', () => {
  let router: CommandRouter;
  let players: PlayerManager;
  let items: ItemSystem;
  let auction: AuctionSystem;

  function cmd(id: string, input: string): string {
    return router.handle(input, id);
  }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    items = ctx.items;
    auction = ctx.auction;

    players.createPlayer(SELLER_ID);
    cmd(SELLER_ID, '楚留香'); cmd(SELLER_ID, 'done');
    players.createPlayer(BUYER_ID);
    cmd(BUYER_ID, '李寻欢'); cmd(BUYER_ID, 'done');
  });

  describe('Bank', () => {
    it('bank command shows empty bank', () => {
      expect(cmd(SELLER_ID, 'bank')).toContain('钱庄');
      expect(cmd(SELLER_ID, 'bank')).toContain('无存物');
    });

    it('deposits and withdraws silver', () => {
      const p = players.getPlayer(SELLER_ID)!;
      items.addItem(p, 'silver', 100);
      expect(cmd(SELLER_ID, 'deposit silver 50')).toContain('存入了 50 两银子');
      expect(p.bankSilver).toBe(50);
      expect(cmd(SELLER_ID, 'withdraw silver 20')).toContain('取出了 20 两银子');
      expect(p.bankSilver).toBe(30);
    });

    it('deposits and withdraws items', () => {
      const p = players.getPlayer(SELLER_ID)!;
      items.addItem(p, 'iron-ore', 5);
      expect(cmd(SELLER_ID, 'deposit 铁矿 3')).toContain('存入了 3 个铁矿');
      expect(items.hasItem(p, 'iron-ore', 2)).toBe(true);
      expect(cmd(SELLER_ID, 'withdraw 铁矿 1')).toContain('取出了 1 个铁矿');
      expect(items.hasItem(p, 'iron-ore', 3)).toBe(true);
    });

    it('rejects withdrawing more than stored', () => {
      expect(cmd(SELLER_ID, 'withdraw silver 1')).toContain('只有');
    });
  });

  describe('Shop', () => {
    it('shows shop list', () => {
      expect(cmd(SELLER_ID, 'shop')).toContain('商店');
      expect(cmd(SELLER_ID, 'list')).toContain('木剑');
    });

    it('buys an item when player has silver', () => {
      const p = players.getPlayer(SELLER_ID)!;
      items.addItem(p, 'silver', 100);
      expect(cmd(SELLER_ID, 'buy 金疮药')).toContain('买了');
      expect(items.hasItem(p, 'jinchuang-yao', 1)).toBe(true);
    });

    it('rejects buying without enough silver', () => {
      expect(cmd(SELLER_ID, 'buy 铁剑')).toContain('不足');
    });

    it('sells an item for silver', () => {
      const p = players.getPlayer(SELLER_ID)!;
      items.addItem(p, 'iron-ore', 2);
      const result = cmd(SELLER_ID, 'sell 铁矿 2');
      expect(result).toContain('卖给了');
      expect(result).toContain('两银子');
      expect(items.hasItem(p, 'iron-ore', 1)).toBe(false);
    });
  });

  describe('Auction', () => {
    it('shows empty auction list', () => {
      expect(cmd(SELLER_ID, 'auction')).toContain('没有拍卖');
    });

    it('creates a listing and bids on it', () => {
      const seller = players.getPlayer(SELLER_ID)!;
      items.addItem(seller, 'leather', 1);
      expect(cmd(SELLER_ID, 'auction sell 皮革 10 50')).toContain('上架了');

      const buyer = players.getPlayer(BUYER_ID)!;
      items.addItem(buyer, 'silver', 100);
      expect(cmd(BUYER_ID, 'auction bid A1 15')).toContain('出价 15 两');
      expect(auction.getListing('A1')?.currentBid).toBe(15);
    });

    it('buyout transfers the item', () => {
      const seller = players.getPlayer(SELLER_ID)!;
      items.addItem(seller, 'herb', 2);
      expect(cmd(SELLER_ID, 'auction sell 草药 5 30')).toContain('上架了');

      const buyer = players.getPlayer(BUYER_ID)!;
      items.addItem(buyer, 'silver', 50);
      expect(cmd(BUYER_ID, 'auction buyout A1')).toContain('一口价');
      expect(items.hasItem(buyer, 'herb', 1)).toBe(true);
    });

    it('prevents bidding on own listing', () => {
      const seller = players.getPlayer(SELLER_ID)!;
      items.addItem(seller, 'iron-ore', 1);
      items.addItem(seller, 'silver', 100);
      cmd(SELLER_ID, 'auction sell 铁矿 10');
      expect(cmd(SELLER_ID, 'auction bid A1 20')).toContain('不能竞拍');
    });
  });

  describe('Crafting', () => {
    it('lists recipes', () => {
      expect(cmd(SELLER_ID, 'craft')).toContain('铁剑');
      expect(cmd(SELLER_ID, 'craft')).toContain('金疮药');
    });

    it('crafts an item when materials are present', () => {
      const p = players.getPlayer(SELLER_ID)!;
      items.addItem(p, 'iron-ore', 3);
      items.addItem(p, 'leather', 1);
      expect(cmd(SELLER_ID, 'craft 铁剑')).toContain('成功制作出');
      expect(items.hasItem(p, 'iron-sword', 1)).toBe(true);
      expect(items.hasItem(p, 'iron-ore', 1)).toBe(false);
    });

    it('fails when materials are missing', () => {
      expect(cmd(SELLER_ID, 'craft 铁剑')).toContain('制作失败');
    });
  });
});
