// Bullets as real travelling objects: each one moves in short substeps, sparks off walls, punches
// through a windscreen, and stops in whoever it meets. Muzzle flashes, impact sparks and tyre
// smoke all come from the effects pool, so a firefight reads at a glance.

import { isBlocked } from '../world/city-queries.js';
import { distance } from '../core/geometry.js';
import { damageVehicle } from '../systems/collision-response.js';

const SUBSTEP = 16;

export function createBullet(x, y, angle, speed, damage, owner) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    damage,
    owner,
    life: 1.4,
    angle,
    dead: false,
  };
}

function hitPerson(game, bullet) {
  const candidates = bullet.owner === 'player' ? game.gunmen : [];
  for (let i = 0; i < candidates.length; i += 1) {
    const actor = candidates[i];
    if (actor.health <= 0) continue;
    if (distance(bullet.x, bullet.y, actor.x, actor.y) < 16) {
      actor.health -= bullet.damage;
      actor.hurtFlash = 1;
      if (actor.health <= 0) {
        game.stats.kills += 1;
        if (actor.faction === 'cop') game.onOfficerDown(actor);
        else game.onThugDown(actor);
      }
      game.effects.spark(bullet.x, bullet.y, 8, '#ffd9a0');
      return true;
    }
  }
  if (bullet.owner === 'player') {
    for (let i = 0; i < game.pedestrians.length; i += 1) {
      const ped = game.pedestrians[i];
      if (ped.state === 'dead') continue;
      if (distance(bullet.x, bullet.y, ped.x, ped.y) < 15) {
        ped.health -= bullet.damage;
        game.effects.spark(bullet.x, bullet.y, 6, '#ffd9a0');
        if (ped.health <= 0) {
          game.killPedestrian(ped);
        } else {
          ped.state = 'flee';
          ped.fleeTimer = 6;
          ped.threatX = game.player.x;
          ped.threatY = game.player.y;
        }
        game.addHeat(6, 'shots fired');
        return true;
      }
    }
  }
  return false;
}

function hitVehicle(game, bullet) {
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    const dx = bullet.x - car.x;
    const dy = bullet.y - car.y;
    if (dx * dx + dy * dy > (car.spec.w * 0.55) * (car.spec.w * 0.55)) continue;
    damageVehicle(game, car, bullet.damage * 0.6);
    game.effects.spark(bullet.x, bullet.y, 5, '#ffe0a0');
    if (car.driver === 'player' && bullet.owner !== 'player') {
      game.hurtPlayer(bullet.damage * 0.35);
    }
    return true;
  }
  return false;
}

export function updateBullets(game, dt) {
  for (let i = game.bullets.length - 1; i >= 0; i -= 1) {
    const bullet = game.bullets[i];
    bullet.life -= dt;
    if (bullet.life <= 0) {
      game.bullets.splice(i, 1);
      continue;
    }
    const travel = Math.hypot(bullet.vx, bullet.vy) * dt;
    const steps = Math.max(1, Math.ceil(travel / SUBSTEP));
    let consumed = false;
    for (let s = 0; s < steps && !consumed; s += 1) {
      bullet.x += (bullet.vx * dt) / steps;
      bullet.y += (bullet.vy * dt) / steps;
      if (isBlocked(game.city, bullet.x, bullet.y, 3)) {
        game.effects.spark(bullet.x, bullet.y, 5, '#cfd6e4');
        consumed = true;
        break;
      }
      if (hitPerson(game, bullet)) {
        consumed = true;
        break;
      }
      if (bullet.owner !== 'player' || game.wanted.stars > 0) {
        if (hitVehicle(game, bullet)) {
          consumed = true;
          break;
        }
      }
      if (bullet.owner === 'npc' && game.player.alive) {
        const player = game.player;
        if (distance(bullet.x, bullet.y, player.x, player.y) < 15) {
          game.hurtPlayer(bullet.damage);
          game.effects.spark(bullet.x, bullet.y, 7, '#ff8a8a');
          consumed = true;
          break;
        }
      }
    }
    if (consumed) game.bullets.splice(i, 1);
  }
}
