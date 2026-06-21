import { describe, it, expect } from 'vitest';
import itemsData from './items.json' assert { type: 'json' };
import { ItemType } from '../models/Item.js';

const items = itemsData as any[];
const validTypes: Set<string> = new Set(['weapon', 'armor', 'medicine', 'misc']);
const validAttrs = new Set(['str', 'int', 'con', 'dex', 'per', 'kar']);

describe('items.json data integrity', () => {
  it('has unique ids', () => {
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every item has required fields', () => {
    for (const i of items) {
      expect(i.id, `item id`).toBeTruthy();
      expect(i.name, `${i.id} name`).toBeTruthy();
      expect(i.type, `${i.id} type`).toBeTruthy();
      expect(i.description, `${i.id} description`).toBeTruthy();
    }
  });

  it('every item type is valid', () => {
    for (const i of items) {
      expect(validTypes.has(i.type), `${i.id} type ${i.type}`).toBe(true);
    }
  });

  it('weapons have weaponType', () => {
    for (const i of items) {
      if (i.type === 'weapon') {
        expect(i.weaponType, `${i.id} weaponType`).toBeTruthy();
      }
    }
  });

  it('attrBonus keys are valid attributes', () => {
    for (const i of items) {
      if (!i.attrBonus) continue;
      for (const key of Object.keys(i.attrBonus)) {
        expect(validAttrs.has(key), `${i.id} attrBonus key ${key}`).toBe(true);
        expect(typeof i.attrBonus[key]).toBe('number');
      }
    }
  });

  it('medicine effects are valid when present', () => {
    for (const i of items) {
      if (i.type !== 'medicine') continue;
      if (i.effect) {
        for (const [key, val] of Object.entries(i.effect)) {
          if (key === 'cureCategory') {
            expect(typeof val, `${i.id} effect ${key}`).toBe('string');
          } else {
            expect(typeof val, `${i.id} effect ${key}`).toBe('number');
          }
        }
      }
      if (i.hpRestore !== undefined) expect(typeof i.hpRestore).toBe('number');
      if (i.mpRestore !== undefined) expect(typeof i.mpRestore).toBe('number');
    }
  });
});
