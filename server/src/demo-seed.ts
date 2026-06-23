import { Player, createPlayer, PlayerAttributes } from './models/Player.js';
import { PlayerSkill } from './models/Skill.js';
import { InventoryItem } from './models/Item.js';
import { PersistenceSystem } from './systems/PersistenceSystem.js';
import { PlayerManager } from './systems/PlayerManager.js';
import { SchoolSystem } from './systems/SchoolSystem.js';

export interface DemoAccount {
  username: string;
  password: string;
  name: string;
  attributes: PlayerAttributes;
  schoolId?: string;
  roomId: string;
  skills: PlayerSkill[];
  silver: number;
  pot: number;
  inventory?: InventoryItem[];
  isAdmin?: boolean;
}

/**
 * Pre-built demo/test characters.
 *
 * These accounts are intended for local manual testing only. They are NOT
 * created in production unless ENABLE_DEMO_ACCOUNTS=true is set.
 */
export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    username: 'demo',
    password: 'some-secret',
    name: '无名侠客',
    attributes: { str: 15, int: 10, con: 15, dex: 10, per: 10, kar: 10 },
    roomId: 'town/square',
    skills: [],
    silver: 5000,
    pot: 10000,
  },
  {
    username: 'shaolin',
    password: 'test',
    name: '少林弟子',
    attributes: { str: 12, int: 10, con: 15, dex: 10, per: 10, kar: 10 },
    schoolId: 'shaolin',
    roomId: 'shaolin/hall',
    skills: [
      { skillId: 'parry', level: 30 },
      { skillId: 'dodge', level: 30 },
      { skillId: 'force', level: 30 },
      { skillId: 'cuff', level: 30 },
      { skillId: 'luohan-quan', level: 30 },
    ],
    silver: 5000,
    pot: 5000,
  },
  {
    username: 'wudang',
    password: 'test',
    name: '武当弟子',
    attributes: { str: 10, int: 12, con: 10, dex: 15, per: 10, kar: 10 },
    schoolId: 'wudang',
    roomId: 'wudang/hall',
    skills: [
      { skillId: 'parry', level: 30 },
      { skillId: 'dodge', level: 30 },
      { skillId: 'force', level: 30 },
      { skillId: 'cuff', level: 30 },
      { skillId: 'taiji-quan', level: 30 },
      { skillId: 'qinggong', level: 30 },
      { skillId: 'neigong-xinfa', level: 30 },
    ],
    silver: 5000,
    pot: 5000,
  },
  {
    username: 'huashan',
    password: 'test',
    name: '华山弟子',
    attributes: { str: 12, int: 10, con: 10, dex: 13, per: 12, kar: 10 },
    schoolId: 'huashan',
    roomId: 'huashan/peak',
    skills: [
      { skillId: 'parry', level: 30 },
      { skillId: 'dodge', level: 30 },
      { skillId: 'force', level: 30 },
      { skillId: 'cuff', level: 20 },
      { skillId: 'sword', level: 30 },
      { skillId: 'huashan-jian', level: 30 },
      { skillId: 'dugu-jiujian', level: 20 },
      { skillId: 'poyu-quan', level: 20 },
    ],
    silver: 5000,
    pot: 5000,
  },
  {
    username: 'gaibang',
    password: 'test',
    name: '丐帮弟子',
    attributes: { str: 15, int: 10, con: 12, dex: 10, per: 10, kar: 10 },
    schoolId: 'gaibang',
    roomId: 'gaibang/hq',
    skills: [
      { skillId: 'parry', level: 30 },
      { skillId: 'dodge', level: 30 },
      { skillId: 'force', level: 30 },
      { skillId: 'cuff', level: 30 },
      { skillId: 'staff', level: 30 },
      { skillId: 'dagou-bang', level: 30 },
      { skillId: 'xianglong-zhang', level: 30 },
    ],
    silver: 5000,
    pot: 5000,
  },
  {
    username: 'rich',
    password: 'test',
    name: '富商',
    attributes: { str: 10, int: 10, con: 10, dex: 10, per: 10, kar: 15 },
    roomId: 'town/square',
    skills: [
      { skillId: 'parry', level: 20 },
      { skillId: 'dodge', level: 20 },
      { skillId: 'force', level: 20 },
      { skillId: 'cuff', level: 20 },
    ],
    silver: 50000,
    pot: 1000,
  },
];

function hashPassword(username: string, password: string): string {
  return Buffer.from(`${username}:${password}`).toString('base64');
}

/** Returns true when demo accounts should be seeded on startup. */
export function shouldSeedDemoAccounts(): boolean {
  return process.env['NODE_ENV'] !== 'production' || process.env['ENABLE_DEMO_ACCOUNTS'] === 'true';
}

/**
 * Seed demo accounts if they do not already exist.
 *
 * @returns Lists of usernames that were created and those that were skipped.
 */
export function seedDemoAccounts(
  persistence: PersistenceSystem,
  players: PlayerManager,
  schools: SchoolSystem,
): { created: string[]; skipped: string[] } {
  const result: { created: string[]; skipped: string[] } = { created: [], skipped: [] };

  if (!shouldSeedDemoAccounts()) {
    return result;
  }

  // Repair any demo players whose id was previously corrupted to a socket id.
  for (const demo of DEMO_ACCOUNTS) {
    if (persistence.getUserHash(demo.username) && !players.getPlayer(demo.username)) {
      for (const p of players.getAllPlayers()) {
        if (p.name === demo.name && p.id !== demo.username) {
          const oldId = p.id;
          p.id = demo.username;
          players.setPlayer(p);
          players.removePlayer(oldId);
          break;
        }
      }
    }
  }

  for (const demo of DEMO_ACCOUNTS) {
    const userExists = !!persistence.getUserHash(demo.username);
    const playerExists = !!players.getPlayer(demo.username);
    if (userExists && playerExists) {
      result.skipped.push(demo.username);
      continue;
    }

    if (!userExists) {
      persistence.saveUser(demo.username, hashPassword(demo.username, demo.password));
    }

    const player = createPlayer(demo.username, demo.name, { ...demo.attributes });
    player.currentRoom = demo.roomId;
    player.skills = demo.skills.map((s) => ({ ...s }));
    player.pot = demo.pot;
    player.isAdmin = demo.isAdmin ?? true;

    if (demo.silver > 0) {
      player.inventory.push({ itemId: 'silver', quantity: demo.silver });
    }
    if (demo.inventory) {
      for (const item of demo.inventory) {
        const existing = player.inventory.find((i) => i.itemId === item.itemId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          player.inventory.push({ ...item });
        }
      }
    }

    if (demo.schoolId) {
      const school = schools.getSchool(demo.schoolId);
      if (school) {
        player.schoolId = school.id;
        player.schoolName = school.name;
        schools.applyBonus(player, school);
      }
    }

    players.setPlayer(player);
    result.created.push(demo.username);
  }

  return result;
}
