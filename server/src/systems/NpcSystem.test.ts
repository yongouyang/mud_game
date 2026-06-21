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
});
