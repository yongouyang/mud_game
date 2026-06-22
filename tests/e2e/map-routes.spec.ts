import { test, expect } from '@playwright/test';
import { validateMap, formatValidationReport } from '../../server/src/data/map-validator.js';

test.describe('Map route topology', () => {
  const result = validateMap();

  test('every exit points to an existing room', () => {
    expect(result.brokenExits, result.brokenExits.join('\n')).toEqual([]);
  });

  test('all rooms are reachable from town/square', () => {
    expect(result.unreachableRooms, `Unreachable rooms: ${result.unreachableRooms.join(', ')}`).toEqual([]);
  });

  test('has no isolated rooms with zero exits', () => {
    expect(result.isolatedRooms, result.isolatedRooms.join('\n')).toEqual([]);
  });

  test('reports map statistics and dead ends', () => {
    // Dead ends are valid in many MUD layouts (destination rooms, dead-end caves,
    // school halls, etc.). This test prints them for human review rather than
    // failing, so map authors can confirm they are intentional.
    console.log('\n' + formatValidationReport(result));

    expect(result.stats.totalRooms).toBeGreaterThan(0);
    expect(result.stats.reachableRooms).toBe(result.stats.totalRooms);
    expect(result.stats.deadEndCount).toBeGreaterThanOrEqual(0);
  });
});
