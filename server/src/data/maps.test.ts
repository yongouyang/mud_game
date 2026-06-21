import { describe, it, expect } from 'vitest';
import mapsData from './maps.json' assert { type: 'json' };

const rooms = (mapsData as any).rooms as any[];
const roomIds = new Set(rooms.map((r) => r.id));

describe('maps.json data integrity', () => {
  it('has unique room ids', () => {
    expect(roomIds.size).toBe(rooms.length);
  });

  it('every exit points to an existing room', () => {
    for (const r of rooms) {
      for (const e of r.exits || []) {
        expect(roomIds.has(e.roomId), `${r.id} exit ${e.direction} -> ${e.roomId}`).toBe(true);
      }
    }
  });

  it('starting room exists', () => {
    expect(roomIds.has('town/square')).toBe(true);
  });

  it('all school halls are reachable from town/square', () => {
    const start = 'town/square';
    const reachable = new Set<string>();
    const queue = [start];
    reachable.add(start);
    while (queue.length) {
      const id = queue.shift()!;
      const room = rooms.find((r) => r.id === id);
      if (!room) continue;
      for (const e of room.exits || []) {
        if (!reachable.has(e.roomId)) {
          reachable.add(e.roomId);
          queue.push(e.roomId);
        }
      }
    }

    const halls = rooms.filter((r) => r.id.endsWith('/hall')).map((r) => r.id);
    const unreachable = halls.filter((h) => !reachable.has(h));
    expect(unreachable, `unreachable halls: ${unreachable.join(', ')}`).toEqual([]);
  });
});
