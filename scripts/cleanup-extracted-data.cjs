#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'server', 'src', 'data');

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));
}

function save(name, data) {
  fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data, null, 2), 'utf8');
}

const skills = load('skills.json');
const npcs = load('npcs.json');
const items = load('items.json');
const itemIds = new Set(items.map((i) => i.id));

// --- Cleanup skills ---
const weaponRules = [
  { keys: ['剑', 'jian', 'sword'], type: 'sword' },
  { keys: ['刀', 'dao', 'blade'], type: 'blade' },
  { keys: ['杖', '棍', 'staff', 'zhang'], type: 'staff' },
  { keys: ['鞭', 'bian', 'whip'], type: 'whip' },
  { keys: ['暗器', 'throwing', 'anqi'], type: 'throwing' },
];

function detectWeaponType(name, id) {
  const hay = (name + id).toLowerCase();
  for (const rule of weaponRules) {
    if (rule.keys.some((k) => hay.includes(k.toLowerCase()))) return rule.type;
  }
  return null;
}

for (const s of skills) {
  const weaponType = detectWeaponType(s.name, s.id);
  if (weaponType && (s.type === 'parry' || s.type === 'strike')) {
    s.type = weaponType;
  }
  if (s.requireLevel && s.requireLevel > 100) {
    s.requireLevel = Math.min(100, Math.max(10, Math.floor(s.requireLevel / 5)));
  }
  if (s.requireSkill && !itemIds.has(s.requireSkill) && !skills.find((x) => x.id === s.requireSkill)) {
    // Keep valid skill ids; invalid ones will just fail learnSkill gracefully.
  }
  if (s.damageBase > 15) s.damageBase = Math.round(s.damageBase / 3);
  if (s.damageScale > 1.5) s.damageScale = Math.round((s.damageScale / 3) * 10) / 10;
  if (s.damageBase < 0) s.damageBase = 0;
  if (s.damageScale < 0) s.damageScale = 0;
  if (!s.performs || s.performs.length === 0) {
    s.performs = [{ name: `${s.name}·绝`, desc: `一招${s.name}`, multiplier: 2, targetType: 'single' }];
  }
  for (const p of s.performs) {
    if (!p.targetType) p.targetType = 'single';
    if (p.multiplier === undefined || p.multiplier <= 0) p.multiplier = 2;
    if (p.multiplier > 5) p.multiplier = 5;
  }
}

// --- Cleanup items ---
for (const i of items) {
  // Correct mis-categorized armor pieces.
  if (i.type === 'weapon' && /(甲|衣|袍|护甲|丝)$/.test(i.name)) {
    i.type = 'armor';
    if (!i.attrBonus) i.attrBonus = { con: 2 };
  }
  // Assign weaponType to bows/crossbows.
  if (i.type === 'weapon' && /(弓|弩|射)/.test(i.name) && !i.weaponType) {
    i.weaponType = 'bow';
  }
}

// --- Cleanup NPC skills ---
const skillIds = new Set(skills.map((s) => s.id));
for (const n of npcs) {
  if (n.skills) {
    n.skills = n.skills.filter((sk) => skillIds.has(sk.skillId));
  }
}

// --- Cleanup NPC drops ---
for (const n of npcs) {
  if (!n.drops) continue;
  n.drops = n.drops.filter((d) => itemIds.has(d.itemId) || d.itemId === 'silver');
  // Remove empty drop arrays
  if (n.drops.length === 0) delete n.drops;
}

save('skills.json', skills);
save('npcs.json', npcs);
save('items.json', items);

console.log(`Cleaned ${skills.length} skills, ${npcs.length} NPCs, ${items.length} items.`);
