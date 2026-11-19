// The crowds. Pedestrians walk the pavement loops of every block, cross the road at the corners,
// break into a run when something frightens them, and go down when a car or a bullet finds them.

import { distance, angleTo, clamp } from '../core/geometry.js';
import { blockContaining } from '../world/city-queries.js';

const SHIRTS = ['#e8d9b0', '#5b8fc9', '#c9576b', '#6bbf8a', '#e0a04a', '#8a7ad9', '#d8d8d8', '#3f4a5a', '#e87a4a'];
const SKINS = ['#f0c8a0', '#d8a878', '#a8703f', '#6b4a2f', '#f5dcc0', '#8a5a3a'];
const HAIR = ['#2b2118', '#4a3423', '#1a1a1a', '#7a5a3a', '#c9a86a', '#8a8a8a'];

function loopFor(block) {
  const inset = 13;
  const x0 = block.x + inset;
  const y0 = block.y + inset;
  const x1 = block.x + block.w - inset;
  const y1 = block.y + block.h - inset;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export function createPedestrian(city, rng, block) {
  const corners = loopFor(block);
  const cornerIndex = rng.int(0, 3);
  const start = corners[cornerIndex];
  const ped = {
    x: start.x + rng.range(-6, 6),
    y: start.y + rng.range(-6, 6),
    vx: 0,
    vy: 0,
    angle: rng.angle(),
    speed: rng.range(48, 74),
    state: 'walk',
    corners,
    target: (cornerIndex + 1) % 4,
    direction: rng.chance(0.5) ? 1 : -1,
    block,
    fleeTimer: 0,
    downTimer: 0,
    threatX: 0,
    threatY: 0,
    health: 40,
    bob: rng.range(0, Math.PI * 2),
    shirt: rng.pick(SHIRTS),
    skin: rng.pick(SKINS),
    hair: rng.pick(HAIR),
    hat: rng.chance(0.18),
    bag: rng.chance(0.25),
    dead: false,
    removeTimer: 0,
  };
  return ped;
}

export function populatePedestrians(game) {
  const rng = game.rng;
  for (let i = 0; i < game.city.blocks.length; i += 1) {
    const block = game.city.blocks[i];
    const count = Math.max(1, Math.round(block.district.pedestrians * rng.int(2, 4)));
    for (let n = 0; n < count; n += 1) game.pedestrians.push(createPedestrian(game.city, rng, block));
  }
}

function walkTo(ped, tx, ty, speed, dt) {
  const angle = angleTo(ped.x, ped.y, tx, ty);
  const reach = distance(ped.x, ped.y, tx, ty);
  const step = Math.min(speed * dt, reach);
  ped.x += Math.cos(angle) * step;
  ped.y += Math.sin(angle) * step;
  ped.angle = angle;
  ped.bob += dt * speed * 0.09;
  return reach <= 4;
}

/** Pick a corner across the road, so the crowd visibly uses the crossings. */
function startCrossing(ped, city) {
  const corner = ped.corners[ped.target];
  const block = ped.block;
  const options = [];
  if (Math.abs(corner.x - (block.x + 13)) < 2) options.push({ x: corner.x - 2 * city.roadHalf - city.sidewalk, y: corner.y });
  if (Math.abs(corner.x - (block.x + block.w - 13)) < 2) options.push({ x: corner.x + 2 * city.roadHalf + city.sidewalk, y: corner.y });
  if (Math.abs(corner.y - (block.y + 13)) < 2) options.push({ x: corner.x, y: corner.y - 2 * city.roadHalf - city.sidewalk });
  if (Math.abs(corner.y - (block.y + block.h - 13)) < 2) options.push({ x: corner.x, y: corner.y + 2 * city.roadHalf + city.sidewalk });
  if (options.length === 0) return false;
  const pick = options[Math.abs(Math.floor(ped.bob * 7)) % options.length];
  ped.state = 'cross';
  ped.crossTarget = pick;
  ped.crossStart = { x: ped.x, y: ped.y };
  return true;
}

export function updatePedestrians(game, dt) {
  const player = game.player;
  for (let i = game.pedestrians.length - 1; i >= 0; i -= 1) {
    const ped = game.pedestrians[i];
    if (ped.state === 'dead') {
      ped.removeTimer -= dt;
      if (ped.removeTimer <= 0) game.pedestrians.splice(i, 1);
      continue;
    }
    if (ped.state === 'down') {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = 'walk';
        ped.target = (ped.target + 1) % 4;
      }
      continue;
    }
    if (ped.state === 'flee') {
      ped.fleeTimer -= dt;
      const away = angleTo(ped.threatX, ped.threatY, ped.x, ped.y);
      const wobble = Math.sin(ped.bob * 1.7) * 0.4;
      ped.x += Math.cos(away + wobble) * 168 * dt;
      ped.y += Math.sin(away + wobble) * 168 * dt;
      ped.angle = away;
      ped.bob += dt * 14;
      if (ped.fleeTimer <= 0) {
        ped.state = 'walk';
        const block = blockContaining(game.city, ped.x, ped.y);
        if (block) {
          ped.block = block;
          ped.corners = loopFor(block);
          ped.target = 0;
        }
      }
      continue;
    }
    if (ped.state === 'cross') {
      const arrived = walkTo(ped, ped.crossTarget.x, ped.crossTarget.y, ped.speed * 1.35, dt);
      if (arrived) {
        const block = blockContaining(game.city, ped.x, ped.y);
        if (block) {
          ped.block = block;
          ped.corners = loopFor(block);
        }
        ped.state = 'walk';
        ped.target = 0;
      }
      continue;
    }

    const target = ped.corners[ped.target];
    const arrived = walkTo(ped, target.x, target.y, ped.speed, dt);
    if (arrived) {
      const roll = game.rng.next();
      if (roll < 0.22 && startCrossing(ped, game.city)) continue;
      ped.target = (ped.target + ped.direction + 4) % 4;
    }
    if (player.alive && distance(ped.x, ped.y, player.x, player.y) < 26 && Math.hypot(player.vx, player.vy) > 120) {
      knockDownPedestrian(ped);
    }
  }
}

export function knockDownPedestrian(ped) {
  if (ped.state === 'down' || ped.state === 'dead') return;
  ped.state = 'down';
  ped.downTimer = 4.5;
}

export function killPedestrian(ped) {
  ped.state = 'dead';
  ped.dead = true;
  ped.removeTimer = 30;
}

/** Any pedestrian within reach of a punch or a bullet's line. */
export function pedestrianNear(pedestrians, x, y, radius) {
  let best = null;
  let bestDistance = radius;
  for (let i = 0; i < pedestrians.length; i += 1) {
    const ped = pedestrians[i];
    if (ped.state === 'dead' || ped.state === 'down') continue;
    const d = distance(ped.x, ped.y, x, y);
    if (d < bestDistance) {
      bestDistance = d;
      best = ped;
    }
  }
  return best;
}
