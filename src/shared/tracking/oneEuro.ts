/**
 * One Euro filter (Casiez et al., CHI 2012): adaptive low-pass that removes jitter when a
 * signal is still but follows quickly when it moves fast.
 */
export class OneEuro {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev = 0;

  constructor(
    public minCutoff = 1.0,
    public beta = 0.007,
    public dCutoff = 1.0,
  ) {}

  private static alpha(cutoff: number, dt: number): number {
    const tau = 1 / (2 * Math.PI * cutoff);
    return 1 / (1 + tau / dt);
  }

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
  }

  get value(): number | null {
    return this.xPrev;
  }

  /** @param t timestamp in seconds */
  filter(x: number, t: number): number {
    if (this.xPrev === null || !Number.isFinite(this.xPrev)) {
      this.xPrev = x;
      this.tPrev = t;
      this.dxPrev = 0;
      return x;
    }
    const dt = Math.max(1e-3, t - this.tPrev);
    this.tPrev = t;
    const dx = (x - this.xPrev) / dt;
    const aD = OneEuro.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = OneEuro.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }
}

/** Filter for an angle in radians; unwraps so a jump across ±π doesn't spin. */
export class OneEuroAngle {
  private f: OneEuro;
  private last: number | null = null;
  private unwrapped = 0;
  constructor(minCutoff = 1.0, beta = 0.5) {
    this.f = new OneEuro(minCutoff, beta);
  }
  reset(): void {
    this.f.reset();
    this.last = null;
  }
  setMinCutoff(c: number): void {
    this.f.minCutoff = c;
  }
  filter(a: number, t: number): number {
    if (this.last === null) {
      this.unwrapped = a;
    } else {
      let d = a - this.last;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      this.unwrapped += d;
    }
    this.last = a;
    return this.f.filter(this.unwrapped, t);
  }
}

export class OneEuro2D {
  readonly fx: OneEuro;
  readonly fy: OneEuro;
  constructor(minCutoff = 1.0, beta = 0.007) {
    this.fx = new OneEuro(minCutoff, beta);
    this.fy = new OneEuro(minCutoff, beta);
  }
  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
  setParams(minCutoff: number, beta: number): void {
    this.fx.minCutoff = this.fy.minCutoff = minCutoff;
    this.fx.beta = this.fy.beta = beta;
  }
  filter(p: { x: number; y: number }, t: number): { x: number; y: number } {
    return { x: this.fx.filter(p.x, t), y: this.fy.filter(p.y, t) };
  }
}
