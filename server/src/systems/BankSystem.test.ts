import { describe, it, expect, beforeEach } from 'vitest';
import { BankSystem } from './BankSystem.js';
import { ItemSystem } from './ItemSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

function makePlayer(name: string): Player {
  return createPlayer(name, name, DEFAULT_ATTRIBUTES);
}

describe('BankSystem', () => {
  let items: ItemSystem;
  let bank: BankSystem;
  let player: Player;

  beforeEach(() => {
    items = new ItemSystem();
    bank = new BankSystem(items);
    player = makePlayer('p');
    player.inventory = [
      { itemId: 'silver', quantity: 100 },
      { itemId: 'herb', quantity: 3 },
    ];
  });

  it('deposits and withdraws silver', () => {
    expect(bank.depositSilver(player, 50)).toBeNull();
    expect(player.bankSilver).toBe(50);
    expect(items.hasItem(player, 'silver', 50)).toBe(true);

    expect(bank.withdrawSilver(player, 20)).toBeNull();
    expect(player.bankSilver).toBe(30);
    expect(items.hasItem(player, 'silver', 70)).toBe(true);
  });

  it('deposits and withdraws items', () => {
    expect(bank.depositItem(player, 'herb', 2)).toBeNull();
    expect(items.hasItem(player, 'herb', 1)).toBe(true);
    expect(player.bankInventory).toHaveLength(1);
    expect(player.bankInventory[0]).toEqual({ itemId: 'herb', quantity: 2 });

    expect(bank.withdrawItem(player, 'herb', 1)).toBeNull();
    expect(items.hasItem(player, 'herb', 2)).toBe(true);
    expect(player.bankInventory[0].quantity).toBe(1);

    expect(bank.withdrawItem(player, 'herb', 1)).toBeNull();
    expect(items.hasItem(player, 'herb', 3)).toBe(true);
    expect(player.bankInventory).toHaveLength(0);
  });

  it('rejects invalid silver operations', () => {
    expect(bank.depositSilver(player, 0)).toContain('正整数');
    expect(bank.depositSilver(player, 200)).toContain('没有');
    expect(bank.withdrawSilver(player, 0)).toContain('正整数');
    expect(bank.withdrawSilver(player, 1)).toContain('只有 0');
  });

  it('rejects invalid item operations', () => {
    expect(bank.depositItem(player, 'dragon-sword', 1)).toContain('没有');
    expect(bank.depositItem(player, 'silver', 10)).toContain('deposit silver');
    expect(bank.depositItem(player, 'herb', 10)).toContain('身上没有');

    expect(bank.withdrawItem(player, 'herb', 1)).toContain('钱庄里没有');
    player.bankInventory = [{ itemId: 'herb', quantity: 1 }];
    expect(bank.withdrawItem(player, 'dragon-sword', 1)).toContain('没有');
    expect(bank.withdrawItem(player, 'silver', 1)).toContain('withdraw silver');
    expect(bank.withdrawItem(player, 'herb', 5)).toContain('钱庄里没有');
  });

  it('formats empty and populated bank', () => {
    expect(bank.formatBank(player)).toContain('无存物');
    bank.depositSilver(player, 50);
    bank.depositItem(player, 'herb', 2);
    const formatted = bank.formatBank(player);
    expect(formatted).toContain('存银: 50 两');
    expect(formatted).toContain('草药');
  });
});
