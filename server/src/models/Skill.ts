export type SkillType =
  | 'parry' | 'dodge' | 'force' | 'strike'
  | 'unarmed' | 'cuff' | 'finger' | 'hand' | 'claw'
  | 'literate';

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  damageBase: number;
  damageScale: number;
  requireSkill?: string;
  requireLevel?: number;
  schoolId?: string | null;
  performs?: { name: string; desc: string; multiplier: number }[];
}

export interface PlayerSkill {
  skillId: string;
  level: number;
}

export const SKILL_TYPE_NAMES: Record<SkillType, string> = {
  parry: '招架',
  dodge: '轻功',
  force: '内功',
  strike: '招式',
  unarmed: '拳脚',
  cuff: '拳法',
  finger: '指法',
  hand: '掌法',
  claw: '爪法',
  literate: '读书识字',
};
