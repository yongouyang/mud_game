export interface NpcDef {
  id: string;
  name: string;
  description: string;
  roomId: string;
  dialogue: string[];        // random responses to 'ask'
  attributes: { str: number; int: number; con: number; dex: number };
  skills: { skillId: string; level: number }[];
  aggressive: boolean;       // attacks on sight?
}
