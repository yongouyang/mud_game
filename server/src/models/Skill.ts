export type SkillType = 'unarmed' | 'dodge' | 'force' | 'strike';

export interface SkillDef {
  id: string;
  name: string;
  type: SkillType;
  description: string;
  damageBase: number;   // base damage when used
  damageScale: number;  // damage per skill level
}

export interface PlayerSkill {
  skillId: string;
  level: number;  // 1-100
}

export const SKILL_TYPE_NAMES: Record<SkillType, string> = {
  unarmed: '拳脚',
  dodge: '轻功',
  force: '内功',
  strike: '招式',
};
