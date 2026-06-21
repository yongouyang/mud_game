#!/usr/bin/env node
/**
 * First-pass extraction script for the oiuv_mud LPC source tree.
 * Reads .c skill/NPC/item files and merges them into mud_game JSON data files,
 * preserving any hand-tuned entries that already exist.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const OIUV_ROOT = '/Users/yongouyang/projects/oiuv_mud';
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(PROJECT_ROOT, 'server');
const DATA_DIR = path.join(SERVER_DIR, 'src', 'data');

const OUT = {
  skills: path.join(DATA_DIR, 'skills.json'),
  npcs: path.join(DATA_DIR, 'npcs.json'),
  items: path.join(DATA_DIR, 'items.json'),
};

const SCHOOLS_FILE = path.join(DATA_DIR, 'schools.json');
const MAPS_FILE = path.join(DATA_DIR, 'maps.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return {};
  }
}

function loadArray(p) {
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function walk(dir, predicate) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'obj' || entry.name === '.git') continue;
      out.push(...walk(full, predicate));
    } else if (entry.isFile() && predicate(full, entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function topLevelCFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isFile() && e.name.endsWith('.c'))
    .map((e) => path.join(dir, e.name));
}

function stripAnsi(s) {
  if (!s) return '';
  return s
    .replace(/\$[A-Z_]+\$/g, '')
    .replace(/\b(NOR|HIY|HIR|HIG|HIB|HIW|HIM|HIC|BLU|RED|YEL|MAG|CYN|WHT|BLK|BRED|BGRN|BBLU|BMAG|BCYN|HBRED|HBGRN|HBBLU|HBMAG|HBCYN|HBWHT|HBBLK)\b/g, '')
    .trim();
}

function parseName(content) {
  const m = content.match(/set_name\s*\([\s\S]*?"([^"]+)"/);
  return m ? stripAnsi(m[1]) : '';
}

function parseLong(content) {
  // heredoc: @LONG ... LONG
  let m = content.match(/set\s*\(\s*"long"\s*,\s*@LONG\s*\n([\s\S]*?)\n\s*LONG\b/);
  if (m) return cleanLong(m[1]);
  // alternative heredoc markers seen in oiuv
  m = content.match(/set\s*\(\s*"long"\s*,\s*@TEXT\s*\n([\s\S]*?)\n\s*TEXT\b/);
  if (m) return cleanLong(m[1]);
  // simple quoted string, possibly preceded by ANSI macros
  m = content.match(/set\s*\(\s*"long"\s*,\s*(?:[A-Z_]+\s+)*"([^"]+)"/);
  if (m) return cleanLong(m[1]);
  return '';
}

function cleanLong(text) {
  return stripAnsi(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .slice(0, 240);
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Schools / rooms
// ---------------------------------------------------------------------------

const schools = loadArray(SCHOOLS_FILE);
const schoolByName = new Map();
const schoolIds = new Set();
const schoolById = new Map();
for (const s of schools) {
  schoolByName.set(s.name, s.id);
  schoolIds.add(s.id);
  schoolById.set(s.id, s);
}

const maps = readJson(MAPS_FILE);
const roomIds = (maps.rooms || []).map((r) => r.id);
const roomsByPrefix = new Map();
for (const id of roomIds) {
  const prefix = id.split('/')[0];
  if (!roomsByPrefix.has(prefix)) roomsByPrefix.set(prefix, []);
  roomsByPrefix.get(prefix).push(id);
}

// Rooms that existing tests rely on being empty (or containing only specific NPCs).
const PROTECTED_ROOMS = new Set([
  'town/square',
  'town/mainstreet',
  'town/training',
  'town/inn',
  'town/inn_upstairs',
  'wilderness/forest1',
]);

const safeGenericRooms = roomIds.filter((id) => !PROTECTED_ROOMS.has(id));

const roomCounters = new Map();
function roundRobinRoom(pool) {
  const idx = roomCounters.get(pool) || 0;
  roomCounters.set(pool, idx + 1);
  return pool[idx % pool.length];
}

function schoolRoom(schoolId, excludeRoom) {
  let pool = roomsByPrefix.get(schoolId) || [];
  if (excludeRoom) pool = pool.filter((id) => id !== excludeRoom);
  if (pool.length) return roundRobinRoom(pool);
  return roundRobinRoom(safeGenericRooms);
}

// ---------------------------------------------------------------------------
// Skills
// ---------------------------------------------------------------------------

const KNOWN_SKILL_TYPES = new Set([
  'parry', 'dodge', 'force', 'strike', 'unarmed', 'cuff', 'finger', 'hand', 'claw', 'literate',
]);
const WEAPON_USAGES = new Set(['sword', 'blade', 'staff', 'throwing', 'whip']);

function skillNameFromHelp(id) {
  const helpPath = path.join(OIUV_ROOT, 'help', id);
  if (!fs.existsSync(helpPath)) return '';
  const text = fs.readFileSync(helpPath, 'utf8');
  const m = text.match(/【(.+?)介绍】/);
  return m ? stripAnsi(m[1]) : '';
}

function extractSkill(file) {
  const id = path.basename(file, '.c');
  const content = fs.readFileSync(file, 'utf8');
  const firstLine = content.split(/\r?\n/)[0] || '';

  // name: first-line comment after the filename
  let name = '';
  const cm = firstLine.match(/\/\/\s*\S+\.c\s+(.+)$/);
  if (cm) name = stripAnsi(cm[1]).trim();
  if (!name) name = skillNameFromHelp(id);
  if (!name) name = id;

  // type detection
  const usages = [];
  const usageMatches = content.matchAll(/usage\s*==\s*"([^"]+)"/g);
  for (const um of usageMatches) usages.push(um[1]);

  let type = 'strike';
  // Prefer known usage types first
  for (const u of usages) {
    if (KNOWN_SKILL_TYPES.has(u)) {
      type = u;
      break;
    }
  }
  // Weapon usages are not in the SkillType union yet
  if (type === 'strike') {
    for (const u of usages) {
      if (WEAPON_USAGES.has(u)) {
        type = 'strike';
        break;
      }
    }
  }
  if (type === 'strike') {
    if (usages.includes('force') || /force|xinfa|shengong|neigong|qigong/.test(id)) {
      type = 'force';
    } else if (id === 'dodge' || usages.includes('dodge')) {
      type = 'dodge';
    } else if (id === 'parry' || usages.includes('parry')) {
      type = 'parry';
    } else if (id === 'literate' || usages.includes('literate')) {
      type = 'literate';
    } else if (KNOWN_SKILL_TYPES.has(id)) {
      type = id;
    }
  }

  // description
  let description = '';
  const descMatch = content.match(/\/\/\s*\S+\.c\s+(.+)$/);
  if (descMatch) description = `一门${stripAnsi(descMatch[1]).trim()}，需勤加修炼。`;
  if (!description) description = `一门${name}功夫。`;

  // damage from mapping *action
  let damageBase = 0;
  let damageScale = 0;
  const actionBlock = content.match(/mapping\s*\*action\s*=\s*\(\{([\s\S]*?)\}\)\s*;/);
  if (actionBlock) {
    const block = actionBlock[1];
    const forces = [];
    const damages = [];
    const lvls = [];
    for (const m of block.matchAll(/"force"\s*:\s*(\d+)/g)) forces.push(Number(m[1]));
    for (const m of block.matchAll(/"damage"\s*:\s*(\d+)/g)) damages.push(Number(m[1]));
    for (const m of block.matchAll(/"lvl"\s*:\s*(\d+)/g)) lvls.push(Number(m[1]));
    if (forces.length) {
      const avgForce = forces.reduce((a, b) => a + b, 0) / forces.length;
      const avgDamage = damages.length ? damages.reduce((a, b) => a + b, 0) / damages.length : avgForce;
      const avgLvl = lvls.length ? lvls.reduce((a, b) => a + b, 0) / lvls.length : 0;
      const lvlFactor = 1 + avgLvl / 200;
      damageBase = clamp(round1((avgForce / 10) * lvlFactor), 0, 15);
      damageScale = clamp(round1((avgDamage / 20) * lvlFactor), 0, 1.5);
    }
  }
  if (damageBase === 0 && !['force', 'dodge', 'parry', 'literate'].includes(type)) {
    damageBase = 3;
    damageScale = 0.3;
  }

  // requirements
  let requireSkill = undefined;
  let requireLevel = undefined;
  const reqMatch = content.match(/query_skill\s*\(\s*"([^"]+)"(?:\s*,\s*1)?\s*\)\s*<\s*(\d+)/);
  if (reqMatch) {
    requireSkill = reqMatch[1];
    requireLevel = Number(reqMatch[2]);
  }

  // school
  let schoolId = null;
  for (const token of id.split('-')) {
    if (schoolIds.has(token)) {
      schoolId = token;
      break;
    }
  }

  // performs
  const performs = [];
  const hasPerformFn = /perform_action_file/.test(content);
  const performDir = path.join(path.dirname(file), id);
  if (hasPerformFn && fs.existsSync(performDir)) {
    const performFiles = topLevelCFiles(performDir);
    const avgForce = (() => {
      const m = content.match(/mapping\s*\*action\s*=\s*\(\{([\s\S]*?)\}\)\s*;/);
      if (!m) return 100;
      const nums = [...m[1].matchAll(/"force"\s*:\s*(\d+)/g)].map((x) => Number(x[1]));
      return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 100;
    })();
    const multiplier = clamp(round1(1.5 + avgForce / 300), 1.5, 3.0);
    for (const pf of performFiles) {
      const pname = path.basename(pf, '.c');
      const pcontent = fs.readFileSync(pf, 'utf8');
      const pm = pcontent.match(/"([^"]+[\u4e00-\u9fa5][^"]*)"/);
      const pdesc = pm ? stripAnsi(pm[1]).trim() : `${name}的绝招`;
      performs.push({
        name: pname,
        desc: pdesc,
        multiplier,
        targetType: 'single',
      });
    }
  }
  if (performs.length === 0) {
    performs.push({
      name: `${name}·绝`,
      desc: `一招${name}`,
      multiplier: 2,
      targetType: 'single',
    });
  }

  const record = {
    id,
    name,
    type,
    description,
    damageBase,
    damageScale,
    schoolId,
    performs,
  };
  if (requireSkill !== undefined) {
    record.requireSkill = requireSkill;
    record.requireLevel = requireLevel;
  }
  return record;
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

function scaleAttr(val) {
  return clamp(Math.round(Number(val) * 0.3), 5, 30);
}

function scaleSkillLevel(val) {
  return clamp(Math.round(Number(val) / 4), 1, 50);
}

function extractNpc(file) {
  const content = fs.readFileSync(file, 'utf8');
  const base = path.basename(file, '.c');
  const parts = file.split('/');

  let prefix = '';
  const classIdx = parts.indexOf('class');
  const dIdx = parts.indexOf('d');
  if (classIdx >= 0 && parts[classIdx + 1]) {
    prefix = parts[classIdx + 1];
  } else if (dIdx >= 0 && parts[dIdx + 1]) {
    prefix = parts[dIdx + 1];
  }

  const name = parseName(content) || base;
  const description = parseLong(content) || `一个${name}。`;

  const isMaster = /inherit\s+F_MASTER/.test(content);

  // attributes
  const attrs = { str: 10, int: 10, con: 10, dex: 10 };
  for (const key of Object.keys(attrs)) {
    const m = content.match(new RegExp(`set\\s*\\(\\s*"${key}"\\s*,\\s*(\\d+)\\s*\\)`));
    if (m) attrs[key] = scaleAttr(m[1]);
  }

  // skills
  const skillMap = new Map();
  for (const m of content.matchAll(/set_skill\s*\(\s*"([^"]+)"\s*,\s*(\d+)\s*\)/g)) {
    skillMap.set(m[1], scaleSkillLevel(m[2]));
  }
  // mapped skills
  for (const m of content.matchAll(/(?:map_skill|prepare_skill)\s*\(\s*"[^"]+"\s*,\s*"([^"]+)"\s*\)/g)) {
    const sid = m[1];
    if (!skillMap.has(sid)) skillMap.set(sid, 1);
  }
  const skills = [...skillMap.entries()].map(([skillId, level]) => ({ skillId, level }));

  // faction
  let faction = undefined;
  const famMatch = content.match(/create_family\s*\(\s*"([^"]+)"/);
  if (famMatch) {
    const cn = stripAnsi(famMatch[1]);
    faction = schoolByName.get(cn) || cn;
  }

  // id: prefer master-<school> for missing masters, otherwise prefix-base
  let id;
  if (isMaster && faction && typeof faction === 'string' && schoolIds.has(faction)) {
    id = `master-${faction}`;
  } else {
    id = prefix ? `${prefix}-${base}` : base;
  }

  // room: keep extracted NPCs out of the protected rooms used by tests.
  let roomId;
  if (isMaster && faction && typeof faction === 'string' && schoolIds.has(faction)) {
    roomId = schoolById.get(faction).joinRoomId;
  } else if (faction && typeof faction === 'string' && schoolIds.has(faction)) {
    const joinRoomId = schoolById.get(faction).joinRoomId;
    roomId = schoolRoom(faction, joinRoomId);
  } else if (prefix && roomsByPrefix.has(prefix)) {
    const pool = (roomsByPrefix.get(prefix) || []).filter((id) => !PROTECTED_ROOMS.has(id));
    roomId = pool.length ? roundRobinRoom(pool) : roundRobinRoom(safeGenericRooms);
  } else {
    roomId = roundRobinRoom(safeGenericRooms);
  }

  // aggressive: parse the source intent, but keep extracted NPCs non-aggressive
  // by default so that placing hundreds of them does not break test rooms or
  // the starting player experience. Bosses and obvious mobs can be flipped by
  // hand later.
  let aggressive = false;
  const attitudeMatch = /set\s*\(\s*"attitude"\s*,\s*"aggressive"\s*\)/.test(content);
  const shenMatch = content.match(/set\s*\(\s*"shen_type"\s*,\s*(-?\d+)\s*\)/);
  const wouldBeAggressive = attitudeMatch || (shenMatch && Number(shenMatch[1]) < 0 && !isMaster);
  // Leave aggressive=false for the first pass to avoid interfering with tests.
  void wouldBeAggressive;

  // guarder
  const guarder = Boolean(faction && !isMaster);

  // respawn / boss
  const expMatch = content.match(/set\s*\(\s*"combat_exp"\s*,\s*(\d+)\s*\)/);
  const qiMatch = content.match(/set\s*\(\s*"max_qi"\s*,\s*(\d+)\s*\)/);
  const exp = expMatch ? Number(expMatch[1]) : 0;
  const qi = qiMatch ? Number(qiMatch[1]) : 0;
  const boss = !isMaster && (exp > 1_000_000 || qi > 5_000 || /boss/i.test(base));
  const respawnSeconds = isMaster ? undefined : clamp(30 + Math.floor(exp / 5_000), 30, 300) || 60;

  // drops
  const drops = [];
  for (const m of content.matchAll(/carry_object\s*\(\s*"([^"]+)"\s*\)/g)) {
    const itemPath = m[1];
    const itemId = path.basename(itemPath, '.c');
    if (itemId) drops.push({ itemId, chance: 1.0, minQty: 1, maxQty: 1 });
  }
  if (!isMaster && !drops.some((d) => d.itemId === 'silver')) {
    drops.push({ itemId: 'silver', chance: 0.6, minQty: 1, maxQty: 10 });
  }
  if (boss && !drops.some((d) => d.itemId === 'boss-token')) {
    drops.push({ itemId: 'boss-token', chance: 1.0, minQty: 1, maxQty: 1 });
  }

  const dialogue = [`${name}看着你，没有说话。`];

  const record = {
    id,
    name,
    description,
    roomId,
    dialogue,
    attributes: attrs,
    skills,
    aggressive,
    faction,
    guarder,
    respawnSeconds,
    boss,
    drops,
  };
  if (faction === undefined) delete record.faction;
  if (guarder === undefined) delete record.guarder;
  if (respawnSeconds === undefined) delete record.respawnSeconds;
  if (!boss) delete record.boss;
  if (drops.length === 0) delete record.drops;
  return record;
}

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

function extractItem(file, dirType) {
  const content = fs.readFileSync(file, 'utf8');
  const id = path.basename(file, '.c');
  const name = parseName(content) || id;
  const description = parseLong(content) || `一个${name}。`;

  let type = 'misc';
  if (dirType === 'weapon') type = 'weapon';
  else if (dirType === 'cloth') type = 'armor';
  else if (dirType === 'pill') type = 'medicine';

  const record = { id, name, type, description };

  if (type === 'weapon') {
    const initMatch = content.match(/init_(\w+)\s*\(\s*(\d+)\s*\)/);
    if (initMatch) {
      record.weaponType = initMatch[1].toLowerCase();
      record.attrBonus = { str: Math.round(Number(initMatch[2]) / 3) };
    } else {
      const inheritMatch = content.match(/inherit\s+(SWORD|BLADE|STAFF|THROWING|WHIP|HAMMER|SPEAR|AXE|CLUB|DAGGER|FORK)/i);
      if (inheritMatch) record.weaponType = inheritMatch[1].toLowerCase();
    }
  } else if (type === 'armor') {
    const armorMatch = content.match(/set\s*\(\s*"armor_prop\/armor"\s*,\s*(\d+)\s*\)/);
    if (armorMatch) {
      record.attrBonus = { con: Number(armorMatch[1]) * 2 };
    }
  } else if (type === 'medicine') {
    const pointMatch = content.match(/set\s*\(\s*"pill_point"\s*,\s*(\d+)\s*\)/);
    const skillMatch = content.match(/set\s*\(\s*"pill_skill"\s*,\s*"([^"]+)"\s*\)/);
    if (pointMatch) {
      const point = Number(pointMatch[1]);
      const pillSkill = skillMatch ? skillMatch[1] : '';
      const value = clamp(Math.round(point / 100), 10, 500);
      record.effect = pillSkill === 'force' ? { mp: value } : { hp: value };
    }
  }

  return record;
}

// ---------------------------------------------------------------------------
// Merge & write
// ---------------------------------------------------------------------------

function mergeById(existing, incoming) {
  const map = new Map();
  for (const r of existing) map.set(r.id, r);
  let added = 0;
  let skipped = 0;
  for (const r of incoming) {
    if (map.has(r.id)) {
      skipped++;
    } else {
      map.set(r.id, r);
      added++;
    }
  }
  const arr = [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { arr, added, skipped };
}

function main() {
  // Skills
  const skillFiles = topLevelCFiles(path.join(OIUV_ROOT, 'kungfu', 'skill'));
  const extractedSkills = skillFiles.map(extractSkill);
  const existingSkills = loadArray(OUT.skills);
  const skillsResult = mergeById(existingSkills, extractedSkills);
  writeJson(OUT.skills, skillsResult.arr);

  // NPCs
  const npcFiles = [];
  // class/*/*.c
  const classRoot = path.join(OIUV_ROOT, 'kungfu', 'class');
  if (fs.existsSync(classRoot)) {
    npcFiles.push(...walk(classRoot, (f) => f.endsWith('.c')));
  }
  // d/*/npc/*.c (skip obj subdirs)
  const dRoot = path.join(OIUV_ROOT, 'd');
  if (fs.existsSync(dRoot)) {
    for (const area of fs.readdirSync(dRoot, { withFileTypes: true })) {
      if (!area.isDirectory()) continue;
      const npcDir = path.join(dRoot, area.name, 'npc');
      if (!fs.existsSync(npcDir)) continue;
      npcFiles.push(...walk(npcDir, (f, n) => f.endsWith('.c') && !f.includes('/obj/')));
    }
  }

  // de-duplicate file list (same file may appear from multiple sources)
  const uniqueNpcFiles = [...new Set(npcFiles)];

  // Make ids unique across the extracted set
  const seenIds = new Set();
  const extractedNpcs = [];
  for (const file of uniqueNpcFiles) {
    let npc = extractNpc(file);
    if (seenIds.has(npc.id)) {
      const original = npc.id;
      let counter = 2;
      while (seenIds.has(`${original}-${counter}`)) counter++;
      npc = { ...npc, id: `${original}-${counter}` };
    }
    seenIds.add(npc.id);
    extractedNpcs.push(npc);
  }

  const existingNpcs = loadArray(OUT.npcs);
  const npcsResult = mergeById(existingNpcs, extractedNpcs);
  writeJson(OUT.npcs, npcsResult.arr);

  // Items
  const itemFiles = [];
  const itemDirs = [
    { dir: path.join(OIUV_ROOT, 'clone', 'weapon'), type: 'weapon' },
    { dir: path.join(OIUV_ROOT, 'clone', 'cloth'), type: 'cloth' },
    { dir: path.join(OIUV_ROOT, 'clone', 'fam', 'pill'), type: 'pill' },
  ];
  for (const { dir, type } of itemDirs) {
    if (!fs.existsSync(dir)) continue;
    for (const f of topLevelCFiles(dir)) {
      itemFiles.push({ file: f, type });
    }
  }
  const extractedItems = itemFiles.map(({ file, type }) => extractItem(file, type));
  const existingItems = loadArray(OUT.items);
  const itemsResult = mergeById(existingItems, extractedItems);
  writeJson(OUT.items, itemsResult.arr);

  console.log('Extraction complete:');
  console.log(`  skills:  extracted ${extractedSkills.length}, added ${skillsResult.added}, preserved ${skillsResult.skipped}`);
  console.log(`  npcs:    extracted ${extractedNpcs.length}, added ${npcsResult.added}, preserved ${npcsResult.skipped}`);
  console.log(`  items:   extracted ${extractedItems.length}, added ${itemsResult.added}, preserved ${itemsResult.skipped}`);

  // Run server tests
  console.log('\nRunning server tests...');
  const result = spawnSync('npx', ['vitest', 'run'], {
    cwd: SERVER_DIR,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.status !== 0) {
    console.log(`\nTests finished with exit code ${result.status}. Output JSON was still written for inspection.`);
  } else {
    console.log('\nAll tests passed.');
  }
}

main();
