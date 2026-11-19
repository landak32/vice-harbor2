// The effects pool: sparks, tyre smoke, dust, muzzle flashes, skid marks and camera trauma.
// Nothing here is blood: impacts throw warm sparks and grey dust. Every effect is a plain object
// in a capped array, so a long session never grows without bound.

import { clamp, TAU } from '../core/geometry.js';

const MAX_PARTICLES = 420;
const MAX_MARKS = 520;

export class Effects {
  constructor(rng) {
    this.rng = rng;
    this.particles = [];
    this.marks = [];
    this.decals = [];
    this.shakeAmount = 0;
    this.shakeTime = 0;
    this.flash = 0;
    this.hitFlash = 0;
  }

  shake(amount) {
    this.shakeAmount = Math.min(14, this.shakeAmount + amount);
    this.shakeTime = Math.max(this.shakeTime, 0.22 + amount * 0.02);
  }

  spark(x, y, count = 6, color = '#ffd166') {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) break;
      const angle = this.rng.angle();
      const speed = this.rng.range(40, 240);
      this.particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: this.rng.range(0.15, 0.4),
        maxLife: 0.4,
        size: this.rng.range(1.2, 2.6),
        color,
      });
    }
  }

  muzzle(x, y, angle) {
    for (let i = 0; i < 4; i += 1) {
      const spread = angle + this.rng.range(-0.35, 0.35);
      const speed = this.rng.range(120, 260);
      this.particles.push({
        kind: 'spark',
        x, y,
        vx: Math.cos(spread) * speed,
        vy: Math.sin(spread) * speed,
        life: 0.09,
        maxLife: 0.09,
        size: this.rng.range(1.6, 3),
        color: '#fff2b0',
      });
    }
    this.particles.push({ kind: 'flash', x, y, vx: 0, vy: 0, life: 0.13, maxLife: 0.13, size: 12, color: '#ffe9a0' });
  }

  smoke(x, y, count = 3, strength = 1) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) break;
      this.particles.push({
        kind: 'smoke',
        x: x + this.rng.range(-8, 8),
        y: y + this.rng.range(-8, 8),
        vx: this.rng.range(-18, 18),
        vy: this.rng.range(-34, -8),
        life: this.rng.range(0.7, 1.6) * strength,
        maxLife: 1.6,
        size: this.rng.range(8, 18),
        color: '#6b6f78',
      });
    }
  }

  smokeBurst(x, y, count) {
    this.smoke(x, y, count, 1.4);
  }

  dust(x, y, count = 4) {
    for (let i = 0; i < count; i += 1) {
      if (this.particles.length >= MAX_PARTICLES) break;
      this.particles.push({
        kind: 'dust',
        x, y,
        vx: this.rng.range(-60, 60),
        vy: this.rng.range(-60, 20),
        life: this.rng.range(0.3, 0.7),
        maxLife: 0.7,
        size: this.rng.range(4, 9),
        color: '#b8a888',
      });
    }
  }

  decal(x, y) {
    if (this.decals.length > 40) this.decals.shift();
    this.decals.push({ x, y, life: 30, angle: this.rng.angle(), size: this.rng.range(8, 14) });
  }

  /** A tyre mark: two short strokes where the rear wheels slid. */
  skid(x, y, angle, strength) {
    if (this.marks.length >= MAX_MARKS) this.marks.shift();
    this.marks.push({ x, y, angle, life: 26, strength: clamp(strength, 0.25, 1), width: 5 });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i -= 1) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'smoke') {
        p.vx *= 1 - dt * 1.2;
        p.vy *= 1 - dt * 1.2;
        p.size += dt * 12;
      } else if (p.kind === 'dust') {
        p.vx *= 1 - dt * 3;
        p.vy *= 1 - dt * 3;
      } else {
        p.vx *= 1 - dt * 4;
        p.vy *= 1 - dt * 4;
      }
    }
    for (let i = this.marks.length - 1; i >= 0; i -= 1) {
      this.marks[i].life -= dt;
      if (this.marks[i].life <= 0) this.marks.splice(i, 1);
    }
    for (let i = this.decals.length - 1; i >= 0; i -= 1) {
      this.decals[i].life -= dt;
      if (this.decals[i].life <= 0) this.decals.splice(i, 1);
    }
    this.shakeTime = Math.max(0, this.shakeTime - dt);
    if (this.shakeTime === 0) this.shakeAmount = Math.max(0, this.shakeAmount - dt * 30);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
  }

  shakeOffset(time) {
    if (this.shakeAmount <= 0.05) return { x: 0, y: 0 };
    const amount = this.shakeAmount;
    return {
      x: Math.sin(time * 61.3) * amount,
      y: Math.cos(time * 47.7) * amount * 0.8,
    };
  }
}

/** A ring of dust where a body lands, drawn as expanding circles. */
export function impactRing(x, y, color = '#ffffff') {
  return { kind: 'ring', x, y, vx: 0, vy: 0, life: 0.35, maxLife: 0.35, size: 6, color, angle: 0 };
}

export { TAU };
