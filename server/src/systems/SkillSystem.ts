import { Player, recalcPlayerStats } from '../models/Player.js';
import { SkillDef, PlayerSkill } from '../models/Skill.js';
import skillsData from '../data/skills.json' assert { type: 'json' };
import { SchoolSystem } from './SchoolSystem.js';

export class SkillSystem {
  private defs = new Map<string, SkillDef>();
  private nameIndex = new Map<string, string>();

  constructor(private schools?: SchoolSystem) {
    for (const s of skillsData as SkillDef[]) {
      this.defs.set(s.id, s);
      this.nameIndex.set(s.name, s.id);
      this.nameIndex.set(s.id, s.id);
    }
  }

  getDef(skillId: string): SkillDef | undefined { return this.defs.get(skillId); }

  findDefByName(name: string): SkillDef | undefined {
    const id = this.nameIndex.get(name);
    return id ? this.defs.get(id) : undefined;
  }

  /** Learn a skill. Returns error message or null for success. */
  learnSkill(player: Player, skillId: string, opts?: { currentRoom?: string }): string | null {
    const def = this.defs.get(skillId);
    if (!def) return `没有"${skillId}"这个武功。`;

    // Check prerequisites
    const requirements = def.requirements || [];
    if (def.requireSkill && def.requireLevel) {
      requirements.push({ skillId: def.requireSkill, level: def.requireLevel });
    }
    for (const req of requirements) {
      const actual = this.getSkillLevel(player, req.skillId);
      if (actual < req.level) {
        const prereqDef = this.defs.get(req.skillId);
        return `学习${def.name}需要${prereqDef?.name || req.skillId}达到Lv.${req.level}（当前Lv.${actual}）。`;
      }
    }

    // School-specific skills: must be member + at master's room
    if (def.schoolId) {
      const school = this.schools?.getSchool(def.schoolId);
      if (!school) {
        return `「${def.name}」暂无门派传授。`;
      }
      const pSchoolId = (player as any).schoolId;
      if (pSchoolId !== def.schoolId) {
        return `「${def.name}」是${school.name}独门武功，需先加入该门派。`;
      }
      if (opts?.currentRoom !== school.joinRoomId) {
        return `需到${school.name}师父面前学习${def.name}。`;
      }
    }

    // Pot cost
    const cost = def.schoolId ? Math.max(2, Math.floor(this.getSkillLevel(player, skillId) / 10) + 2) : 1;
    if ((player.pot || 0) < cost) {
      return `潜能不足！需 ${cost} 点（当前 ${player.pot || 0}）。`;
    }

    if (!player.skills) player.skills = [];
    const existing = player.skills.find((s) => s.skillId === skillId);
    if (existing) {
      existing.level = Math.min(100, existing.level + 1);
      player.pot -= cost;
      return null;
    }
    player.skills.push({ skillId, level: 1 });
    player.pot -= cost;
    return null;
  }

  getSkillLevel(player: Player, skillId: string): number {
    return player.skills?.find((s) => s.skillId === skillId)?.level || 0;
  }

  private attackTypes = new Set<SkillType>(['strike', 'unarmed', 'cuff', 'finger', 'hand', 'claw']);

  isAttackType(type: SkillType): boolean {
    return this.attackTypes.has(type);
  }

  getBestStrike(player: Player): { name: string; damage: number } | null {
    let best: { name: string; damage: number } | null = null;
    for (const s of player.skills || []) {
      const def = this.defs.get(s.skillId);
      if (def && this.isAttackType(def.type)) {
        const dmg = def.damageBase + def.damageScale * s.level;
        if (!best || dmg > best.damage) best = { name: def.name, damage: dmg };
      }
    }
    return best;
  }

  getParryLevel(player: Player): number {
    let max = 0;
    for (const s of player.skills || []) {
      const def = this.defs.get(s.skillId);
      if (def && def.type === 'parry' && s.level > max) max = s.level;
    }
    return max;
  }

  getDodgeLevel(player: Player): number {
    let max = 0;
    for (const s of player.skills || []) {
      const def = this.defs.get(s.skillId);
      if (def && def.type === 'dodge' && s.level > max) max = s.level;
    }
    return max;
  }

  getForceLevel(player: Player): number {
    let max = 0;
    for (const s of player.skills || []) {
      const def = this.defs.get(s.skillId);
      if (def && def.type === 'force' && s.level > max) max = s.level;
    }
    return max;
  }

  /** Return the player's level in a weapon-type skill (sword, blade, etc.). */
  getWeaponSkillLevel(player: Player, weaponType: string): number {
    let max = 0;
    for (const s of player.skills || []) {
      const def = this.defs.get(s.skillId);
      if (def && (def.id === weaponType || def.type === weaponType) && s.level > max) max = s.level;
    }
    return max;
  }

  /** Return attribute bonuses derived from highest relevant skill levels. */
  getAttributeBonus(player: Player): { str: number; int: number; con: number; dex: number } {
    let bestStrSkill = 0;
    let bestLiterate = 0;
    let bestForce = 0;
    let bestDodge = 0;
    for (const s of player.skills || []) {
      const def = this.defs.get(s.skillId);
      if (!def) continue;
      if (this.isAttackType(def.type) && s.level > bestStrSkill) bestStrSkill = s.level;
      if (def.type === 'literate' && s.level > bestLiterate) bestLiterate = s.level;
      if (def.type === 'force' && s.level > bestForce) bestForce = s.level;
      if (def.type === 'dodge' && s.level > bestDodge) bestDodge = s.level;
    }
    return {
      str: Math.floor(bestStrSkill / 10),
      int: Math.floor(bestLiterate / 10),
      con: Math.floor(bestForce / 10),
      dex: Math.floor(bestDodge / 10),
    };
  }

  formatSkills(player: Player): string {
    if (!player.skills || player.skills.length === 0) return '\n  你尚未学习任何武功。\n';
    const lines: string[] = ['', '  ─── 武功 ───', ''];
    for (const s of player.skills) {
      const def = this.defs.get(s.skillId);
      if (def) lines.push(`  ${def.name}(${def.type})  Lv.${s.level}`);
    }
    return lines.join('\n') + '\n\n';
  }
}
