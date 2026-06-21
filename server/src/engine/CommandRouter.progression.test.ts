import { describe, it, expect, beforeEach } from 'vitest';
import { CommandRouter } from './CommandRouter.js';
import { PlayerManager } from '../systems/PlayerManager.js';
import { createTestContext } from '../test-utils.js';

const PLAYER_ID = 'progression-player';

describe('Progression commands', () => {
  let router: CommandRouter;
  let players: PlayerManager;

  function cmd(input: string): string { return router.handle(input, PLAYER_ID); }

  beforeEach(() => {
    const ctx = createTestContext();
    router = ctx.router;
    players = ctx.players;
    players.createPlayer(PLAYER_ID);
    cmd('楚留香');
    cmd('done');
    const p = players.getPlayer(PLAYER_ID)!;
    p.pot = 1000;
    p.hp = p.maxHp;
    p.mp = p.maxMp;
  });

  it('dazuo requires force skill', () => {
    expect(cmd('dazuo 5')).toContain('需要先学会一门内功');
  });

  it('dazuo converts HP to MP over time', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.skills.push({ skillId: 'force', level: 10 });
    p.mp = 0;
    cmd('dazuo 3');
    expect(p.isMeditating).toBe(true);
    // Advance scheduler manually.
    const scheduler = (router as any).scheduler;
    const clock = (router as any).clock;
    clock.advance(1000);
    scheduler.tick();
    expect(p.mp).toBeGreaterThan(0);
  });

  it('practice requires a target skill', () => {
    expect(cmd('practice')).toContain('用法');
  });

  it('practice raises a basic skill without potential cost', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    const potBefore = p.pot;
    const out = cmd('practice 基本拳脚');
    expect(out).toContain('有所进步');
    expect(p.pot).toBe(potBefore); // practice is free
  });

  it('practice is capped by player level', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.skills.push({ skillId: 'cuff', level: 20 });
    p.level = 1; // cap = 10
    expect(cmd('practice 基本拳脚')).toContain('极限');
  });

  it('tianfu spends attribute points', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.attrPoints = 3;
    const out = cmd('tianfu str 2');
    expect(out).toContain('分配');
    expect(p.attributes.str).toBe(12);
    expect(p.attrPoints).toBe(1);
  });

  it('level shows progression info', () => {
    const out = cmd('level');
    expect(out).toContain('等级');
    expect(out).toContain('属性点');
  });

  it('killing enemies triggers level-up messages', () => {
    const p = players.getPlayer(PLAYER_ID)!;
    p.exp = 0;
    // Fight a weak custom NPC for guaranteed exp gain.
    const npcs = (router as any).npcs;
    npcs.register({
      id: 'weak-rat', name: '老鼠', description: '一只小老鼠',
      roomId: 'town/square', dialogue: ['吱吱'], attributes: { str: 0, int: 1, con: 1, dex: 0 },
      skills: [], aggressive: false,
    });
    const rat = npcs.getNpc('weak-rat');
    rat.hp = 1;
    const out = cmd('kill 老鼠');
    expect(p.exp).toBeGreaterThan(0);
    expect(out).toContain('经验');
  });
});
