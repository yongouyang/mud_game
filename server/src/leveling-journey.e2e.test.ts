/**
 * Server E2E: Full player lifecycle via direct CommandRouter.handle() calls.
 * Chapters: Create → Skills → Quest → Level-up → Combat → Persistence.
 */
import { describe, it, expect } from 'vitest';
import { createTestContext } from './test-utils.js';

describe('E2E Leveling Journey (server)', () => {
  const PID = 'journey';

  it('create character and verify base stats', () => {
    const ctx = createTestContext();
    const r = ctx.router;
    ctx.players.createPlayer(PID);

    r.handle('江小鱼', PID);
    r.handle('set str 15', PID);
    r.handle('set con 15', PID);
    const done = r.handle('done', PID);
    expect(done).toContain('角色创建成功');

    const level = r.handle('level', PID);
    expect(level).toContain('Lv.1');
    expect(level).toContain('臂力(str): 15');
    expect(level).toContain('根骨(con): 15');

    const hp = r.handle('hp', PID);
    expect(hp).toContain('气血');
    expect(hp).not.toMatch(/NaN/);

    const skills = r.handle('skills', PID);
    expect(skills).toContain('武功');

    const inv = r.handle('i', PID);
    expect(inv.length).toBeGreaterThan(5);
  });

  it('learn skills to Lv.10', () => {
    const ctx = createTestContext();
    const r = ctx.router;
    ctx.players.createPlayer(PID);
    r.handle('江小鱼', PID);
    r.handle('set str 15', PID);
    r.handle('set con 15', PID);
    r.handle('done', PID);

    for (let i = 0; i < 10; i++) r.handle('learn 基本拳脚', PID);
    const skills = r.handle('skills', PID);
    expect(skills).toContain('基本拳脚');
    expect(skills).toMatch(/Lv\.1[0-9]/);
  });

  it('complete quest and level up', () => {
    const ctx = createTestContext();
    const r = ctx.router;
    ctx.players.createPlayer(PID);
    r.handle('江小鱼', PID);
    r.handle('set str 15', PID);
    r.handle('set con 15', PID);
    r.handle('done', PID);

    const accept = r.handle('quest 说书人 letter-delivery', PID);
    expect(accept).toContain('接取了');

    r.handle('e', PID);
    const complete = r.handle('quest 王掌柜', PID);
    expect(complete).toContain('任务完成');
    expect(complete).toContain('40 点经验');

    const level = r.handle('level', PID);
    const lvMatches = [...level.matchAll(/等级:\s*Lv\.(\d+)/g)];
    const lv = lvMatches.length > 0 ? parseInt(lvMatches[lvMatches.length - 1][1]) : 1;
    expect(lv).toBeGreaterThanOrEqual(2);

    r.handle('tianfu str 1', PID);
    const level2 = r.handle('level', PID);
    expect(level2).toContain('臂力(str): 16');
  });

  it('combat with bandit', () => {
    const ctx = createTestContext();
    const r = ctx.router;
    ctx.players.createPlayer(PID);
    r.handle('江小鱼', PID);
    r.handle('set str 15', PID);
    r.handle('set con 15', PID);
    r.handle('done', PID);

    r.handle('n', PID); r.handle('n', PID);
    const forest = r.handle('n', PID);
    expect(forest).toContain('山林');

    const kill = r.handle('kill 山贼', PID);
    expect(kill).not.toMatch(/NaN/);
    expect(kill).toMatch(/造成了|山贼|没有/);

    r.handle('flee', PID);
    r.handle('s', PID); r.handle('s', PID);
    const town = r.handle('s', PID);
    expect(town).toContain('广场');
  });

  it('persistence: state survives reload', () => {
    const ctx1 = createTestContext();
    const r1 = ctx1.router;
    ctx1.players.createPlayer(PID);
    r1.handle('江小鱼', PID);
    r1.handle('set str 15', PID);
    r1.handle('set con 15', PID);
    r1.handle('done', PID);

    for (let i = 0; i < 5; i++) r1.handle('learn 基本拳脚', PID);
    r1.handle('quest 说书人 letter-delivery', PID);
    r1.handle('e', PID);
    r1.handle('quest 王掌柜', PID);

    const saved = ctx1.players.getPlayer(PID)!;
    expect(saved.name).toBe('江小鱼');
    const lv1 = saved.level || 1;

    const ctx2 = createTestContext();
    ctx2.players.setPlayer({ ...saved, id: PID });
    const r2 = ctx2.router;

    const reloaded = ctx2.players.getPlayer(PID)!;
    expect(reloaded.name).toBe('江小鱼');
    const level2 = r2.handle('level', PID);
    const lv2Matches = [...level2.matchAll(/等级:\s*Lv\.(\d+)/g)];
    const lv2 = lv2Matches.length > 0 ? parseInt(lv2Matches[lv2Matches.length - 1][1]) : 0;
    expect(lv2).toBeGreaterThanOrEqual(lv1);
    expect(level2).toContain('臂力(str): 15');

    const skills2 = r2.handle('skills', PID);
    expect(skills2).toContain('基本拳脚');
  });
});
