import { InventoryItem } from './Item.js';
import { PlayerSkill } from './Skill.js';

export interface PlayerAttributes {
  str: number; // 臂力 — affects attack damage
  int: number; // 悟性 — affects skill learning
  con: number; // 根骨 — affects max HP
  dex: number; // 身法 — affects dodge/defense
}

export type PlayerState = 'creating' | 'playing' | 'fighting';

export interface Player {
  id: string;
  name: string;
  attributes: PlayerAttributes;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  exp: number;
  pot: number;
  currentRoom: string;
  state: PlayerState;
  targetEnemy: string | null;
  inventory: InventoryItem[];
  equipped: string[];
  skills: PlayerSkill[];
  conditions: string[];
  schoolId?: string;
}

export function createPlayer(id: string, name: string, attrs: PlayerAttributes): Player {
  const maxHp = 80 + attrs.con * 10;
  const maxMp = 50 + attrs.int * 8;
  return {
    id,
    name,
    attributes: attrs,
    hp: maxHp,
    maxHp,
    mp: maxMp,
    maxMp,
    exp: 0,
    pot: 100,
    currentRoom: 'town/square',
    state: 'playing',
    targetEnemy: null,
    inventory: [],
    equipped: [],
    skills: [],
    conditions: [],
    schoolId: undefined,
  };
}

export const DEFAULT_ATTRIBUTES: PlayerAttributes = {
  str: 10,
  int: 10,
  con: 10,
  dex: 10,
};

export const ATTRIBUTE_NAMES: Record<keyof PlayerAttributes, string> = {
  str: '臂力',
  int: '悟性',
  con: '根骨',
  dex: '身法',
};
