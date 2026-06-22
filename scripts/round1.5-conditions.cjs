#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'server', 'src', 'data');
const conditionsPath = path.join(dataDir, 'conditions.json');
const itemsPath = path.join(dataDir, 'items.json');
const shopsPath = path.join(dataDir, 'shops.json');

const conditions = JSON.parse(fs.readFileSync(conditionsPath, 'utf8'));
const items = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
const shops = JSON.parse(fs.readFileSync(shopsPath, 'utf8'));

const existingIds = new Set(conditions.map((c) => c.id));

const newConditions = [
  {
    id: 'snake_poison',
    name: '蛇毒',
    category: 'poison',
    tickSeconds: 5,
    baseDamage: 6,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 12,
    messages: {
      apply: '你被毒蛇咬中，蛇毒迅速蔓延！',
      tick: '蛇毒发作，伤口发麻发黑。',
      cure: '蛇毒被清除，伤口消肿。',
      dispel: '你运功将蛇毒逼出伤口。',
    },
  },
  {
    id: 'corpse_poison',
    name: '尸毒',
    category: 'poison',
    tickSeconds: 6,
    baseDamage: 8,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 15,
    messages: {
      apply: '腐臭的尸毒侵入经脉，你中了尸毒！',
      tick: '尸毒蚀骨，你浑身散发出腐臭气息。',
      cure: '尸毒被化解，身体恢复温暖。',
      dispel: '你运功将尸毒逼出体外。',
    },
  },
  {
    id: 'internal_injury',
    name: '内伤',
    category: 'internal',
    tickSeconds: 8,
    baseDamage: 5,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 15,
    messages: {
      apply: '你经脉受震，受了不轻的内伤！',
      tick: '内息紊乱，胸口隐隐作痛。',
      cure: '内伤痊愈，内息运行如初。',
      dispel: '你调息良久，压下了内伤。',
    },
  },
  {
    id: 'qi_deviation',
    name: '走火入魔',
    category: 'internal',
    tickSeconds: 5,
    baseDamage: 10,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 25,
    messages: {
      apply: '你内力逆行，竟有走火入魔之相！',
      tick: '真气乱窜，你痛苦难当。',
      cure: '你稳住心神，总算没有堕入魔道。',
      dispel: '你强行收束真气，化去走火入魔之厄。',
    },
  },
  {
    id: 'drugged',
    name: '麻沸',
    category: 'special',
    tickSeconds: 6,
    baseDamage: 0,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 10,
    messages: {
      apply: '你吸入麻药，四肢渐渐失去知觉。',
      tick: '麻药未消，你动作迟缓。',
      cure: '麻药效力过去，你恢复了知觉。',
      dispel: '你运功将麻药逼出体外。',
    },
  },
  {
    id: 'hangover',
    name: '宿醉',
    category: 'special',
    tickSeconds: 10,
    baseDamage: 0,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 8,
    messages: {
      apply: '你昨晚喝得太多，现在头痛欲裂。',
      tick: '宿醉让你精神萎靡。',
      cure: '你彻底酒醒了。',
      dispel: '你运功化解了残存的酒意。',
    },
  },
  {
    id: 'bleeding',
    name: '流血',
    category: 'wound',
    tickSeconds: 4,
    baseDamage: 4,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 8,
    messages: {
      apply: '伤口血流不止，你陷入了流血状态！',
      tick: '鲜血从伤口不断渗出。',
      cure: '你止住了流血。',
      dispel: '你点穴止血，伤口不再流血。',
    },
  },
  {
    id: 'ill_zhongshu',
    name: '中暑',
    category: 'illness',
    tickSeconds: 8,
    baseDamage: 3,
    damageType: 'hp',
    defaultLevel: 1,
    dispelCostBase: 6,
    messages: {
      apply: '烈日当空，你感到头晕目眩，似是中暑了。',
      tick: '暑气蒸腾，你口干舌燥。',
      cure: '暑气消退，你恢复了清爽。',
      dispel: '你运功驱散了一身暑气。',
    },
  },
];

for (const c of newConditions) {
  if (!existingIds.has(c.id)) {
    conditions.push(c);
    existingIds.add(c.id);
  }
}

const itemIds = new Set(items.map((i) => i.id));
const newItems = [
  {
    id: 'qingshen-dan',
    name: '清神丹',
    type: 'medicine',
    description: '清心明神的丹药，可缓解元素外伤。',
    effect: { cureCategory: 'elemental', hp: 20 },
  },
  {
    id: 'liangjie-san',
    name: '良解散',
    type: 'medicine',
    description: '专治风寒暑热的药散，可驱除疾病。',
    effect: { cureCategory: 'illness', hp: 20 },
  },
  {
    id: 'huoxue-dan',
    name: '活血丹',
    type: 'medicine',
    description: '活血化瘀的丹药，可治愈外伤流血。',
    effect: { cureCategory: 'wound', hp: 50 },
  },
  {
    id: 'zhenqi-dan',
    name: '镇气丹',
    type: 'medicine',
    description: '稳固真气的丹药，可平息内伤走火。',
    effect: { cureCategory: 'internal', mp: 30 },
  },
  {
    id: 'xingshen-cao',
    name: '醒神草',
    type: 'medicine',
    description: '清香扑鼻的草药，可醒酒解毒麻。',
    effect: { cureCategory: 'special', hp: 10 },
  },
];

for (const i of newItems) {
  if (!itemIds.has(i.id)) {
    items.push(i);
    itemIds.add(i.id);
  }
}

// Add new medicines to herb shop.
const herbShop = shops.find((s) => s.id === 'herb-shop');
if (herbShop) {
  for (const i of newItems) {
    if (herbShop.items[i.id] === undefined) {
      herbShop.items[i.id] = 40;
    }
  }
}

fs.writeFileSync(conditionsPath, JSON.stringify(conditions, null, 2), 'utf8');
fs.writeFileSync(itemsPath, JSON.stringify(items, null, 2), 'utf8');
fs.writeFileSync(shopsPath, JSON.stringify(shops, null, 2), 'utf8');

console.log(`Conditions: ${conditions.length} total`);
console.log(`Items: ${items.length} total`);
console.log(`New medicines added to herb shop: ${newItems.map((i) => i.id).join(', ')}`);
