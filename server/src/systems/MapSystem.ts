import { Room, Exit } from '../models/Room.js';
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

  constructor() {
    for (const room of mapsData.rooms as Room[]) {
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
}
