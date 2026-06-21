import { InventoryItem } from './Item.js';
import { PlayerSkill } from './Skill.js';
import { PlayerCondition } from './Condition.js';

export interface PlayerAttributes {
  str: number; // 臂力 — affects attack damage
  int: number; // 悟性 — affects skill learning
  con: number; // 根骨 — affects max HP
  dex: number; // 身法 — affects dodge/defense
  per: number; // 容貌 — affects NPC dialogue and some skill requirements
  kar: number; // 福缘 — affects luck on random events
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
  level: number;
  attrPoints: number;
  currentRoom: string;
  state: PlayerState;
  targetEnemy: string | null;
  combatTargets: string[]; // active enemies in multi-enemy combat
  inventory: InventoryItem[];
  equipped: string[];
  skills: PlayerSkill[];
  conditions: PlayerCondition[];
  schoolId?: string;
  schoolName?: string;
  quest: {
    questId?: string;
    type: string;
    target: string; // NPC name, NPC id, item id, etc.
    targetId?: string; // canonical id for kill/collect targets
    targetCount?: number;
    progress?: number;
    exp: number;
    pot: number;
    itemId?: string; // delivery / collect item
    rewardShen?: number;
    rewardItemId?: string;
  } | null;
  powerupExpiry?: number;
  isMeditating?: boolean;
  meditationTaskId?: string;
  bankSilver: number;
  bankInventory: InventoryItem[];
  shen: number; // 善恶值 — positive = good, negative = evil
  kills: {
    players: number;
    npcs: number;
    lastKillerName?: string;
    lastKillerTime?: number;
  };
  /** Transient combat combo state (not critical to persist). */
  comboCount?: number;
  comboSkill?: string;
  isAdmin?: boolean;
}

export function recalcPlayerStats(player: Player): void {
  player.maxHp = 80 + player.attributes.con * 10;
  player.maxMp = 50 + player.attributes.int * 8;
  player.hp = Math.min(player.hp, player.maxHp);
  player.mp = Math.min(player.mp, player.maxMp);
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
    level: 1,
    attrPoints: 0,
    currentRoom: 'town/square',
    state: 'playing',
    targetEnemy: null,
    combatTargets: [],
    inventory: [],
    equipped: [],
    skills: [],
    conditions: [],
    schoolId: undefined,
    quest: null,
    powerupExpiry: undefined,
    isMeditating: false,
    bankSilver: 0,
    bankInventory: [],
    shen: 0,
    kills: { players: 0, npcs: 0 },
  };
}

export const DEFAULT_ATTRIBUTES: PlayerAttributes = {
  str: 10,
  int: 10,
  con: 10,
  dex: 10,
  per: 10,
  kar: 10,
};

export const ATTRIBUTE_NAMES: Record<keyof PlayerAttributes, string> = {
  str: '臂力',
  int: '悟性',
  con: '根骨',
  dex: '身法',
  per: '容貌',
  kar: '福缘',
};
