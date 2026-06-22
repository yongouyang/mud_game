#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'server', 'src', 'data');
const npcsPath = path.join(dataDir, 'npcs.json');
const schoolsPath = path.join(dataDir, 'schools.json');
const mapsPath = path.join(dataDir, 'maps.json');

const npcs = JSON.parse(fs.readFileSync(npcsPath, 'utf8'));
const schools = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));
const maps = JSON.parse(fs.readFileSync(mapsPath, 'utf8'));
const validRooms = new Set(maps.rooms.map((r) => r.id));

function attrTotal(n) {
  return Object.values(n.attributes || {}).reduce((a, b) => a + b, 0);
}

function skillTotal(n) {
  return n.skills.reduce((a, s) => a + s.level, 0);
}

function scoreNpc(n) {
  return attrTotal(n) * 2 + skillTotal(n);
}

const keepIds = new Set();
const schoolMasters = {};
const schoolDisciples = {};

// 1. Keep best master per school and normalize its id to master-<schoolId>.
for (const school of schools) {
  const masters = npcs.filter(
    (n) => n.id === `master-${school.id}` || n.id.startsWith(`master-${school.id}-`),
  );
  if (masters.length > 0) {
    const best = masters.sort((a, b) => scoreNpc(b) - scoreNpc(a))[0];
    const targetId = `master-${school.id}`;
    if (best.id !== targetId) {
      // If another NPC already has the target id, rename that one first to avoid collision.
      const existing = npcs.find((n) => n.id === targetId);
      if (existing) existing.id = `${existing.id}-legacy`;
      best.id = targetId;
      best.name = best.name || `${school.name}掌门`;
    }
    best.roomId = school.joinRoomId;
    best.guarder = true;
    keepIds.add(best.id);
    schoolMasters[school.id] = best;
  }
}

// 2. Keep up to 4 disciples per school.
for (const school of schools) {
  const disciples = npcs.filter((n) => n.id.startsWith(`disciple-${school.id}`));
  const kept = disciples
    .sort((a, b) => scoreNpc(b) - scoreNpc(a))
    .slice(0, 4)
    .map((d) => {
      d.roomId = school.joinRoomId;
      d.guarder = true;
      keepIds.add(d.id);
      return d;
    });
  schoolDisciples[school.id] = kept;
}

// 3. Remove all non-kept NPCs from any school room.
const schoolRoomIds = new Set();
for (const school of schools) {
  for (const roomId of validRooms) {
    if (roomId.startsWith(`${school.id}/`)) schoolRoomIds.add(roomId);
  }
}

for (const n of npcs) {
  if (schoolRoomIds.has(n.roomId) && !keepIds.has(n.id)) {
    n.roomId = null; // mark for relocation/deletion
  }
}

// 4. Preserve key NPCs regardless of location.
const keyNpcIds = new Set(['wang', 'storyteller', 'wolf']);
const keyNpcNames = new Set(['药铺老板']);
for (const n of npcs) {
  if (keyNpcIds.has(n.id) || keyNpcNames.has(n.name)) {
    keepIds.add(n.id);
  }
}

// 5. Relocate town/merchant NPCs to town rooms.
const townRooms = ['town/square', 'town/mainstreet', 'town/northstreet', 'town/weststreet', 'town/inn']
  .filter((r) => validRooms.has(r));
const townPattern = /(city|town|beijing|changan|dali|yangzhou|suzhou|hangzhou|luoyang|nanyang|foshan|chengdu|kaifeng|jingzhou|fuzhou|taiyuan|kunming|lanzhou|xian)-/;

const relocate = [];
for (const n of npcs) {
  if (n.roomId !== null) continue;
  if (keepIds.has(n.id)) continue;
  if (townPattern.test(n.id) || n.id.includes('huoji') || n.id.includes('laoban') || n.id.includes('shangren')) {
    relocate.push(n);
  }
}

// Distribute relocated NPCs round-robin across town rooms.
relocate.forEach((n, idx) => {
  n.roomId = townRooms[idx % townRooms.length];
});

// 6. Cap town rooms.
for (const roomId of townRooms) {
  const inRoom = npcs.filter((n) => n.roomId === roomId && !keepIds.has(n.id));
  if (inRoom.length > 12) {
    // Keep merchants and named NPCs first; delete generic extras.
    const sorted = inRoom.sort((a, b) => {
      const aKey = keyNpcIds.has(a.id) || keyNpcNames.has(a.name) ? 2 : townPattern.test(a.id) ? 1 : 0;
      const bKey = keyNpcIds.has(b.id) || keyNpcNames.has(b.name) ? 2 : townPattern.test(b.id) ? 1 : 0;
      return bKey - aKey;
    });
    for (const n of sorted.slice(12)) {
      n.roomId = null;
    }
  }
}

// 7. Cap wilderness rooms.
for (const roomId of validRooms) {
  if (!roomId.startsWith('wilderness/')) continue;
  const inRoom = npcs.filter((n) => n.roomId === roomId && !keepIds.has(n.id));
  if (inRoom.length > 8) {
    // Keep aggressive/boss NPCs first.
    const sorted = inRoom.sort((a, b) => (b.aggressive || b.boss ? 1 : 0) - (a.aggressive || a.boss ? 1 : 0));
    for (const n of sorted.slice(8)) {
      n.roomId = null;
    }
  }
}

// 8. Generate missing disciples for schools with fewer than 2.
const skillIds = new Set(JSON.parse(fs.readFileSync(path.join(dataDir, 'skills.json'), 'utf8')).map((s) => s.id));
for (const school of schools) {
  const existing = schoolDisciples[school.id] || [];
  if (existing.length >= 2) continue;
  const master = schoolMasters[school.id];
  const needed = 2 - existing.length;
  for (let i = 0; i < needed; i++) {
    const idx = existing.length + i + 1;
    const id = `disciple-${school.id}-${idx}`;
    const con = 10 + Math.floor(Math.random() * 6);
    npcs.push({
      id,
      name: `${school.name || school.id}弟子`,
      description: `一名${school.name || school.id}弟子，正在勤练武功。`,
      roomId: school.joinRoomId,
      attributes: { str: 10, int: 10, con, dex: 10, per: 10, kar: 10 },
      skills: master?.skills?.slice(0, 2).map((s) => ({ skillId: s.skillId, level: Math.max(10, Math.floor(s.level / 3)) })) || [{ skillId: 'force', level: 10 }, { skillId: 'dodge', level: 10 }],
      dialogue: ['师父教导我们，习武先习德。'],
      aggressive: false,
      guarder: true,
      faction: school.id,
      respawnSeconds: 60,
    });
    keepIds.add(id);
  }
}

// 9. Final cleanup: remove NPCs without room or with invalid room.
const cleaned = npcs.filter((n) => n.roomId && validRooms.has(n.roomId));

// Ensure unique ids.
const seen = new Set();
const unique = [];
for (const n of cleaned) {
  if (!seen.has(n.id)) {
    seen.add(n.id);
    unique.push(n);
  }
}

fs.writeFileSync(npcsPath, JSON.stringify(unique, null, 2), 'utf8');
console.log(`NPCs cleaned: ${npcs.length} -> ${unique.length}`);
console.log('Per-room top counts after cleanup:');
const byRoom = {};
for (const n of unique) byRoom[n.roomId] = (byRoom[n.roomId] || 0) + 1;
console.log(Object.entries(byRoom).sort((a, b) => b[1] - a[1]).slice(0, 15));
