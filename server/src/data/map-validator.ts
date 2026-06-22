import mapsData from './maps.json' assert { type: 'json' };

export interface MapRoom {
  id: string;
  name: string;
  description: string;
  exits: { direction: string; roomId: string }[];
}

export interface MapValidationResult {
  rooms: MapRoom[];
  roomIds: Set<string>;
  /** Exits pointing to non-existent rooms. */
  brokenExits: string[];
  /** Rooms unreachable from town/square. */
  unreachableRooms: string[];
  /** Exits whose target has no matching return exit (potential one-way paths). */
  oneWayExits: string[];
  /** Rooms with exactly one exit (dead ends). */
  deadEnds: string[];
  /** Rooms with no exits at all. */
  isolatedRooms: string[];
  /** Statistics summary. */
  stats: {
    totalRooms: number;
    totalExits: number;
    reachableRooms: number;
    deadEndCount: number;
    oneWayCount: number;
  };
}

export function loadRooms(): MapRoom[] {
  return (mapsData as any).rooms as MapRoom[];
}

export function validateMap(rooms: MapRoom[] = loadRooms()): MapValidationResult {
  const roomIds = new Set(rooms.map((r) => r.id));
  const brokenExits: string[] = [];
  const oneWayExits: string[] = [];
  const deadEnds: string[] = [];
  const isolatedRooms: string[] = [];

  // Build lookup
  const roomById = new Map<string, MapRoom>();
  for (const r of rooms) {
    roomById.set(r.id, r);
  }

  // Broken exits & one-way detection
  let totalExits = 0;
  for (const r of rooms) {
    const exits = r.exits || [];
    totalExits += exits.length;

    if (exits.length === 0) {
      isolatedRooms.push(`${r.id} (${r.name})`);
    } else if (exits.length === 1) {
      deadEnds.push(`${r.id} (${r.name}) -> ${exits[0].direction} -> ${exits[0].roomId}`);
    }

    for (const e of exits) {
      if (!roomIds.has(e.roomId)) {
        brokenExits.push(`${r.id} -> ${e.direction} -> ${e.roomId} (missing room)`);
        continue;
      }

      const target = roomById.get(e.roomId)!;
      // Check whether the target room has *any* exit back to this room.
      // We do not require the reverse direction name to match, because the map
      // uses asymmetric direction labels (e.g. hub uses "northeast" while the
      // destination hall uses "south" to return).
      const hasReturn = (target.exits || []).some((te) => te.roomId === r.id);
      if (!hasReturn) {
        oneWayExits.push(`${r.id} -> ${e.direction} -> ${e.roomId}`);
      }
    }
  }

  // Reachability BFS from town/square
  const reachable = new Set<string>();
  const queue: string[] = [];
  if (roomIds.has('town/square')) {
    queue.push('town/square');
    reachable.add('town/square');
  }
  while (queue.length > 0) {
    const id = queue.shift()!;
    const room = roomById.get(id);
    if (!room) continue;
    for (const e of room.exits || []) {
      if (!reachable.has(e.roomId)) {
        reachable.add(e.roomId);
        queue.push(e.roomId);
      }
    }
  }

  const unreachableRooms = rooms.filter((r) => !reachable.has(r.id)).map((r) => r.id);

  return {
    rooms,
    roomIds,
    brokenExits,
    unreachableRooms,
    oneWayExits,
    deadEnds,
    isolatedRooms,
    stats: {
      totalRooms: rooms.length,
      totalExits,
      reachableRooms: reachable.size,
      deadEndCount: deadEnds.length,
      oneWayCount: oneWayExits.length,
    },
  };
}

export function formatValidationReport(result: MapValidationResult): string {
  const lines: string[] = [];
  lines.push(`Rooms: ${result.stats.totalRooms}, Exits: ${result.stats.totalExits}`);
  lines.push(`Reachable from town/square: ${result.stats.reachableRooms}/${result.stats.totalRooms}`);
  lines.push(`Dead ends: ${result.stats.deadEndCount}`);
  lines.push(`Potential one-way exits: ${result.stats.oneWayCount}`);

  if (result.unreachableRooms.length > 0) {
    lines.push(`Unreachable rooms: ${result.unreachableRooms.join(', ')}`);
  }
  if (result.brokenExits.length > 0) {
    lines.push(`Broken exits: ${result.brokenExits.join('; ')}`);
  }
  if (result.isolatedRooms.length > 0) {
    lines.push(`Isolated rooms: ${result.isolatedRooms.join('; ')}`);
  }
  if (result.deadEnds.length > 0) {
    lines.push('Dead ends:');
    for (const d of result.deadEnds) {
      lines.push(`  ${d}`);
    }
  }
  if (result.oneWayExits.length > 0) {
    lines.push('One-way / asymmetric exits:');
    for (const o of result.oneWayExits) {
      lines.push(`  ${o}`);
    }
  }
  return lines.join('\n');
}
