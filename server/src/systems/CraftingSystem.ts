import { Player } from '../models/Player.js';
import { ItemSystem } from './ItemSystem.js';
import { SkillSystem } from './SkillSystem.js';
import recipesData from '../data/recipes.json' assert { type: 'json' };
import { RecipeDef } from '../models/Recipe.js';

export class CraftingSystem {
  private recipes = new Map<string, RecipeDef>();

  constructor(private items: ItemSystem, private skills?: SkillSystem) {
    for (const r of recipesData as RecipeDef[]) {
      this.recipes.set(r.id, r);
      this.recipes.set(r.name, r);
    }
  }

  findRecipe(nameOrId: string): RecipeDef | undefined {
    return this.recipes.get(nameOrId);
  }

  canCraft(player: Player, recipe: RecipeDef): string | null {
    if (recipe.requiredLevel && (player.level || 1) < recipe.requiredLevel) {
      return `需要等级 ${recipe.requiredLevel}。`;
    }
    if (recipe.skillId && recipe.skillLevel && this.skills) {
      const lv = this.skills.getSkillLevel(player, recipe.skillId);
      if (lv < recipe.skillLevel) {
        const def = this.skills.getDef(recipe.skillId);
        return `需要${def?.name || recipe.skillId}达到 Lv.${recipe.skillLevel}。`;
      }
    }
    for (const ing of recipe.ingredients) {
      if (!this.items.hasItem(player, ing.itemId, ing.quantity)) {
        const def = this.items.getDef(ing.itemId);
        return `缺少材料：${def?.name || ing.itemId} x${ing.quantity}`;
      }
    }
    return null;
  }

  craft(player: Player, nameOrId: string): { success: boolean; message: string } {
    const recipe = this.findRecipe(nameOrId);
    if (!recipe) return { success: false, message: `没有"${nameOrId}"这个配方。` };
    const err = this.canCraft(player, recipe);
    if (err) return { success: false, message: `制作失败：${err}` };
    for (const ing of recipe.ingredients) {
      this.items.removeItem(player, ing.itemId, ing.quantity);
    }
    this.items.addItem(player, recipe.result.itemId, recipe.result.quantity);
    const resultDef = this.items.getDef(recipe.result.itemId);
    return {
      success: true,
      message: `你成功制作出 ${resultDef?.name || recipe.result.itemId} x${recipe.result.quantity}！`,
    };
  }

  formatRecipes(): string {
    const lines: string[] = ['', '  ─── 配方 ───', ''];
    for (const r of this.recipes.values()) {
      const ingStr = r.ingredients
        .map((ing) => {
          const def = this.items.getDef(ing.itemId);
          return `${def?.name || ing.itemId} x${ing.quantity}`;
        })
        .join(' + ');
      const resultDef = this.items.getDef(r.result.itemId);
      lines.push(`  ${r.name}：${ingStr} → ${resultDef?.name || r.result.itemId} x${r.result.quantity}`);
    }
    lines.push('');
    lines.push('  用法：craft <配方名>');
    lines.push('');
    return lines.join('\n') + '\n';
  }
}
