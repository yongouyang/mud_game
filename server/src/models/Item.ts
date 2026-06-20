export type ItemType = 'weapon' | 'armor' | 'medicine' | 'misc';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  attrBonus?: Partial<Record<string, number>>; // e.g. { str: 5 } for a weapon
  hpRestore?: number;  // for medicine
}

export interface InventoryItem {
  itemId: string;
  quantity: number;
}

export const ITEM_TYPE_NAMES: Record<ItemType, string> = {
  weapon: '武器',
  armor: '防具',
  medicine: '药品',
  misc: '杂物',
};
