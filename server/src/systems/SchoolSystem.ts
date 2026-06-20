import { SchoolDef } from '../models/School.js';
import schoolsData from '../data/schools.json' assert { type: 'json' };
import { Player } from '../models/Player.js';

export class SchoolSystem {
  private schools = new Map<string, SchoolDef>();

  constructor() {
    for (const s of schoolsData as SchoolDef[]) {
      this.schools.set(s.id, s);
    }
  }

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
    for (const s of this.schools.values()) {
      lines.push(`  ${s.name} - ${s.description.split('。')[0]}。`);
    }
    lines.push('');
    lines.push('  输入 schools <门派名> 查看详情');
    lines.push('  在门派所在地输入 join <门派名> 加入');
    return lines.join('\n') + '\n';
  }

  formatSchoolDetail(school: SchoolDef): string {
    return [
      '',
      `  ═══ ${school.name} ═══`,
      '',
      `  ${school.description}`,
      '',
      `  掌门：${school.masterName}`,
      `  可学武功：${school.skills.map((s) => `[${s}]`).join(', ')}`,
      '',
    ].join('\n') + '\n';
  }

  formatAllSchools(): string {
    return this.listSchools();
  }
}
