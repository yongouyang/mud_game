import { Room, Exit } from '../models/Room.js';
import { Scheduler } from '../time/Scheduler.js';
import mapsData from '../data/maps.json' assert { type: 'json' };

const DIRECTION_ALIASES: Record<string, string> = {
  n: 'north',
  s: 'south',
  e: 'east',
  w: 'west',
  u: 'up',
  d: 'down',
  ne: 'northeast',
  nw: 'northwest',
  se: 'southeast',
  sw: 'southwest',
};

const DIRECTION_NAMES: Record<string, string> = {
  north: '北边',
  south: '南边',
  east: '东边',
  west: '西边',
  up: '上面',
  down: '下面',
  northeast: '东北',
  northwest: '西北',
  southeast: '东南',
  southwest: '西南',
};

export class MapSystem {
  private rooms = new Map<string, Room>();

  constructor(private scheduler?: Scheduler) {
    for (const room of mapsData.rooms as Room[]) {
      // Some data sources encode newlines as the literal two-char sequence \n.
      if (room.description) {
        room.description = room.description.replace(/\\n/g, '\n');
      }
      // Seed current items from initialItems if not already set.
      if (room.initialItems && (!room.items || room.items.length === 0)) {
        room.items = [...room.initialItems];
      }
      this.rooms.set(room.id, room);
    }
  }

  getRoom(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  resolveDirection(input: string): string | null {
    const lower = input.toLowerCase();
    if (DIRECTION_ALIASES[lower]) return DIRECTION_ALIASES[lower];
    const values = Object.values(DIRECTION_ALIASES) as string[];
    if (values.includes(lower) || DIRECTION_NAMES[lower]) return lower;
    return null;
  }

  getExit(roomId: string, direction: string): Exit | undefined {
    const room = this.rooms.get(roomId);
    return room?.exits.find((e) => e.direction === direction);
  }

  formatRoom(room: Room): string {
    const lines: string[] = [];
    lines.push(`\n  【${room.name}】`);
    lines.push('');
    for (const line of room.description.split('\n')) {
      lines.push(`  ${line}`);
    }
    lines.push('');
    if (room.exits.length > 0) {
      const exitDescs = room.exits.map((e) => {
        const dirName = DIRECTION_NAMES[e.direction] || e.direction;
        return `${dirName}(${e.direction})`;
      });
      lines.push(`  [出口] ${exitDescs.join('  ')}`);
    } else {
      lines.push(`  [出口] 无`);
    }
    return lines.join('\n') + '\n';
  }

  movePlayer(roomId: string, direction: string): { success: boolean; newRoomId?: string; message: string } {
    const resolved = this.resolveDirection(direction);
    if (!resolved) {
      return { success: false, message: `\n  没有"${direction}"这个方向。\n` };
    }
    const exit = this.getExit(roomId, resolved);
    if (!exit) {
      return { success: false, message: `\n  这个方向没有路。\n` };
    }
    const newRoom = this.rooms.get(exit.roomId);
    if (!newRoom) {
      return { success: false, message: `\n  这条路似乎走不通……\n` };
    }
    return { success: true, newRoomId: exit.roomId, message: this.formatRoom(newRoom) };
  }

  /** Remove an item from a room by its displayed name. Returns true if removed. */
  removeItemFromRoom(roomId: string, itemName: string): boolean {
    const room = this.rooms.get(roomId);
    if (!room || !room.items) return false;
    const idx = room.items.indexOf(itemName);
    if (idx === -1) return false;
    room.items.splice(idx, 1);
    return true;
  }

  /** Schedule a single item to respawn in its room after the room's configured interval. */
  scheduleItemRespawn(roomId: string, itemName: string, callback?: () => void): (() => void) | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;
    const seconds = room.itemRespawnSeconds ?? 60;
    if (seconds <= 0) return undefined;
    const doRespawn = () => {
      if (!room.items) room.items = [];
      if (!room.items.includes(itemName)) {
        room.items.push(itemName);
      }
      if (callback) callback();
    };
    if (this.scheduler) {
      const id = `item-respawn:${roomId}:${itemName}`;
      this.scheduler.schedule(id, seconds * 1000, doRespawn);
      return () => this.scheduler!.cancel(id);
    }
    const handle = setTimeout(doRespawn, seconds * 1000);
    return () => clearTimeout(handle);
  }
}
