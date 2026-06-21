export interface RecipeIngredient {
  itemId: string;
  quantity: number;
}

export interface RecipeDef {
  id: string;
  name: string;
  description: string;
  ingredients: RecipeIngredient[];
  result: {
    itemId: string;
    quantity: number;
  };
  requiredLevel?: number;
  skillId?: string;
  skillLevel?: number;
}
