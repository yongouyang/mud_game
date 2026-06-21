import fs from 'node:fs';
import path from 'node:path';
import { Player } from '../models/Player.js';

const DATA_DIR = path.resolve(import.meta.dirname, '..', 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

export class PersistenceSystem {
  saveAll(players: Player[]): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify(players, null, 2));
  }

  loadAll(): Player[] {
    if (!fs.existsSync(PLAYERS_FILE)) return [];
    const players: Player[] = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
    for (const p of players) {
      if (p.shen === undefined) p.shen = 0;
      if (!p.kills) p.kills = { players: 0, npcs: 0 };
    }
    return players;
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
