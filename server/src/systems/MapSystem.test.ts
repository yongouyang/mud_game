import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MapSystem } from './MapSystem.js';
import { Scheduler } from '../time/Scheduler.js';
import { TestSystemClock } from '../time/SystemClock.js';

describe('MapSystem', () => {
  let map: MapSystem;

  beforeEach(() => {
    map = new MapSystem();
  });

  it('resolves direction aliases and full names', () => {
    expect(map.resolveDirection('n')).toBe('north');
    expect(map.resolveDirection('ne')).toBe('northeast');
    expect(map.resolveDirection('north')).toBe('north');

    expect(map.resolveDirection('nowhere')).toBeNull();
  });

  it('moves player between rooms', () => {
    const result = map.movePlayer('town/square', 'north');
    expect(result.success).toBe(true);
    expect(result.newRoomId).toBe('town/mainstreet');
    expect(result.message).toContain('主街');
  });

  it('rejects invalid direction', () => {
    const result = map.movePlayer('town/square', 'xyzzy');
    expect(result.success).toBe(false);
    expect(result.message).toContain('没有');
  });

  it('rejects direction with no exit', () => {
    const result = map.movePlayer('town/square', 'west');
    expect(result.success).toBe(false);
    expect(result.message).toContain('没有路');
  });

  it('rejects move when target room is missing', () => {
    const room = map.getRoom('town/square')!;
    const original = room.exits.find((e) => e.direction === 'north')!.roomId;
    room.exits.find((e) => e.direction === 'north')!.roomId = 'nonexistent-room';
    const result = map.movePlayer('town/square', 'north');
    expect(result.success).toBe(false);
    expect(result.message).toContain('走不通');
    room.exits.find((e) => e.direction === 'north')!.roomId = original;
  });

  it('formats a room with no exits', () => {
    const room = { id: 'void', name: '虚空', description: '一片虚无', exits: [], items: [] };
    const formatted = map.formatRoom(room);
    expect(formatted).toContain('虚空');
    expect(formatted).toContain('[出口] 无');
  });

  it('renders literal \\n in descriptions as real line breaks', () => {
    const room = map.getRoom('gaibang/forest1')!;
    const formatted = map.formatRoom(room);
    expect(formatted).toContain('东边是总舵');
    expect(formatted).toContain('南边可以进入密林深处');
    expect(formatted).not.toContain('\\n');
  });

  it('can travel back from gaibang to wilderness', () => {
    const result = map.movePlayer('gaibang/forest1', 'west');
    expect(result.success).toBe(true);
    expect(result.newRoomId).toBe('wilderness/forest1');
  });

  it('removes and respawns room items without scheduler', () => {
    const room = map.getRoom('town/square')!;
    room.items = ['test-item'];
    room.itemRespawnSeconds = 1;
    const cancel = map.scheduleItemRespawn('town/square', 'test-item');
    expect(cancel).toBeDefined();
    cancel!();
    // Without advancing time the item should still be there.
    expect(room.items).toContain('test-item');
  });

  it('removes room item by name', () => {
    const room = map.getRoom('town/square')!;
    room.items = ['herb'];
    expect(map.removeItemFromRoom('town/square', 'herb')).toBe(true);
    expect(map.removeItemFromRoom('town/square', 'herb')).toBe(false);
  });
});
