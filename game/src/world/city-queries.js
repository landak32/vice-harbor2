// Read-only questions about the city: is this point water, road or pavement, what is solid here,
// where is the nearest junction, and where can a car or a crowd be placed. Everything that moves
// asks these instead of walking the whole building list.

import { distanceSq, clamp } from '../core/geometry.js';
import { GRID_CELL } from './city-builder.js';

export function isWater(city, x, y) {
  for (let i = 0; i < city.water.length; i += 1) {
    const w = city.water[i];
    if (x >= w.x && x <= w.x + w.w && y >= w.y && y <= w.y + w.h) return true;
  }
  return false;
}

export function isSand(city, x, y) {
  for (let i = 0; i < city.sand.length; i += 1) {
    const s = city.sand[i];
    if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  }
  return false;
}

export function isOnRoad(city, x, y) {
  const half = city.roadHalf;
  for (let i = 0; i < city.cols.length; i += 1) if (Math.abs(x - city.cols[i]) <= half) return true;
  for (let i = 0; i < city.rows.length; i += 1) if (Math.abs(y - city.rows[i]) <= half) return true;
  return false;
}

export function isOnSidewalk(city, x, y) {
  const outer = city.roadHalf + city.sidewalk;
  for (let i = 0; i < city.cols.length; i += 1) {
    const d = Math.abs(x - city.cols[i]);
    if (d > city.roadHalf && d <= outer) return true;
  }
  for (let i = 0; i < city.rows.length; i += 1) {
    const d = Math.abs(y - city.rows[i]);
    if (d > city.roadHalf && d <= outer) return true;
  }
  return false;
}

/** Solids whose grid cell touches the circle around (x, y). */
export function solidsNear(city, x, y, radius) {
  const minX = Math.floor((x - radius) / GRID_CELL);
  const maxX = Math.floor((x + radius) / GRID_CELL);
  const minY = Math.floor((y - radius) / GRID_CELL);
  const maxY = Math.floor((y + radius) / GRID_CELL);
  const found = [];
  for (let gx = minX; gx <= maxX; gx += 1) {
    for (let gy = minY; gy <= maxY; gy += 1) {
      const bucket = city.cells.get(gx * 10000 + gy);
      if (!bucket) continue;
      for (let i = 0; i < bucket.length; i += 1) {
        if (!found.includes(bucket[i])) found.push(bucket[i]);
      }
    }
  }
  return found;
}

/** True when a circle would stand inside a building, a solid prop, or the sea. */
export function isBlocked(city, x, y, radius) {
  if (isWater(city, x, y)) return true;
  const solids = solidsNear(city, x, y, radius + 4);
  for (let i = 0; i < solids.length; i += 1) {
    const s = solids[i];
    const nearestX = clamp(x, s.x, s.x + s.w);
    const nearestY = clamp(y, s.y, s.y + s.h);
    const dx = x - nearestX;
    const dy = y - nearestY;
    if (dx * dx + dy * dy < radius * radius) return true;
  }
  return false;
}

/** The nearest junction to a point, with the squared distance to it. */
export function nearestJunction(city, x, y) {
  let best = city.intersections[0];
  let bestDistance = Infinity;
  for (let i = 0; i < city.intersections.length; i += 1) {
    const node = city.intersections[i];
    const d = distanceSq(node.x, node.y, x, y);
    if (d < bestDistance) {
      bestDistance = d;
      best = node;
    }
  }
  return { node: best, distanceSq: bestDistance };
}

/** Snaps any point onto the nearest lane centre of the road grid. */
export function snapToLane(city, x, y) {
  let bestX = city.cols[0];
  let bestY = city.rows[0];
  let bestDistance = Infinity;
  for (let i = 0; i < city.cols.length; i += 1) {
    const d = Math.abs(x - city.cols[i]);
    if (d < bestDistance) {
      bestDistance = d;
      bestX = city.cols[i];
    }
  }
  let rowDistance = Infinity;
  for (let i = 0; i < city.rows.length; i += 1) {
    const d = Math.abs(y - city.rows[i]);
    if (d < rowDistance) {
      rowDistance = d;
      bestY = city.rows[i];
    }
  }
  return bestDistance < rowDistance ? { x: bestX, y } : { x, y: bestY };
}

/** A point on a road somewhere near (x, y), used for spawning traffic and police off-screen. */
export function roadPointNear(city, x, y, minDistance, maxDistance, rng) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const column = rng.int(0, city.cols.length - 1);
    const row = rng.int(0, city.rows.length - 1);
    const px = city.cols[column];
    const py = city.rows[row];
    const d = Math.hypot(px - x, py - y);
    if (d >= minDistance && d <= maxDistance) return { x: px, y: py, column, row };
  }
  return { x: city.cols[0], y: city.rows[0], column: 0, row: 0 };
}

/** The block whose rectangle contains the point, or null. */
export function blockContaining(city, x, y) {
  for (let i = 0; i < city.blocks.length; i += 1) {
    const b = city.blocks[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** The district id under a world point, for the "entering Marisol Strip" toast. */
export function districtAt(city, x, y) {
  const block = blockContaining(city, x, y);
  if (block) return block.district;
  if (isWater(city, x, y)) return { id: 'water', name: 'Harbor Basin' };
  if (isSand(city, x, y)) return { id: 'sand', name: 'Marisol Beach' };
  return { id: 'street', name: 'Vice Harbor' };
}

/** A coarse line-of-sight test: a handful of samples through the building grid. */
export function hasLineOfSight(city, ax, ay, bx, by) {
  const steps = Math.min(16, Math.max(4, Math.round(Math.hypot(bx - ax, by - ay) / 90)));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isBlocked(city, ax + (bx - ax) * t, ay + (by - ay) * t, 6)) return false;
  }
  return true;
}

/** A pavement point on a block edge, for placing a pedestrian or an officer. */
export function sidewalkPoint(city, x, y) {
  const block = blockContaining(city, x, y);
  if (!block) return { x, y };
  const inset = 13;
  const candidates = [
    { x: block.x + inset, y },
    { x: block.x + block.w - inset, y },
    { x, y: block.y + inset },
    { x, y: block.y + block.h - inset },
  ];
  let best = candidates[0];
  let bestDistance = Infinity;
  for (let i = 0; i < candidates.length; i += 1) {
    const d = Math.hypot(candidates[i].x - x, candidates[i].y - y);
    if (d < bestDistance) {
      bestDistance = d;
      best = candidates[i];
    }
  }
  return best;
}
