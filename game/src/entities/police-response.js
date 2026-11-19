// The police response. The wanted level decides how many cruisers come, how far off they spawn,
// and whether the officers stay in the car or bail out with pistols drawn. Cars pursue through
// the street grid, ram a stopped player, and give up when the stars are gone.

import { createVehicle, steerToward, updateVehiclePhysics } from '../entities/vehicle-physics.js';
import { deployOfficersFrom } from '../entities/armed-npcs.js';
import { roadPointNear, isOnRoad } from '../world/city-queries.js';
import { distance, clamp } from '../core/geometry.js';

const MAX_CRUISERS = 6;

export function spawnCruiser(game, minDistance = 900, maxDistance = 1500) {
  const rng = game.rng;
  const player = game.player;
  const spot = roadPointNear(game.city, player.x, player.y, minDistance, maxDistance, rng);
  const angle = rng.angle();
  const cruiser = createVehicle('police', spot.x, spot.y, angle, {
    driver: 'ai',
    role: 'police',
    color: '#e8eef5',
  });
  cruiser.aiKind = 'pursuit';
  cruiser.sirenOn = true;
  cruiser.lightsOn = true;
  cruiser.deployTimer = 1.2;
  cruiser.pursuitAge = 0;
  cruiser.cruise = 240;
  game.vehicles.push(cruiser);
  game.stats.policeCars += 1;
  return cruiser;
}

/** A cruiser that has lost the scent drives off and is removed once it is far away. */
function retireCruiser(game, cruiser, dt) {
  const player = game.player;
  const away = Math.atan2(cruiser.y - player.y, cruiser.x - player.x);
  const controls = steerToward(cruiser, cruiser.x + Math.cos(away) * 600, cruiser.y + Math.sin(away) * 600);
  controls.throttle = 0.8;
  updateVehiclePhysics(cruiser, controls, dt);
  cruiser.sirenOn = false;
  cruiser.retireTimer = (cruiser.retireTimer ?? 0) + dt;
  if (cruiser.retireTimer > 12 && distance(cruiser.x, cruiser.y, player.x, player.y) > 1100) {
    cruiser.removeMe = true;
  }
}

export function updatePoliceResponse(game, dt) {
  const stars = game.wanted.stars;
  const player = game.player;
  const cruisers = game.vehicles.filter((car) => car.role === 'police');

  if (stars <= 0) {
    for (let i = 0; i < cruisers.length; i += 1) retireCruiser(game, cruisers[i], dt);
    for (let i = game.gunmen.length - 1; i >= 0; i -= 1) {
      if (game.gunmen[i].faction === 'cop') game.gunmen[i].downTimer = Math.min(game.gunmen[i].downTimer, 0.5);
    }
    game.policeSpawnTimer = 0;
    return;
  }

  const wantedCount = clamp(stars + 1, 2, MAX_CRUISERS);
  game.policeSpawnTimer = (game.policeSpawnTimer ?? 0) - dt;
  const active = cruisers.filter((car) => !car.removeMe).length;
  if (active < wantedCount && game.policeSpawnTimer <= 0) {
    spawnCruiser(game, stars >= 4 ? 700 : 950, stars >= 4 ? 1100 : 1500);
    game.policeSpawnTimer = stars >= 4 ? 1.6 : 3.4;
  }

  for (let i = 0; i < cruisers.length; i += 1) {
    const cruiser = cruisers[i];
    if (cruiser.removeMe) continue;
    cruiser.pursuitAge = (cruiser.pursuitAge ?? 0) + dt;
    const range = distance(cruiser.x, cruiser.y, player.x, player.y);
    const heading = Math.atan2(player.vy, player.vx);
    const bias = cruiser.pursuitBias ?? 0;
    const targetX = player.x + player.vx * 0.35 + Math.cos(heading + Math.PI / 2) * bias;
    const targetY = player.y + player.vy * 0.35 + Math.sin(heading + Math.PI / 2) * bias;
    const controls = steerToward(cruiser, targetX, targetY, { stopRadius: 70 });
    if (range > 1200) {
      // Too far to see: head for the last known junction and keep the siren on.
      const spot = roadPointNear(game.city, player.x, player.y, 200, 500, game.rng);
      const fallback = steerToward(cruiser, spot.x, spot.y);
      updateVehiclePhysics(cruiser, fallback, dt);
      continue;
    }
    if (range < 150 && !player.onFoot) {
      controls.throttle = 0;
      controls.brake = true;
    }
    updateVehiclePhysics(cruiser, controls, dt);
    cruiser.sirenOn = true;

    if (stars >= 2 && range < 230 && player.onFoot && cruiser.deployTimer <= 0 && Math.hypot(cruiser.vx, cruiser.vy) < 120) {
      deployOfficersFrom(game, cruiser, stars >= 3 ? 2 : 1);
      cruiser.deployTimer = 999;
      cruiser.stopped = true;
    }
    if (cruiser.deployTimer > 0 && cruiser.deployTimer < 900) cruiser.deployTimer -= dt;
  }

  if (stars >= 3 && game.gunmen.filter((actor) => actor.faction === 'cop' && actor.health > 0).length < stars - 1) {
    game.officerSpawnTimer = (game.officerSpawnTimer ?? 0) - dt;
    if (game.officerSpawnTimer <= 0) {
      const spot = roadPointNear(game.city, player.x, player.y, 500, 900, game.rng);
      const x = spot.x + game.rng.range(-30, 30);
      const y = spot.y + game.rng.range(-30, 30);
      game.spawnOfficer(x, y);
      game.officerSpawnTimer = 6;
    }
  }
}

export function clearPolice(game) {
  for (let i = game.vehicles.length - 1; i >= 0; i -= 1) {
    if (game.vehicles[i].role === 'police') game.vehicles.splice(i, 1);
  }
  for (let i = game.gunmen.length - 1; i >= 0; i -= 1) {
    if (game.gunmen[i].faction === 'cop') game.gunmen.splice(i, 1);
  }
}

export function countPoliceNear(game, x, y, radius) {
  let count = 0;
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    if (car.role === 'police' && distance(car.x, car.y, x, y) < radius) count += 1;
  }
  for (let i = 0; i < game.gunmen.length; i += 1) {
    const actor = game.gunmen[i];
    if (actor.faction === 'cop' && actor.health > 0 && distance(actor.x, actor.y, x, y) < radius) count += 1;
  }
  return count;
}

/** The road underneath a point, used to place a cruiser that can actually drive away. */
export function isDrivable(game, x, y) {
  return isOnRoad(game.city, x, y);
}
