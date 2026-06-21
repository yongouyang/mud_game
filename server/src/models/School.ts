import { PlayerAttributes } from './Player.js';

export interface SchoolDef {
  id: string;
  name: string;
  description: string;
  joinRoomId: string;      // room where the school entrance is
  masterName: string;       // name of the master NPC
  masterDialogue: string[];
  skills: string[];         // skill IDs taught at this school
  attrBonus?: Partial<PlayerAttributes>; // permanent attribute bonus on joining
  bonusDescription?: string; // player-facing description of the bonus
}

export interface PlayerSchool {
  schoolId: string;
  joinedAt: string;  // ISO date
}
