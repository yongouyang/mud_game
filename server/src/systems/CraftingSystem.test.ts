import { describe, it, expect, beforeEach } from 'vitest';
import { CraftingSystem } from './CraftingSystem.js';
import { ItemSystem } from './ItemSystem.js';
import { SkillSystem } from './SkillSystem.js';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

function makePlayer(): Player {
  return createPlayer('test', 'test', DEFAULT_ATTRIBUTES);
}

describe('CraftingSystem', () => {
  let items: ItemSystem;
  let skills: SkillSystem;
  let craft: CraftingSystem;

  beforeEach(() => {
    items = new ItemSystem();
    skills = new SkillSystem();
    craft = new CraftingSystem(items, skills);
  });

  it('crafts an iron sword when materials are present', () => {
    const player = makePlayer();
    items.addItem(player, 'iron-ore', 3);
    items.addItem(player, 'leather', 1);

    const result = craft.craft(player, '铁剑');
    expect(result.success).toBe(true);
    expect(result.message).toContain('铁剑');
    expect(items.hasItem(player, 'iron-sword', 1)).toBe(true);
    expect(items.hasItem(player, 'iron-ore', 3)).toBe(false);
  });

  it('fails when recipe does not exist', () => {
    const player = makePlayer();
    const result = craft.craft(player, '神龙剑');
    expect(result.success).toBe(false);
    expect(result.message).toContain('没有');
  });

  it('fails when materials are missing', () => {
    const player = makePlayer();
    const result = craft.craft(player, '铁剑');
    expect(result.success).toBe(false);
    expect(result.message).toContain('缺少材料');
  });

  it('enforces level requirement via canCraft', () => {
    const player = makePlayer();
    player.level = 1;
    const err = craft.canCraft(player, {
      id: 'legendary-sword',
      name: '神剑',
      description: '',
      ingredients: [],
      result: { itemId: 'iron-sword', quantity: 1 },
      requiredLevel: 10,
    });
    expect(err).toContain('需要等级 10');
  });

  it('enforces skill requirement via canCraft', () => {
    const player = makePlayer();
    const err = craft.canCraft(player, {
      id: 'master-pill',
      name: '大师丹',
      description: '',
      ingredients: [{ itemId: 'herb', quantity: 1 }],
      result: { itemId: 'jinchuang-yao', quantity: 1 },
      skillId: 'literate',
      skillLevel: 50,
    });
    expect(err).toContain('需要');
  });

  it('formats recipe list', () => {
    const formatted = craft.formatRecipes();
    expect(formatted).toContain('配方');
    expect(formatted).toContain('铁剑');
  });
});
