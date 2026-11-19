// People with guns who are not in cars: the thugs a job puts in your way and the officers who
// bail out of a cruiser. They keep their distance, take a step sideways, and fire with a spread
// that tightens as the wanted level climbs.

import { angleTo, distance, clamp, angleDifference } from '../core/geometry.js';
import { isBlocked, hasLineOfSight } from '../world/city-queries.js';
import { createBullet } from './projectiles.js';

export function createGunman(faction, x, y, options = {}) {
  const isCop = faction === 'cop';
  const health = options.health ?? (isCop ? 75 : 60);
  return {
    faction,
    x,
    y,
    vx: 0,
    vy: 0,
    angle: options.angle ?? 0,
    aimAngle: options.angle ?? 0,
    health,
    maxHealth: health,
    speed: isCop ? 128 : 118,
    state: 'active',
    downTimer: 0,
    fireCooldown: options.fireDelay ?? 0.4,
    burst: 0,
    strafe: options.strafe ?? 1,
    strafeTimer: 0,
    preferredRange: isCop ? 250 : 220,
    accuracy: options.accuracy ?? (isCop ? 0.1 : 0.14),
    damage: options.damage ?? (isCop ? 9 : 11),
    muzzle: 0,
    hurtFlash: 0,
    role: options.role ?? faction,
    targetX: options.targetX ?? x,
    targetY: options.targetY ?? y,
    guard: options.guard ?? false,
    dropsLoot: options.dropsLoot ?? !isCop,
  };
}

function moveWithSliding(city, actor, dx, dy, dt) {
  const stepX = dx * actor.speed * dt;
  const stepY = dy * actor.speed * dt;
  if (!isBlocked(city, actor.x + stepX, actor.y, 11)) actor.x += stepX;
  if (!isBlocked(city, actor.x, actor.y + stepY, 11)) actor.y += stepY;
}

/** Advance every gunman; returns the ones that died this step so the caller can react. */
export function updateGunmen(game, dt) {
  const player = game.player;
  const fallen = [];
  for (let i = game.gunmen.length - 1; i >= 0; i -= 1) {
    const actor = game.gunmen[i];
    actor.fireCooldown = Math.max(0, actor.fireCooldown - dt);
    actor.muzzle = Math.max(0, actor.muzzle - dt * 4);
    actor.hurtFlash = Math.max(0, actor.hurtFlash - dt * 4);

    if (actor.health <= 0) {
      if (actor.state !== 'down') {
        actor.state = 'down';
        actor.downTimer = 24;
        fallen.push(actor);
        game.effects.spark(actor.x, actor.y, 10, '#ffd166');
        game.effects.decal(actor.x, actor.y);
      }
      actor.downTimer -= dt;
      if (actor.downTimer <= 0) game.gunmen.splice(i, 1);
      continue;
    }

    const target = player;
    const range = distance(actor.x, actor.y, target.x, target.y);
    const seesPlayer = hasLineOfSight(game.city, actor.x, actor.y, target.x, target.y);
    const wantAngle = angleTo(actor.x, actor.y, target.x, target.y);
    actor.angle = wantAngle;
    actor.aimAngle = wantAngle;

    if (actor.guard && range > 520) {
      const back = angleTo(target.x, target.y, actor.targetX, actor.targetY);
      moveWithSliding(game.city, actor, Math.cos(back), Math.sin(back), dt * 0.5);
      continue;
    }

    actor.strafeTimer -= dt;
    if (actor.strafeTimer <= 0) {
      actor.strafeTimer = 1.2 + game.rng.range(0, 1.4);
      actor.strafe = game.rng.chance(0.5) ? 1 : -1;
    }

    if (!seesPlayer || range > actor.preferredRange * 1.6) {
      const dx = Math.cos(wantAngle);
      const dy = Math.sin(wantAngle);
      moveWithSliding(game.city, actor, dx, dy, dt);
    } else if (range < actor.preferredRange * 0.55) {
      const dx = -Math.cos(wantAngle);
      const dy = -Math.sin(wantAngle);
      moveWithSliding(game.city, actor, dx, dy, dt);
    } else {
      const side = wantAngle + Math.PI / 2 * actor.strafe;
      moveWithSliding(game.city, actor, Math.cos(side) * 0.7, Math.sin(side) * 0.7, dt);
    }

    if (player.alive && seesPlayer && range < 520 && actor.fireCooldown <= 0 && game.mode === 'play') {
      const stars = game.wanted.stars;
      const spread = actor.faction === 'cop' ? clamp(0.16 - stars * 0.018, 0.05, 0.16) : actor.accuracy;
      const muzzleX = actor.x + Math.cos(wantAngle) * 18;
      const muzzleY = actor.y + Math.sin(wantAngle) * 18;
      game.bullets.push(createBullet(muzzleX, muzzleY, wantAngle + game.rng.range(-spread, spread), 980, actor.damage, 'npc'));
      actor.fireCooldown = actor.faction === 'cop' ? 0.55 : 0.75;
      actor.muzzle = 1;
      game.sound.gunshot('pistol');
      game.effects.muzzle(muzzleX, muzzleY, wantAngle);
    }
  }
  return fallen;
}

/** Officers bail out of a stopped cruiser and join the chase on foot. */
export function deployOfficersFrom(game, cruiser, count = 2) {
  for (let i = 0; i < count; i += 1) {
    const side = cruiser.angle + Math.PI / 2 + (i === 0 ? 0 : Math.PI);
    const x = cruiser.x + Math.cos(side) * (cruiser.spec.h * 0.5 + 26);
    const y = cruiser.y + Math.sin(side) * (cruiser.spec.h * 0.5 + 26);
    if (isBlocked(game.city, x, y, 12)) continue;
    game.gunmen.push(createGunman('cop', x, y, { angle: cruiser.angle, health: 75 }));
  }
}

export function gunmanNear(list, x, y, radius) {
  let best = null;
  let bestDistance = radius;
  for (let i = 0; i < list.length; i += 1) {
    const actor = list[i];
    if (actor.health <= 0) continue;
    const d = distance(actor.x, actor.y, x, y);
    if (d < bestDistance) {
      bestDistance = d;
      best = actor;
    }
  }
  return best;
}

/** Small spread helper shared by the mission scripts when they aim at a point. */
export function aimAt(fromX, fromY, toX, toY, spread, rng) {
  const base = angleTo(fromX, fromY, toX, toY);
  return base + rng.range(-spread, spread);
}

export function faceTarget(actor, x, y) {
  actor.angle = angleTo(actor.x, actor.y, x, y);
  actor.aimAngle = actor.angle;
}

export function turnToward(actor, angle, dt, rate = 7) {
  actor.angle += clamp(angleDifference(actor.angle, angle), -rate * dt, rate * dt);
}
