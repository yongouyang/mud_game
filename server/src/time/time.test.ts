import { describe, it, expect, vi } from 'vitest';
import { RealSystemClock, TestSystemClock } from './SystemClock.js';
import { Scheduler } from './Scheduler.js';

describe('SystemClock', () => {
  it('RealSystemClock returns Date.now()', () => {
    const clock = new RealSystemClock();
    const before = Date.now();
    const t = clock.now();
    const after = Date.now();
    expect(t).toBeGreaterThanOrEqual(before);
    expect(t).toBeLessThanOrEqual(after);
  });

  it('TestSystemClock can be set and advanced', () => {
    const clock = new TestSystemClock(1000);
    expect(clock.now()).toBe(1000);
    clock.advance(500);
    expect(clock.now()).toBe(1500);
    clock.setTime(200);
    expect(clock.now()).toBe(200);
  });
});

describe('Scheduler', () => {
  it('fires one-shot task when clock reaches fireAt', () => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    let called = false;
    scheduler.schedule('a', 100, () => { called = true; });
    scheduler.tick();
    expect(called).toBe(false);
    clock.advance(100);
    scheduler.tick();
    expect(called).toBe(true);
  });

  it('recurring task fires multiple times', () => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    let count = 0;
    scheduler.schedule('tick', 10, () => { count++; }, 10);
    clock.advance(35);
    scheduler.tick();
    expect(count).toBe(3);
  });

  it('fires tasks in fireAt order', () => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    const order: string[] = [];
    scheduler.schedule('second', 200, () => order.push('second'));
    scheduler.schedule('first', 100, () => order.push('first'));
    clock.advance(300);
    scheduler.tick();
    expect(order).toEqual(['first', 'second']);
  });

  it('cancels tasks', () => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    let called = false;
    scheduler.schedule('x', 50, () => { called = true; });
    scheduler.cancel('x');
    clock.advance(100);
    scheduler.tick();
    expect(called).toBe(false);
  });

  it('drain fires all tasks', () => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    let count = 0;
    scheduler.schedule('a', 1000, () => count++);
    scheduler.schedule('b', 2000, () => count++);
    expect(scheduler.drain()).toBe(2);
    expect(count).toBe(2);
  });

  it('callback can schedule immediately due tasks', () => {
    const clock = new TestSystemClock(0);
    const scheduler = new Scheduler(clock);
    let called = false;
    scheduler.schedule('a', 10, () => {
      // Schedule a task that is already due; it should fire in the same tick.
      scheduler.schedule('b', 0, () => { called = true; });
    });
    clock.advance(10);
    scheduler.tick();
    expect(called).toBe(true);
  });
});
