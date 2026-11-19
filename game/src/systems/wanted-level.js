// The wanted level, one to five stars. Crimes pour heat into a bucket; the bucket cools only
// once no officer has had a clear look at the player for several seconds, which is what makes
// breaking line of sight the way out of a chase.

import { clamp, distance } from '../core/geometry.js';
import { hasLineOfSight } from '../world/city-queries.js';

const THRESHOLDS = [0, 30, 70, 130, 210, 320];
const COOL_DELAY = 5.5;

export function createWantedLevel() {
  return {
    heat: 0,
    stars: 0,
    unseenFor: 0,
    flash: 0,
    lastReason: '',
    peakStars: 0,
  };
}

export function starsForHeat(heat) {
  let stars = 0;
  for (let i = 1; i < THRESHOLDS.length; i += 1) {
    if (heat >= THRESHOLDS[i]) stars = i;
  }
  return stars;
}

export function addHeat(wanted, amount, reason = '') {
  wanted.heat = clamp(wanted.heat + amount, 0, 400);
  const next = starsForHeat(wanted.heat);
  if (next > wanted.stars) {
    wanted.stars = next;
    wanted.flash = 2.4;
    wanted.lastReason = reason;
  }
  wanted.peakStars = Math.max(wanted.peakStars, wanted.stars);
}

export function clearWanted(wanted) {
  wanted.heat = 0;
  wanted.stars = 0;
  wanted.unseenFor = 0;
  wanted.flash = 0;
}

/** One officer or cruiser with a clear view keeps the level warm. */
export function policeHaveEyes(game) {
  const player = game.player;
  for (let i = 0; i < game.gunmen.length; i += 1) {
    const actor = game.gunmen[i];
    if (actor.faction !== 'cop' || actor.health <= 0) continue;
    if (distance(actor.x, actor.y, player.x, player.y) < 720 && hasLineOfSight(game.city, actor.x, actor.y, player.x, player.y)) return true;
  }
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    if (car.role !== 'police') continue;
    if (distance(car.x, car.y, player.x, player.y) < 760 && hasLineOfSight(game.city, car.x, car.y, player.x, player.y)) return true;
  }
  return false;
}

export function updateWanted(game, dt) {
  const wanted = game.wanted;
  wanted.flash = Math.max(0, wanted.flash - dt);

  if (wanted.heat <= 0) {
    wanted.stars = 0;
    wanted.unseenFor = 0;
    return;
  }

  if (policeHaveEyes(game)) {
    wanted.unseenFor = 0;
  } else {
    wanted.unseenFor += dt;
  }

  if (wanted.unseenFor > COOL_DELAY) {
    const cooling = 14 + wanted.stars * 4;
    wanted.heat = Math.max(0, wanted.heat - cooling * dt);
  } else if (wanted.stars === 0 && wanted.heat > 0) {
    wanted.heat = Math.max(0, wanted.heat - 6 * dt);
  }

  const next = starsForHeat(wanted.heat);
  if (next < wanted.stars) {
    wanted.stars = next;
    game.toast(next === 0 ? 'You lost the cops' : `Wanted level down: ${next} star${next === 1 ? '' : 's'}`);
    game.sound.blip(false);
  } else if (next > wanted.stars) {
    wanted.stars = next;
    wanted.flash = 2.4;
  }
}

export function wantedLabel(stars) {
  if (stars <= 0) return 'Clean';
  if (stars === 1) return 'Suspicious';
  if (stars === 2) return 'Wanted';
  if (stars === 3) return 'Hunted';
  if (stars === 4) return 'Lockdown';
  return 'City-wide alert';
}

export function bustCostFor(stars) {
  return 120 + stars * 60;
}
