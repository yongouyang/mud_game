export type ItemType = 'weapon' | 'armor' | 'medicine' | 'misc';

export interface ItemEffect {
  hp?: number;           // restore HP
  mp?: number;           // restore MP
  cure?: string;         // condition id to remove, e.g. 'poison'
  cureCategory?: string; // condition category to remove, e.g. 'poison'
  str?: number;          // permanent attribute boost
  int?: number;
  con?: number;
  dex?: number;
}

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  description: string;
  attrBonus?: Partial<Record<string, number>>; // e.g. { str: 5 } for a weapon
  weaponType?: string;   // sword, blade, staff, throwing, whip, etc.
  effect?: ItemEffect;   // for medicine / consumables
  /** @deprecated use effect.hp instead */
  hpRestore?: number;
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
