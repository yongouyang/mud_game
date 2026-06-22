import { describe, it, expect, beforeEach } from 'vitest';
import { ItemSystem } from './ItemSystem.js';
import { ConditionSystem } from './ConditionSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';
import { TestSystemClock } from '../time/SystemClock.js';

function makePlayer(name: string): Player {
  return createPlayer('test', name, DEFAULT_ATTRIBUTES);
}

describe('ItemSystem', () => {
  let sys: ItemSystem;
  let sysWithConditions: ItemSystem;
  let conditions: ConditionSystem;

  beforeEach(() => {
    sys = new ItemSystem();
    conditions = new ConditionSystem(new TestSystemClock(0));
    sysWithConditions = new ItemSystem(conditions);
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

  it('returns item count and 0 for missing items', () => {
    const p = makePlayer('test');
    sys.addItem(p, 'silver', 7);
    expect(sys.getItemCount(p, 'silver')).toBe(7);
    expect(sys.getItemCount(p, 'gold')).toBe(0);
  });

  it('computes effective attributes with equipment bonus', () => {
    const p = makePlayer('test');
    p.equipped.push('iron-sword');
    const attrs = sys.getEffectiveAttributes(p);
    expect(attrs.str).toBe(p.attributes.str + 8);
  });

  it('applies consumable HP/MP restore', () => {
    const p = makePlayer('test');
    p.hp = 10;
    p.mp = 10;
    const jin = sys.getDef('jinchuang-yao')!;
    const msg = sys.applyConsumable(p, jin);
    expect(msg).toContain('恢复了');
    expect(p.hp).toBeGreaterThan(10);
  });

  it('applies consumable attribute boost', () => {
    const p = makePlayer('test');
    const strBefore = p.attributes.str;
    const pill = sys.getDef('str-dan')!;
    const msg = sys.applyConsumable(p, pill);
    expect(msg).toBeTruthy();
    expect(p.attributes.str).toBe(strBefore + 1);
  });

  it('cures condition by category via fallback', () => {
    const p = makePlayer('test');
    p.conditions = [{ id: 'poison', category: 'poison', level: 1, appliedAt: 0 }];
    const jiedu = sys.getDef('jiedu-wan')!;
    const msg = sys.applyConsumable(p, jiedu);
    expect(msg).toContain('解除');
    expect(p.conditions).toHaveLength(0);
  });

  it('cures condition by id when ConditionSystem is injected', () => {
    const p = makePlayer('test');
    conditions.applyCondition(p, 'poison', 1);
    const antidote = sys.getDef('jiedu-wan')!;
    const msg = sysWithConditions.applyConsumable(p, antidote);
    expect(msg).toContain('解除');
    expect(p.conditions).toHaveLength(0);
  });

  it('reports missing condition when ConditionSystem is injected', () => {
    const p = makePlayer('test');
    const antidote = sys.getDef('jiedu-wan')!;
    const msg = sysWithConditions.applyConsumable(p, antidote);
    expect(msg).toContain('并没有');
  });

  it('returns null for items with no usable effect', () => {
    const p = makePlayer('test');
    const misc = sys.getDef('silver')!;
    expect(sys.applyConsumable(p, misc)).toBeNull();
  });

  it('reports missing cure id when ConditionSystem is injected', () => {
    const p = makePlayer('test');
    const curePill = { name: '解毒丹', effect: { cure: 'poison' } } as any;
    const msg = sysWithConditions.applyConsumable(p, curePill);
    expect(msg).toContain('并没有 poison 状态');
  });

  it('reports missing cure id via fallback', () => {
    const p = makePlayer('test');
    const curePill = { name: '解毒丹', effect: { cure: 'poison' } } as any;
    const msg = sys.applyConsumable(p, curePill);
    expect(msg).toContain('并没有 poison 状态');
  });

  it('reports missing cure category via fallback', () => {
    const p = makePlayer('test');
    const catPill = { name: '万灵丹', effect: { cureCategory: 'poison' } } as any;
    const msg = sys.applyConsumable(p, catPill);
    expect(msg).toContain('并没有 poison 类异常状态');
  });
});
