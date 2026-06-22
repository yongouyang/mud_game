import { describe, it, expect } from 'vitest';
import { validateMap, formatValidationReport } from './map-validator.js';

describe('maps.json data integrity', () => {
  const result = validateMap();

  it('has unique room ids', () => {
    expect(result.roomIds.size).toBe(result.rooms.length);
  });

  it('starting room exists', () => {
    expect(result.roomIds.has('town/square')).toBe(true);
  });

  it('every exit points to an existing room', () => {
    expect(result.brokenExits, result.brokenExits.join('\n')).toEqual([]);
  });

  it('all rooms are reachable from town/square', () => {
    expect(result.unreachableRooms, `Unreachable: ${result.unreachableRooms.join(', ')}`).toEqual([]);
  });

  it('has no isolated rooms (rooms with zero exits)', () => {
    expect(result.isolatedRooms, result.isolatedRooms.join('\n')).toEqual([]);
  });

  it('lists valid dead ends for review', () => {
    // Dead ends are allowed (e.g. destination rooms), but we print them so
    // authors can verify they are intentional.
    console.log('\n' + formatValidationReport(result));
    expect(result.stats.deadEndCount).toBeGreaterThanOrEqual(0);
  });
});
