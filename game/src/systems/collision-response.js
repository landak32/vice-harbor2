// Collision and damage. Cars are checked as three circles along their body against the building
// grid, the solid props and each other; a hit pushes them apart, bleeds off speed along the
// contact normal, shakes the camera and hurts the car. Small props like lamp posts are knocked
// over instead of stopping a two-tonne sedan dead.

import { circleRectOverlap, clamp, distance } from '../core/geometry.js';
import { solidsNear, isWater } from '../world/city-queries.js';

const BODY_SAMPLES = [-0.3, 0, 0.3];

export function damageVehicle(game, vehicle, amount) {
  if (vehicle.wrecked) return;
  vehicle.health = Math.max(0, vehicle.health - amount);
  vehicle.damageFlash = 1;
  if (vehicle.health <= 0) {
    vehicle.wrecked = true;
    vehicle.sirenOn = false;
    game.effects.smokeBurst(vehicle.x, vehicle.y, 14);
  }
}

function knockOverProp(city, solid) {
  if (solid.kind !== 'prop') return false;
  solid.disabled = true;
  if (solid.ref) solid.ref.broken = true;
  return true;
}

/** Push a car out of the world's solid geometry. Returns the impact speed, 0 for a clean miss. */
export function resolveVehicleWorld(game, vehicle) {
  const radius = vehicle.spec.h * 0.52;
  let impact = 0;
  for (let s = 0; s < BODY_SAMPLES.length; s += 1) {
    const offset = BODY_SAMPLES[s] * vehicle.spec.w;
    const px = vehicle.x + Math.cos(vehicle.angle) * offset;
    const py = vehicle.y + Math.sin(vehicle.angle) * offset;
    const solids = solidsNear(game.city, px, py, radius + 6);
    for (let i = 0; i < solids.length; i += 1) {
      const solid = solids[i];
      if (solid.disabled) continue;
      const hit = circleRectOverlap(px, py, radius, solid);
      if (!hit) continue;
      const speed = Math.hypot(vehicle.vx, vehicle.vy);
      if (knockOverProp(game.city, solid) && speed > 70) {
        game.effects.spark(px, py, 6, '#d8c090');
        continue;
      }
      let nx = hit.dx;
      let ny = hit.dy;
      if (nx === 0 && ny === 0) {
        const left = px - solid.x;
        const right = solid.x + solid.w - px;
        const top = py - solid.y;
        const bottom = solid.y + solid.h - py;
        const smallest = Math.min(left, right, top, bottom);
        nx = smallest === left ? -1 : smallest === right ? 1 : 0;
        ny = smallest === top ? -1 : smallest === bottom ? 1 : 0;
      }
      const length = Math.hypot(nx, ny) || 1;
      const pushX = (nx / length) * (hit.depth + 0.5);
      const pushY = (ny / length) * (hit.depth + 0.5);
      vehicle.x += pushX;
      vehicle.y += pushY;
      const normalX = nx / length;
      const normalY = ny / length;
      const closing = -(vehicle.vx * normalX + vehicle.vy * normalY);
      if (closing > 0) {
        vehicle.vx += normalX * closing * 1.25;
        vehicle.vy += normalY * closing * 1.25;
        vehicle.vx *= 0.55;
        vehicle.vy *= 0.55;
        impact = Math.max(impact, closing);
      }
    }
  }
  if (isWater(game.city, vehicle.x, vehicle.y)) {
    vehicle.vx *= 0.2;
    vehicle.vy *= 0.2;
    vehicle.x -= Math.cos(vehicle.angle) * 4;
    vehicle.y -= Math.sin(vehicle.angle) * 4;
    impact = Math.max(impact, 60);
  }
  if (impact > 40) {
    damageVehicle(game, vehicle, (impact - 40) * 0.22);
    game.effects.spark(vehicle.x, vehicle.y, Math.min(14, 4 + impact / 30), '#ffd9a0');
    game.effects.shake(Math.min(9, impact / 60));
    game.sound.impact(impact / 240);
    if (vehicle.driver === 'player') game.hurtPlayer((impact - 40) * 0.05);
  }
  return impact;
}

/** Car against car: split the push by mass, trade momentum along the contact normal. */
export function resolveVehiclePairs(game) {
  const vehicles = game.vehicles;
  for (let i = 0; i < vehicles.length; i += 1) {
    const a = vehicles[i];
    for (let j = i + 1; j < vehicles.length; j += 1) {
      const b = vehicles[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const reach = (a.spec.w + b.spec.w) * 0.42;
      const d2 = dx * dx + dy * dy;
      if (d2 > reach * reach || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const ny = dy / d;
      const overlap = reach - d;
      const totalMass = a.spec.mass + b.spec.mass;
      a.x -= nx * overlap * (b.spec.mass / totalMass);
      a.y -= ny * overlap * (b.spec.mass / totalMass);
      b.x += nx * overlap * (a.spec.mass / totalMass);
      b.y += ny * overlap * (a.spec.mass / totalMass);
      const relative = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relative < 0) {
        const impulse = (-(1.2) * relative) / (1 / a.spec.mass + 1 / b.spec.mass);
        a.vx -= (impulse / a.spec.mass) * nx;
        a.vy -= (impulse / a.spec.mass) * ny;
        b.vx += (impulse / b.spec.mass) * nx;
        b.vy += (impulse / b.spec.mass) * ny;
        const force = Math.abs(relative);
        if (force > 60) {
          damageVehicle(game, a, force * 0.06);
          damageVehicle(game, b, force * 0.06);
          game.effects.spark((a.x + b.x) / 2, (a.y + b.y) / 2, 5, '#ffd9a0');
          if (a.driver === 'player' || b.driver === 'player') {
            game.effects.shake(Math.min(8, force / 80));
            game.sound.impact(force / 260);
          }
        }
      }
    }
  }
}

/** A pedestrian's shoulder against the world: they simply cannot walk through a wall. */
export function resolvePersonWorld(game, person, radius = 10) {
  const solids = solidsNear(game.city, person.x, person.y, radius + 4);
  for (let i = 0; i < solids.length; i += 1) {
    const solid = solids[i];
    if (solid.disabled) continue;
    const hit = circleRectOverlap(person.x, person.y, radius, solid);
    if (!hit) continue;
    const nx = hit.dx || (person.x < solid.x + solid.w / 2 ? -1 : 1);
    const ny = hit.dy || (person.y < solid.y + solid.h / 2 ? -1 : 1);
    const length = Math.hypot(nx, ny) || 1;
    person.x += (nx / length) * (hit.depth + 0.4);
    person.y += (ny / length) * (hit.depth + 0.4);
  }
}

/** Pedestrians and gunmen hit by a moving car. */
export function checkPeopleAgainstCars(game) {
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    const speed = Math.hypot(car.vx, car.vy);
    if (speed < 55) continue;
    for (let p = 0; p < game.pedestrians.length; p += 1) {
      const ped = game.pedestrians[p];
      if (ped.state === 'down' || ped.state === 'dead') continue;
      if (distance(car.x, car.y, ped.x, ped.y) < car.spec.w * 0.5) {
        game.knockPedestrian(ped);
        game.effects.spark(ped.x, ped.y, 5, '#e8d9b0');
        if (car.driver === 'player') {
          game.addHeat(10, 'assault');
          game.effects.shake(3);
        }
      }
    }
    for (let g = 0; g < game.gunmen.length; g += 1) {
      const actor = game.gunmen[g];
      if (actor.health <= 0) continue;
      if (distance(car.x, car.y, actor.x, actor.y) < car.spec.w * 0.5) {
        actor.health -= speed * 0.35;
        actor.hurtFlash = 1;
        if (actor.health <= 0 && actor.faction === 'cop') game.onOfficerDown(actor);
        game.effects.spark(actor.x, actor.y, 6, '#ffd9a0');
      }
    }
  }
}

export function clampActorToWorld(city, actor, radius = 12) {
  actor.x = clamp(actor.x, radius, city.width - radius);
  actor.y = clamp(actor.y, radius, city.height - radius);
}
