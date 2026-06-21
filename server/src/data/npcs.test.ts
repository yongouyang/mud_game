import { describe, it, expect } from 'vitest';
import npcsData from './npcs.json' assert { type: 'json' };
import itemsData from './items.json' assert { type: 'json' };
import skillsData from './skills.json' assert { type: 'json' };
import mapsData from './maps.json' assert { type: 'json' };

const npcs = npcsData as any[];
const items = itemsData as any[];
const skills = skillsData as any[];
const rooms = (mapsData as any).rooms as any[];

const itemIds = new Set(items.map((i) => i.id));
const skillIds = new Set(skills.map((s) => s.id));
const roomIds = new Set(rooms.map((r) => r.id));

describe('npcs.json data integrity', () => {
  it('has unique ids', () => {
    const ids = npcs.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every NPC has required fields', () => {
    for (const n of npcs) {
      expect(n.id, `npc id`).toBeTruthy();
      expect(n.name, `${n.id} name`).toBeTruthy();
      expect(n.description, `${n.id} description`).toBeTruthy();
      expect(n.roomId, `${n.id} roomId`).toBeTruthy();
      expect(n.attributes, `${n.id} attributes`).toBeDefined();
      expect(Array.isArray(n.skills), `${n.id} skills`).toBe(true);
      expect(Array.isArray(n.dialogue), `${n.id} dialogue`).toBe(true);
    }
  });

  it('every NPC roomId exists', () => {
    for (const n of npcs) {
      expect(roomIds.has(n.roomId), `${n.id} roomId ${n.roomId}`).toBe(true);
    }
  });

  it('every NPC skill references a valid skill', () => {
    for (const n of npcs) {
      for (const sk of n.skills) {
        expect(skillIds.has(sk.skillId), `${n.id} skill ${sk.skillId}`).toBe(true);
        expect(typeof sk.level).toBe('number');
        expect(sk.level).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it('every NPC drop references a valid item or silver', () => {
    for (const n of npcs) {
      if (!n.drops) continue;
      for (const d of n.drops) {
        expect(d.itemId === 'silver' || itemIds.has(d.itemId), `${n.id} drop ${d.itemId}`).toBe(true);
        expect(typeof d.chance).toBe('number');
        expect(d.chance).toBeGreaterThanOrEqual(0);
        expect(d.chance).toBeLessThanOrEqual(1);
      }
    }
  });

  it('attribute values are within reasonable range', () => {
    for (const n of npcs) {
      for (const [key, val] of Object.entries(n.attributes)) {
        expect(typeof val, `${n.id} ${key}`).toBe('number');
        expect(val, `${n.id} ${key}`).toBeGreaterThanOrEqual(1);
        expect(val, `${n.id} ${key}`).toBeLessThanOrEqual(100);
      }
    }
  });

  it('boss NPCs are marked and have drops', () => {
    const bosses = npcs.filter((n) => n.boss);
    for (const n of bosses) {
      expect(n.drops?.length ?? 0, `${n.id} boss drops`).toBeGreaterThan(0);
    }
  });
});
