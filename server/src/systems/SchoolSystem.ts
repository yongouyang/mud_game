import { SchoolDef } from '../models/School.js';
import schoolsData from '../data/schools.json' assert { type: 'json' };
import { Player, recalcPlayerStats, PlayerAttributes, ATTRIBUTE_NAMES } from '../models/Player.js';

export class SchoolSystem {
  private schools = new Map<string, SchoolDef>();

  constructor() {
    for (const s of schoolsData as SchoolDef[]) {
      this.schools.set(s.id, s);
    }
  }

  getAll(): SchoolDef[] { return [...this.schools.values()]; }

  getSchool(id: string): SchoolDef | undefined {
    return this.schools.get(id);
  }

  findSchoolByName(name: string): SchoolDef | undefined {
    for (const s of this.schools.values()) {
      if (s.name === name) return s;
    }
    return undefined;
  }

  listSchools(): string {
    const lines: string[] = ['', '  ─── 江湖门派 ───', ''];
    for (const s of this.getAll()) {
      const bonus = s.bonusDescription ? `（${s.bonusDescription}）` : '';
      lines.push(`  ${s.name}${bonus} - ${s.description.split('。')[0]}。`);
    }
    lines.push('');
    lines.push('  输入 schools <门派名> 查看详情');
    lines.push('  在门派所在地输入 join <门派名> 加入');
    return lines.join('\n') + '\n';
  }

  /** Apply a school's permanent attribute bonus to a player. */
  applyBonus(player: Player, school: SchoolDef): void {
    if (!school.attrBonus) return;
    for (const [key, val] of Object.entries(school.attrBonus)) {
      if (val && val !== 0) {
        (player.attributes as any)[key] += val;
      }
    }
    recalcPlayerStats(player);
  }

  formatAttributeBonus(school: SchoolDef): string {
    if (!school.attrBonus) return '无';
    return Object.entries(school.attrBonus)
      .filter(([, v]) => v && v !== 0)
      .map(([k, v]) => `${ATTRIBUTE_NAMES[k as keyof PlayerAttributes]} +${v}`)
      .join('，') || '无';
  }

  formatSchoolDetail(school: SchoolDef): string {
    const skillLines = school.skills.map((id) => {
      return `    · ${id}`;
    }).join('\n') || '    （暂无）';
    return [
      '',
      `  ═══ ${school.name} ═══`,
      '',
      `  ${school.description}`,
      '',
      `  掌门：${school.masterName || '待定'}`,
      `  入门奖励：${this.formatAttributeBonus(school)}`,
      `  可学武功：`,
      skillLines,
      '',
      `  在 ${school.joinRoomId} 输入 join ${school.name} 加入门派`,
      '',
    ].join('\n') + '\n';
  }

  formatAllSchools(): string {
    return this.listSchools();
  }
}
