import { describe, it, expect } from 'vitest';
import questsData from './quests.json' assert { type: 'json' };
import npcsData from './npcs.json' assert { type: 'json' };
import itemsData from './items.json' assert { type: 'json' };

const quests = questsData as any[];
const npcIds = new Set((npcsData as any[]).map((n) => n.id));
const itemIds = new Set((itemsData as any[]).map((i) => i.id));

describe('quests.json data integrity', () => {
  it('has unique ids', () => {
    const ids = quests.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('quest giver/completer NPCs exist', () => {
    for (const q of quests) {
      expect(npcIds.has(q.giverNpcId), `${q.id} giver ${q.giverNpcId}`).toBe(true);
      if (q.completerNpcId) {
        expect(npcIds.has(q.completerNpcId), `${q.id} completer ${q.completerNpcId}`).toBe(true);
      }
    }
  });

  it('kill targets exist as NPCs', () => {
    for (const q of quests) {
      if (q.type === 'kill') {
        expect(npcIds.has(q.targetId), `${q.id} kill target ${q.targetId}`).toBe(true);
      }
    }
  });

  it('collect/delivery item targets exist', () => {
    for (const q of quests) {
      if (q.type === 'collect' || q.type === 'delivery') {
        expect(itemIds.has(q.targetId), `${q.id} item target ${q.targetId}`).toBe(true);
      }
    }
  });

  it('talk targets exist as NPCs', () => {
    for (const q of quests) {
      if (q.type === 'talk') {
        expect(npcIds.has(q.targetId), `${q.id} talk target ${q.targetId}`).toBe(true);
      }
    }
  });

  it('reward items exist when specified', () => {
    for (const q of quests) {
      if (q.rewardItemId) {
        expect(itemIds.has(q.rewardItemId), `${q.id} reward item ${q.rewardItemId}`).toBe(true);
      }
    }
  });
});
