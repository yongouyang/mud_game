export interface NpcDef {
  id: string;
  name: string;
  description: string;
  roomId: string;
  dialogue: string[];        // random responses to 'ask'
  attributes: { str: number; int: number; con: number; dex: number };
  skills: { skillId: string; level: number }[];
  aggressive: boolean;       // attacks on sight?
  respawnSeconds?: number;   // default respawn time; 0 or undefined means no respawn
  poisonChance?: number;     // 0-1 chance to apply poison on successful hit
  poisonLevel?: number;      // level of poison applied
}
