import fs from 'node:fs';
import path from 'node:path';
import { Player, recalcPlayerStats } from '../models/Player.js';

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const CURRENT_PLAYER_VERSION = 1;

function migratePlayer(p: any): Player {
  if (p.version === undefined) p.version = 0;
  if (p.version < CURRENT_PLAYER_VERSION) {
    // v0 -> v1
    if (!p.inventory) p.inventory = [];
    if (!p.equipped) p.equipped = [];
    if (!p.skills) p.skills = [];
    if (!p.conditions) p.conditions = [];
    if (p.bankSilver === undefined) p.bankSilver = 0;
    if (!p.bankInventory) p.bankInventory = [];
    if (p.shen === undefined) p.shen = 0;
    if (!p.kills) p.kills = { players: 0, npcs: 0 };
    if (p.attrPoints === undefined) p.attrPoints = 0;
    if (p.level === undefined) p.level = 1;
    if (p.exp === undefined) p.exp = 0;
    if (p.pot === undefined) p.pot = 0;
    if (!p.combatTargets) p.combatTargets = [];
    if (p.quest === undefined) p.quest = null;

    // Reset transient state so a player saved mid-fight doesn't reload into a broken combat.
    p.state = 'playing';
    p.targetEnemy = null;
    p.combatTargets = [];
    p.isMeditating = false;
    p.meditationTaskId = undefined;
    p.powerupExpiry = undefined;
    p.comboCount = 0;
    p.comboSkill = undefined;

    // Re-derive max HP/MP if attributes exist, but don't heal.
    if (p.attributes && p.hp !== undefined && p.mp !== undefined) {
      recalcPlayerStats(p);
    }

    p.version = CURRENT_PLAYER_VERSION;
  }
  return p as Player;
}

export class PersistenceSystem {
  saveAll(players: Player[]): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2));
  }

  loadAll(): Player[] {
    if (!fs.existsSync(PLAYERS_FILE)) return [];
    const raw = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
    const players: Player[] = Array.isArray(raw) ? raw : [];
    return players.map((p) => migratePlayer(p));
  }

  saveUser(username: string, passwordHash: string): void {
    const users = this.loadUsers();
    users[username] = passwordHash;
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
  }

  getUserHash(username: string): string | null {
    const users = this.loadUsers();
    return users[username] || null;
  }

  private loadUsers(): Record<string, string> {
    if (!fs.existsSync(USERS_FILE)) return {};
    return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  }
}
