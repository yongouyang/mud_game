import { describe, it, expect, beforeEach } from 'vitest';
import { NpcSystem } from './NpcSystem.js';
import { SkillSystem } from './SkillSystem.js';
import { Scheduler } from '../time/Scheduler.js';
import { TestSystemClock } from '../time/SystemClock.js';
import npcsData from '../data/npcs.json' assert { type: 'json' };
import schoolsData from '../data/schools.json' assert { type: 'json' };

describe('NpcSystem', () => {
  let system: NpcSystem;

  beforeEach(() => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    const skills = new SkillSystem();
    system = new NpcSystem(skills, scheduler);
  });

  it('has a master NPC for every school', () => {
    for (const school of schoolsData as { id: string }[]) {
      const master = system.getNpc(`master-${school.id}`);
      expect(master, `missing master for ${school.id}`).toBeTruthy();
    }
  });

  it('has at least one disciple per school hall', () => {
    const disciples = (npcsData as { id: string; roomId: string }[]).filter((n) => n.id.startsWith('disciple-'));
    const halls = new Set((schoolsData as { joinRoomId: string }[]).map((s) => s.joinRoomId));
    const covered = new Set(disciples.map((n) => n.roomId));
    for (const hall of halls) {
      expect(covered.has(hall)).toBe(true);
    }
  });

  it('lists NPCs in a room', () => {
    const roomNpcs = system.getNpcsInRoom('shaolin/hall');
    expect(roomNpcs.length).toBeGreaterThanOrEqual(2);
    expect(roomNpcs.some((n) => n.def.id === 'master-shaolin')).toBe(true);
  });

  it('rolls boss drops deterministically when chance is 1.0', () => {
    const boss = system.getNpc('boss-heifeng');
    expect(boss).toBeTruthy();
    expect(boss!.def.boss).toBe(true);
    const drops = system.rollDrops(boss!);
    expect(drops.length).toBeGreaterThanOrEqual(2);
    expect(drops.some((d) => d.itemId === 'black-wind-blade')).toBe(true);
    expect(drops.some((d) => d.itemId === 'boss-token')).toBe(true);
  });

  it('computes NPC damage based on attributes and attack skills', () => {
    const npc = system.getNpc('bandit');
    expect(npc).toBeTruthy();
    const dmg = system.getNpcDamage(npc!);
    expect(dmg).toBeGreaterThan(0);
    const best = system.getBestNpcStrike(npc!);
    expect(best).toBeTruthy();
    expect(best!.damage).toBeGreaterThan(0);
  });

  it('returns dialogue or silence', () => {
    const npc = system.getNpc('storyteller');
    expect(npc).toBeTruthy();
    const text = system.getDialogue(npc!.def.id);
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
    expect(system.getDialogue('nonexistent-npc')).toContain('沉默不语');
  });

  it('respawns an NPC and schedules respawn without scheduler', () => {
    const npc = system.getNpc('bandit')!;
    npc.hp = 0;
    npc.state = 'dead';
    system.respawn(npc.def.id);
    expect(npc.hp).toBe(npc.maxHp);
    expect(npc.state).toBe('idle');

    const cancel = system.scheduleRespawn(npc.def.id);
    expect(cancel).toBeDefined();
    cancel!();
  });

  it('caps formatted NPC room listing', () => {
    const formatted = system.formatNpcsInRoom('shaolin/hall');
    expect(formatted).toContain('……还有');
  });
});
