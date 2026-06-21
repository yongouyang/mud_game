import { describe, it, expect } from 'vitest';
import skillsData from './skills.json' assert { type: 'json' };
import { SkillType, SKILL_TYPE_NAMES } from '../models/Skill.js';
import schoolsData from './schools.json' assert { type: 'json' };

const skills = skillsData as any[];
const validTypes = new Set<string>(Object.keys(SKILL_TYPE_NAMES));
const schoolIds = new Set((schoolsData as any[]).map((s) => s.id));

describe('skills.json data integrity', () => {
  it('has unique ids', () => {
    const ids = skills.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every skill has required fields', () => {
    for (const s of skills) {
      expect(s.id, `skill id`).toBeTruthy();
      expect(s.name, `${s.id} name`).toBeTruthy();
      expect(s.type, `${s.id} type`).toBeTruthy();
      expect(s.description, `${s.id} description`).toBeTruthy();
      expect(typeof s.damageBase, `${s.id} damageBase`).toBe('number');
      expect(typeof s.damageScale, `${s.id} damageScale`).toBe('number');
    }
  });

  it('every skill type is valid', () => {
    for (const s of skills) {
      expect(validTypes.has(s.type), `${s.id} type ${s.type}`).toBe(true);
    }
  });

  it('prerequisite skills exist when specified', () => {
    const skillIds = new Set(skills.map((s) => s.id));
    for (const s of skills) {
      if (s.requireSkill) {
        expect(skillIds.has(s.requireSkill), `${s.id} requireSkill ${s.requireSkill}`).toBe(true);
        expect(typeof s.requireLevel).toBe('number');
        expect(s.requireLevel).toBeGreaterThanOrEqual(0);
        expect(s.requireLevel).toBeLessThanOrEqual(100);
      }
      if (s.requirements?.length) {
        for (const req of s.requirements) {
          expect(skillIds.has(req.skillId), `${s.id} requirement ${req.skillId}`).toBe(true);
          expect(typeof req.level).toBe('number');
        }
      }
    }
  });

  it('school ids are valid when specified', () => {
    for (const s of skills) {
      if (s.schoolId) {
        expect(schoolIds.has(s.schoolId), `${s.id} schoolId ${s.schoolId}`).toBe(true);
      }
    }
  });

  it('perform moves are well-formed', () => {
    for (const s of skills) {
      if (!s.performs) continue;
      expect(Array.isArray(s.performs), `${s.id} performs`).toBe(true);
      for (const p of s.performs) {
        expect(p.name, `${s.id} perform name`).toBeTruthy();
        expect(typeof (p.multiplier ?? 2), `${s.id} perform multiplier`).toBe('number');
        expect(p.multiplier ?? 2).toBeGreaterThan(0);
      }
    }
  });
});
