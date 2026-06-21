import { Player, recalcPlayerStats } from '../models/Player.js';
import { SkillDef, PlayerSkill } from '../models/Skill.js';
import skillsData from '../data/skills.json' assert { type: 'json' };
import { SchoolSystem } from './SchoolSystem.js';

export class SkillSystem {
  private defs = new Map<string, SkillDef>();

  constructor(private schools?: SchoolSystem) {
    for (const s of skillsData as SkillDef[]) {
      this.defs.set(s.id, s);
    }
  }

  getDef(skillId: string): SkillDef | undefined { return this.defs.get(skillId); }

  findDefByName(name: string): SkillDef | undefined {
    for (const def of this.defs.values()) { if (def.name === name || def.id === name) return def; }
    return undefined;
  }

  /** Learn a skill. Returns error message or null for success. */
  learnSkill(player: Player, skillId: string, opts?: { currentRoom?: string }): string | null {
    const def = this.defs.get(skillId);
    if (!def) return `没有"${skillId}"这个武功。`;

    // Check prerequisite
    if (def.requireSkill && def.requireLevel) {
      const prereqLevel = this.getSkillLevel(player, def.requireSkill);
      if (prereqLevel < def.requireLevel) {
        const prereqDef = this.defs.get(def.requireSkill);
        return `学习${def.name}需要${prereqDef?.name || def.requireSkill}达到Lv.${def.requireLevel}（当前Lv.${prereqLevel}）。`;
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

  getBestStrike(player: Player): { name: string; damage: number } | null {
    let best: { name: string; damage: number } | null = null;
    for (const s of player.skills || []) {
      const def = this.defs.get(s.skillId);
      if (def && def.type === 'strike') {
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
