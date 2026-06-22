#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'server', 'src', 'data');
const npcsPath = path.join(dataDir, 'npcs.json');
const itemsPath = path.join(dataDir, 'items.json');

const npcs = JSON.parse(fs.readFileSync(npcsPath, 'utf8'));
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const itemIds = new Set(items.map((i) => i.id));

function setDrops(npcId, drops) {
  const npc = npcs.find((n) => n.id === npcId);
  if (!npc) return;
  npc.drops = drops.filter((d) => itemIds.has(d.itemId));
}

// Common mob drops.
setDrops('wolf', [
  { itemId: 'wolf-pelt', chance: 0.7, minQty: 1, maxQty: 1 },
  { itemId: 'silver', chance: 1.0, minQty: 3, maxQty: 8 },
]);
setDrops('bandit', [
  { itemId: 'bandit-token', chance: 0.8, minQty: 1, maxQty: 1 },
  { itemId: 'silver', chance: 1.0, minQty: 8, maxQty: 18 },
]);
setDrops('bear', [
  { itemId: 'bear-gall', chance: 1.0, minQty: 1, maxQty: 1 },
  { itemId: 'silver', chance: 1.0, minQty: 15, maxQty: 35 },
]);

// Trim the overstocked generate-chinese boss to a meaningful drop table.
setDrops('generate-chinese', [
  { itemId: 'iron-sword', chance: 0.6, minQty: 1, maxQty: 1 },
  { itemId: 'leather-armor', chance: 0.5, minQty: 1, maxQty: 1 },
  { itemId: 'school-token', chance: 0.4, minQty: 1, maxQty: 1 },
  { itemId: 'silver', chance: 1.0, minQty: 80, maxQty: 150 },
]);

// Ensure every boss NPC has at least silver + boss-token.
for (const npc of npcs) {
  if (!npc.boss) continue;
  if (!npc.drops || npc.drops.length === 0) {
    npc.drops = [
      { itemId: 'silver', chance: 1.0, minQty: 50, maxQty: 100 },
      { itemId: 'boss-token', chance: 1.0, minQty: 1, maxQty: 1 },
    ];
  }
  const ids = new Set(npc.drops.map((d) => d.itemId));
  if (!ids.has('silver')) npc.drops.push({ itemId: 'silver', chance: 1.0, minQty: 30, maxQty: 60 });
  if (!ids.has('boss-token')) npc.drops.push({ itemId: 'boss-token', chance: 1.0, minQty: 1, maxQty: 1 });
}

fs.writeFileSync(npcsPath, JSON.stringify(npcs, null, 2), 'utf8');
console.log('Mob and boss drops tuned.');
