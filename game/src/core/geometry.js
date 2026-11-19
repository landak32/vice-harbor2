// Small 2D helpers used by the whole game: angles, distances, rectangle and circle overlap,
// easing and number formatting. Kept free of game rules so every other module can share them.

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent smoothing: how much of the gap to close in `dt` seconds. */
export function damp(current, target, rate, dt) {
  return lerp(current, target, 1 - Math.exp(-rate * dt));
}

export function distanceSq(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function distance(ax, ay, bx, by) {
  return Math.sqrt(distanceSq(ax, ay, bx, by));
}

export function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** An angle folded into (-PI, PI]. */
export function normalizeAngle(angle) {
  let a = angle;
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

/** The signed turn from `from` to `to`, shortest way round. */
export function angleDifference(from, to) {
  return normalizeAngle(to - from);
}

export function moveToward(current, target, maxDelta) {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

export function approachZero(value, delta) {
  if (value > 0) return Math.max(0, value - delta);
  return Math.min(0, value + delta);
}

export function pointInRect(px, py, rect) {
  return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/** True when a circle overlaps an axis-aligned rectangle, and how deep it sits inside. */
export function circleRectOverlap(cx, cy, radius, rect) {
  const nearestX = clamp(cx, rect.x, rect.x + rect.w);
  const nearestY = clamp(cy, rect.y, rect.y + rect.h);
  const dx = cx - nearestX;
  const dy = cy - nearestY;
  const reach = radius * radius;
  if (dx * dx + dy * dy > reach) return null;
  const inside = cx > rect.x && cx < rect.x + rect.w && cy > rect.y && cy < rect.y + rect.h;
  const depth = inside ? radius + Math.min(cx - rect.x, rect.x + rect.w - cx, cy - rect.y, rect.y + rect.h - cy) : radius - Math.sqrt(dx * dx + dy * dy);
  return { depth, nearestX, nearestY, dx, dy };
}

export function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function easeOutCubic(t) {
  const p = 1 - clamp(t, 0, 1);
  return 1 - p * p * p;
}

/** 12345 -> "12,345", with a dollar sign when asked. */
export function formatMoney(amount, withSign = true) {
  const rounded = Math.round(Math.abs(amount));
  const digits = String(rounded);
  let out = '';
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ',';
    out += digits[i];
  }
  const sign = amount < 0 ? '-' : '';
  return withSign ? `${sign}$${out}` : `${sign}${out}`;
}

/** A short deterministic hash of two integers, used to vary building detail per lot. */
export function hash2(x, y) {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

/** 0..1 noise from two integers, for stable per-lot variation. */
export function noise2(x, y) {
  return hash2(x, y) / 4294967296;
}
