export type SkillType = 'parry' | 'dodge' | 'force' | 'strike';

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
};
