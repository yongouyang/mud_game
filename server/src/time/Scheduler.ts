import { SystemClock } from './SystemClock.js';

export interface ScheduledTask {
  id: string;
  fireAt: number;
  recurring?: number;
  callback: () => void;
}

export class Scheduler {
  private tasks = new Map<string, ScheduledTask>();

  constructor(private clock: SystemClock) {}

  /**
   * Schedule a one-shot or recurring task.
   * @param id unique task id
   * @param delayMs milliseconds until first fire (relative to clock.now())
   * @param callback function to invoke
   * @param recurringMs if provided, reschedule automatically with this interval
   */
  schedule(id: string, delayMs: number, callback: () => void, recurringMs?: number): void {
    this.tasks.set(id, {
      id,
      fireAt: this.clock.now() + delayMs,
      recurring: recurringMs,
      callback,
    });
  }

  cancel(id: string): boolean {
    return this.tasks.delete(id);
  }

  has(id: string): boolean {
    return this.tasks.has(id);
  }

  /**
   * Fire all tasks whose fireAt <= clock.now().
   * Recurring tasks are rescheduled after firing.
   * Newly-scheduled tasks that are already due are also fired in the same tick.
   * Returns number of tasks fired.
   */
  tick(): number {
    const now = this.clock.now();
    let fired = 0;
    // Keep looping as long as there are due tasks, because callbacks may schedule new due tasks.
    while (true) {
      const due: ScheduledTask[] = [];
      for (const task of this.tasks.values()) {
        if (task.fireAt <= now) {
          due.push(task);
        }
      }
      if (due.length === 0) break;
      // Sort by fireAt to preserve deterministic order.
      due.sort((a, b) => a.fireAt - b.fireAt);
      for (const task of due) {
        if (!this.tasks.has(task.id)) continue; // may have been cancelled by an earlier callback
        if (task.recurring) {
          // Schedule next occurrence based on the original fire time, so catch-up works.
          task.fireAt = task.fireAt + task.recurring;
        } else {
          this.tasks.delete(task.id);
        }
        task.callback();
        fired++;
      }
    }
    return fired;
  }

  /** Fire all tasks regardless of time. Useful for cleanup in tests. */
  drain(): number {
    const all = [...this.tasks.values()].sort((a, b) => a.fireAt - b.fireAt);
    let count = 0;
    for (const task of all) {
      if (!this.tasks.has(task.id)) continue;
      this.tasks.delete(task.id);
      task.callback();
      count++;
    }
    return count;
  }

  clear(): void {
    this.tasks.clear();
  }
}
