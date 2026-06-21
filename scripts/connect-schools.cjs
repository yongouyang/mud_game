#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const mapsPath = path.join(__dirname, '..', 'server', 'src', 'data', 'maps.json');
const maps = JSON.parse(fs.readFileSync(mapsPath, 'utf8'));
const rooms = maps.rooms;
const roomById = new Map(rooms.map((r) => [r.id, r]));

// Halls that are not currently reachable from town/square.
const unreachableHalls = [
  'xiaoyao/hall', 'taohua/hall', 'lingjiu/hall', 'shenlong/hall', 'riyue/hall',
  'xueshan/hall', 'tiezhang/hall', 'tangmen/hall', 'murong/hall', 'duan/hall',
  'henshan/hall', 'honghua/hall', 'hu/hall', 'jueqing/hall', 'lingxiao/hall',
  'meizhuang/hall', 'miao/hall', 'ouyang/hall', 'shang/hall', 'songshan/hall',
  'tianlongsi/hall', 'ultra/hall', 'wudu/hall', 'xiakedao/hall', 'xuanming/hall',
  'xuedao/hall', 'yunlong/hall', 'zhenyuan/hall', 'hell/hall',
];

const dirs = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const dirMap = {
  n: 'north', s: 'south', e: 'east', w: 'west',
  ne: 'northeast', nw: 'northwest', se: 'southeast', sw: 'southwest',
};

function addExit(room, direction, targetId) {
  if (!room.exits) room.exits = [];
  room.exits = room.exits.filter((e) => e.direction !== direction);
  room.exits.push({ direction, roomId: targetId });
}

// Build 4 hub rooms, each with up to 8 hall exits.
const hubs = [];
for (let i = 0; i < 4; i++) {
  const hubId = `wilderness/hub${i + 1}`;
  const hallSlice = unreachableHalls.slice(i * 8, (i + 1) * 8);
  const exits = [{ direction: 'down', roomId: i === 0 ? 'wilderness/forest1' : `wilderness/hub${i}` }];
  if (i < 3) exits.push({ direction: 'up', roomId: `wilderness/hub${i + 2}` });
  hallSlice.forEach((hallId, idx) => {
    exits.push({ direction: dirMap[dirs[idx]], roomId: hallId });
  });
  hubs.push({
    id: hubId,
    name: `荒野·门派岔路${i + 1}`,
    description: `这里是一条四通八达的山间岔路，通往江湖上若干门派的山门。`,
    exits,
  });
}

// Add hubs to the world.
for (const hub of hubs) {
  roomById.set(hub.id, hub);
  rooms.push(hub);
}

// Connect forest1 to hub1 via up/down so original n/s/e/w paths stay intact.
addExit(roomById.get('wilderness/forest1'), 'up', 'wilderness/hub1');

// Update each hall's return exit to point to its hub.
for (let i = 0; i < unreachableHalls.length; i++) {
  const hallId = unreachableHalls[i];
  const hubId = `wilderness/hub${Math.floor(i / 8) + 1}`;
  const hall = roomById.get(hallId);
  if (hall && hall.exits && hall.exits.length > 0) {
    hall.exits[0].roomId = hubId;
  }
}

fs.writeFileSync(mapsPath, JSON.stringify(maps, null, 2), 'utf8');
console.log(`Connected ${unreachableHalls.length} school halls via 4 hub rooms.`);
