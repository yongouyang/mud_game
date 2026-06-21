export interface SystemClock {
  /** Return current time in milliseconds (epoch-like, but may be fake in tests). */
  now(): number;
}

export class RealSystemClock implements SystemClock {
  now(): number {
    return Date.now();
  }
}

export class TestSystemClock implements SystemClock {
  private time: number;

  constructor(initialTime: number = 0) {
    this.time = initialTime;
  }

  now(): number {
    return this.time;
  }

  setTime(time: number): void {
    this.time = time;
  }

  advance(ms: number): void {
    this.time += ms;
  }
}
