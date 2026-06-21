export type SkillType =
  | 'parry' | 'dodge' | 'force' | 'strike'
  | 'unarmed' | 'cuff' | 'finger' | 'hand' | 'claw'
  | 'literate';

export interface SkillPerformDef {
  name: string;
  desc: string;
  multiplier?: number;
  mpCost?: number;
  conditionId?: string;
  conditionChance?: number;
  conditionLevel?: number;
  weaponType?: string;
  targetType?: 'single' | 'self' | 'aoe';
}

export interface SkillRequirement {
  skillId: string;
  level: number;
}

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  damageBase: number;
  damageScale: number;
  requireSkill?: string;
  requireLevel?: number;
  requirements?: SkillRequirement[];
  schoolId?: string | null;
  performs?: SkillPerformDef[];
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
