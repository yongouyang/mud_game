import { describe, it, expect, beforeEach } from 'vitest';
import { ItemSystem } from './ItemSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

function makePlayer(name: string): Player {
  return createPlayer('test', name, DEFAULT_ATTRIBUTES);
}

describe('ItemSystem', () => {
  let sys: ItemSystem;

  beforeEach(() => {
    sys = new ItemSystem();
  });

  it('finds item definitions by id', () => {
    expect(sys.getDef('jinchuang-yao')?.name).toBe('金疮药');
    expect(sys.getDef('nonexistent')).toBeUndefined();
  });

  it('finds item by Chinese name', () => {
    expect(sys.findDefByName('铁剑')?.id).toBe('iron-sword');
    expect(sys.findDefByName('不存在')).toBeUndefined();
  });

  it('adds items to player inventory', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'jinchuang-yao', 3);
    expect(p.inventory).toHaveLength(1);
    expect(p.inventory[0].itemId).toBe('jinchuang-yao');
    expect(p.inventory[0].quantity).toBe(3);
  });

  it('stacks same items', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'silver', 5);
    sys.addItem(p, 'silver', 3);
    expect(p.inventory).toHaveLength(1);
    expect(p.inventory[0].quantity).toBe(8);
  });

  it('removes items from inventory', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'silver', 5);
    sys.removeItem(p, 'silver', 2);
    expect(p.inventory[0].quantity).toBe(3);
  });

  it('removes stack when quantity reaches zero', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'silver', 2);
    sys.removeItem(p, 'silver', 2);
    expect(p.inventory).toHaveLength(0);
  });

  it('checks if player has item', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'silver', 3);
    expect(sys.hasItem(p, 'silver', 2)).toBe(true);
    expect(sys.hasItem(p, 'silver', 5)).toBe(false);
    expect(sys.hasItem(p, 'gold')).toBe(false);
  });

  it('returns false when removing non-existent item', () => {
    const p = makePlayer('test');
    expect(sys.removeItem(p, 'silver')).toBe(false);
  });

  it('computes equip bonuses from weapon and armor', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'iron-sword');
    sys.addItem(p, 'leather-armor');
    p.equipped.push('iron-sword');
    p.equipped.push('leather-armor');
    const bonus = sys.getEquipBonus(p);
    expect(bonus.str).toBe(8);
    expect(bonus.con).toBe(5);
  });

  it('formats empty inventory', () => {
    const p = makePlayer('test');
    expect(sys.formatInventory(p)).toContain('空空如也');
  });

  it('formats inventory with items and equipped', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'wooden-sword');
    sys.addItem(p, 'jinchuang-yao', 2);
    p.equipped.push('wooden-sword');
    const out = sys.formatInventory(p);
    expect(out).toContain('木剑');
    expect(out).toContain('金疮药');
    expect(out).toContain('装备中');
  });
});
