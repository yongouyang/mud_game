import { describe, it, expect } from 'vitest';
import { createTestContext } from '../test-utils.js';

function setupPlayer(ctx: ReturnType<typeof createTestContext>, id: string) {
  ctx.players.createPlayer(id);
  ctx.router.handle('', id);
  ctx.router.handle('战狂', id);
  ctx.router.handle('set str 10', id);
  ctx.router.handle('set con 10', id);
  ctx.router.handle('set dex 10', id);
  ctx.router.handle('set int 10', id);
  ctx.router.handle('done', id);
}

describe('School mechanics', () => {
  it('joining a school grants attribute bonus and sets school name', () => {
    const ctx = createTestContext();
    setupPlayer(ctx, 's1');

    // Move to Shaolin hall: n n n e s w
    ctx.router.handle('n', 's1');
    ctx.router.handle('n', 's1');
    ctx.router.handle('n', 's1');
    ctx.router.handle('e', 's1');
    ctx.router.handle('s', 's1');
    ctx.router.handle('w', 's1');

    const out = ctx.router.handle('join 少林派', 's1');
    expect(out).toContain('拜入了少林派');
    expect(out).toContain('根骨 +3');

    const score = ctx.router.handle('score', 's1');
    expect(score).toContain('少林派');
    expect(score).toContain('根骨(con): 13');
  });

  it('cannot join a second school', () => {
    const ctx = createTestContext();
    setupPlayer(ctx, 's2');
    ctx.router.handle('n', 's2');
    ctx.router.handle('n', 's2');
    ctx.router.handle('n', 's2');
    ctx.router.handle('e', 's2');
    ctx.router.handle('s', 's2');
    ctx.router.handle('w', 's2');
    ctx.router.handle('join 少林派', 's2');

    // Travel to Wudang hall: e (shaolin gate) -> n? Actually from shaolin/hall east to gate, south to cliff, east to wudang gate, west to wudang hall.
    ctx.router.handle('e', 's2');
    ctx.router.handle('s', 's2');
    ctx.router.handle('e', 's2');
    ctx.router.handle('w', 's2');

    const out = ctx.router.handle('join 武当派', 's2');
    expect(out).toContain('已经加入了门派');
  });

  it('blocks school skill without membership', () => {
    const ctx = createTestContext();
    setupPlayer(ctx, 's3');
    for (let i = 0; i < 15; i++) ctx.router.handle('learn 基本内功', 's3');

    const out = ctx.router.handle('learn 乾坤大挪移', 's3');
    expect(out).toContain('明教独门武功');
    expect(out).toContain('需先加入该门派');
  });

  it('blocks school skill outside master room', () => {
    const ctx = createTestContext();
    setupPlayer(ctx, 's4');
    for (let i = 0; i < 15; i++) ctx.router.handle('learn 基本内功', 's4');

    // Join Mingjiao at its hall.
    ctx.router.handle('n', 's4');
    ctx.router.handle('n', 's4');
    ctx.router.handle('n', 's4');
    ctx.router.handle('n', 's4');
    ctx.router.handle('ne', 's4');
    const joinOut = ctx.router.handle('join 明教', 's4');
    expect(joinOut).toContain('拜入了明教');

    // Travel away to forest2.
    ctx.router.handle('w', 's4');

    const out = ctx.router.handle('learn 乾坤大挪移', 's4');
    expect(out).toContain('需到明教师父面前学习');
  });

  it('allows learning signature skill at master room with prerequisites', () => {
    const ctx = createTestContext();
    setupPlayer(ctx, 's5');
    for (let i = 0; i < 15; i++) ctx.router.handle('learn 基本内功', 's5');

    // Join Mingjiao at its hall.
    ctx.router.handle('n', 's5');
    ctx.router.handle('n', 's5');
    ctx.router.handle('n', 's5');
    ctx.router.handle('n', 's5');
    ctx.router.handle('ne', 's5');
    const joinOut = ctx.router.handle('join 明教', 's5');
    expect(joinOut).toContain('拜入了明教');

    const out = ctx.router.handle('learn 乾坤大挪移', 's5');
    expect(out).toContain('学会了乾坤大挪移');
  });

  it('schools command shows bonuses', () => {
    const ctx = createTestContext();
    setupPlayer(ctx, 's6');
    const out = ctx.router.handle('schools 少林派', 's6');
    expect(out).toContain('根骨 +3');
    expect(out).toContain('玄慈方丈');
  });
});
