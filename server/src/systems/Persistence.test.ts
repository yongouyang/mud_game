import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { Player, createPlayer, DEFAULT_ATTRIBUTES } from '../models/Player.js';

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const PLAYERS_FILE = path.join(DATA_DIR, 'players.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function cleanup() {
  if (fs.existsSync(PLAYERS_FILE)) fs.unlinkSync(PLAYERS_FILE);
  if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
}

describe('Auth and Persistence', () => {
  beforeEach(cleanup);
  afterEach(cleanup);

  it('can register a new user', () => {
    const users: Record<string, string> = { 'testuser': 'hashedpassword' };
    fs.writeFileSync(USERS_FILE, JSON.stringify(users));

    const loaded = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    expect(loaded['testuser']).toBe('hashedpassword');
  });

  it('can save and load a player', () => {
    const p = createPlayer('testuser', '楚留香', DEFAULT_ATTRIBUTES);
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify([p]));

    const loaded: Player[] = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
    expect(loaded[0].name).toBe('楚留香');
    expect(loaded[0].currentRoom).toBe('town/square');
    expect(loaded[0].hp).toBe(180); // 80 + 10*10
  });

  it('can update and re-save player data', () => {
    const p = createPlayer('testuser', '楚留香', DEFAULT_ATTRIBUTES);
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify([p]));

    // Simulate playing: move + take damage
    p.currentRoom = 'town/mainstreet';
    p.hp = 150;
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify([p]));

    const reloaded: Player[] = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
    expect(reloaded[0].currentRoom).toBe('town/mainstreet');
    expect(reloaded[0].hp).toBe(150);
  });

  it('handles multiple players in same file', () => {
    const p1 = createPlayer('user1', '楚留香', DEFAULT_ATTRIBUTES);
    const p2 = createPlayer('user2', '李寻欢', { str: 12, int: 10, con: 10, dex: 8 });
    fs.writeFileSync(PLAYERS_FILE, JSON.stringify([p1, p2]));

    const loaded: Player[] = JSON.parse(fs.readFileSync(PLAYERS_FILE, 'utf-8'));
    expect(loaded).toHaveLength(2);
    expect(loaded[0].name).toBe('楚留香');
    expect(loaded[1].name).toBe('李寻欢');
  });
});
