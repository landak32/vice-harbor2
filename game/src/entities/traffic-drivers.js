// Civilian traffic. Each car is a real physics body steered by a lane follower: it picks the next
// junction, keeps to the right-hand lane, brakes for red lights and for whatever is in front of
// it, honks when it has waited too long, and swerves away when shots ring out nearby.

import { createVehicle, randomVehicleType, steerToward, updateVehiclePhysics } from './vehicle-physics.js';
import { angleTo, distance, clamp } from '../core/geometry.js';

const LANE = 26;
const LIGHT_CYCLE = 16;
const STOP_REACH = 165;

/** Right-hand lane offset for a heading, in screen coordinates (y grows southward). */
export function laneOffsetFor(dx, dy) {
  return { x: -dy * LANE, y: dx * LANE };
}

export function nodePoint(city, column, row) {
  return { x: city.cols[column], y: city.rows[row] };
}

function neighbourDirections(city, column, row) {
  const options = [];
  if (column + 1 < city.cols.length) options.push({ dc: 1, dr: 0 });
  if (column - 1 >= 0) options.push({ dc: -1, dr: 0 });
  if (row + 1 < city.rows.length) options.push({ dc: 0, dr: 1 });
  if (row - 1 >= 0) options.push({ dc: 0, dr: -1 });
  return options;
}

/** A random stretch of road, with a car placed in the correct lane partway along it. */
export function randomLanePlacement(city, rng) {
  const column = rng.int(0, city.cols.length - 1);
  const row = rng.int(0, city.rows.length - 1);
  const directions = neighbourDirections(city, column, row);
  const direction = rng.pick(directions);
  const from = { column, row };
  const to = { column: column + direction.dc, row: row + direction.dr };
  return { from, to, t: rng.range(0.12, 0.88) };
}

export function spawnTrafficCar(city, rng, placement, options = {}) {
  const from = nodePoint(city, placement.from.column, placement.from.row);
  const to = nodePoint(city, placement.to.column, placement.to.row);
  const dx = Math.sign(to.x - from.x);
  const dy = Math.sign(to.y - from.y);
  const offset = laneOffsetFor(dx, dy);
  const t = placement.t ?? 0.5;
  const x = from.x + (to.x - from.x) * t + offset.x;
  const y = from.y + (to.y - from.y) * t + offset.y;
  const angle = Math.atan2(dy, dx);
  const type = options.type ?? randomVehicleType(rng);
  const car = createVehicle(type, x, y, angle, {
    color: options.color,
    driver: 'ai',
    role: options.role ?? 'civilian',
  });
  car.route = { from: placement.from, to: placement.to };
  car.cruise = options.cruise ?? rng.range(120, 190);
  car.patience = rng.range(0, 2);
  car.laneWobble = rng.range(0, Math.PI * 2);
  car.aiKind = options.role === 'police' ? 'pursuit' : 'traffic';
  car.lightsOn = true;
  car.vx = Math.cos(angle) * car.cruise * 0.6;
  car.vy = Math.sin(angle) * car.cruise * 0.6;
  return car;
}

/** Which axis a car is travelling on, for the traffic lights. */
export function axisOf(route) {
  return route.from.row === route.to.row ? 'horizontal' : 'vertical';
}

/** 'green' | 'yellow' | 'red' for one axis at one junction at a given clock time. */
export function signalFor(city, column, row, axis, clock) {
  const intersection = city.intersections.find((node) => node.column === column && node.row === row);
  const offset = intersection ? intersection.offset : 0;
  const phase = (clock + offset * 2) % LIGHT_CYCLE;
  if (axis === 'vertical') {
    if (phase < 7) return 'green';
    if (phase < 8.4) return 'yellow';
    return 'red';
  }
  if (phase >= 8 && phase < 15) return 'green';
  if (phase >= 15) return 'yellow';
  return 'red';
}

function chooseNextRoute(city, route, rng, straightBias) {
  const current = route.to;
  const options = neighbourDirections(city, current.column, current.row).filter(
    (dir) => !(current.column + dir.dc === route.from.column && current.row + dir.dr === route.from.row),
  );
  if (options.length === 0) return { from: current, to: route.from };
  const straight = options.find((dir) => dir.dc === Math.sign(current.column - route.from.column) && dir.dr === Math.sign(current.row - route.from.row));
  if (straight && rng.chance(straightBias)) return { from: current, to: { column: current.column + straight.dc, row: current.row + straight.dr } };
  const picked = rng.pick(options);
  return { from: current, to: { column: current.column + picked.dc, row: current.row + picked.dr } };
}

/** Anything close and ahead in our lane: another car, the player, or the player's car. */
function obstacleAhead(game, car, directionX, directionY) {
  let nearest = Infinity;
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const other = game.vehicles[i];
    if (other === car) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const ahead = dx * directionX + dy * directionY;
    if (ahead <= 0 || ahead > 150) continue;
    const sideways = Math.abs(-dx * directionY + dy * directionX);
    if (sideways > 34) continue;
    nearest = Math.min(nearest, ahead);
  }
  const player = game.player;
  if (player.onFoot && player.alive) {
    const dx = player.x - car.x;
    const dy = player.y - car.y;
    const ahead = dx * directionX + dy * directionY;
    const sideways = Math.abs(-dx * directionY + dy * directionX);
    if (ahead > 0 && ahead < 130 && sideways < 34) nearest = Math.min(nearest, ahead);
  }
  return nearest;
}

/** One traffic car's brain: returns the controls to feed its physics. */
export function driveTraffic(car, game, dt) {
  const route = car.route;
  const rng = game.rng;
  const from = nodePoint(game.city, route.from.column, route.from.row);
  const to = nodePoint(game.city, route.to.column, route.to.row);
  const dx = Math.sign(to.x - from.x) || 0;
  const dy = Math.sign(to.y - from.y) || 0;
  const offset = laneOffsetFor(dx, dy);
  const targetX = to.x + offset.x;
  const targetY = to.y + offset.y;

  if (distance(car.x, car.y, targetX, targetY) < 64) {
    car.route = chooseNextRoute(game.city, route, rng, 0.62);
  }

  const controls = steerToward(car, targetX, targetY);
  const speed = Math.hypot(car.vx, car.vy);
  const axis = axisOf(car.route);
  const light = signalFor(game.city, car.route.to.column, car.route.to.row, axis, game.clock.seconds);
  const distanceToStop = distance(car.x, car.y, targetX, targetY);
  const panicking = car.panic > 0;

  let stop = false;
  if (!panicking && distanceToStop < STOP_REACH && light !== 'green') stop = true;

  const ahead = obstacleAhead(game, car, Math.cos(car.angle), Math.sin(car.angle));
  if (ahead < 90) stop = true;
  if (ahead < 55) stop = true;

  if (stop) {
    controls.throttle = 0;
    controls.brake = true;
    car.blockedTimer += dt;
    car.patience -= dt;
    if (car.blockedTimer > 1.4 && car.honkCooldown <= 0 && car.patience <= 0) {
      car.honkCooldown = 5;
      car.patience = 4 + rng.range(0, 4);
      game.onHonk?.(car);
    }
  } else {
    car.blockedTimer = Math.max(0, car.blockedTimer - dt * 2);
    const cruise = panicking ? car.cruise * 1.75 : car.cruise;
    if (speed < cruise) controls.throttle = clamp((cruise - speed) / 120, 0.15, 1);
    else controls.throttle = 0.1;
  }

  if (panicking) {
    car.laneWobble += dt * 9;
    controls.steer = clamp(controls.steer + Math.sin(car.laneWobble) * 0.55, -1, 1);
    car.panic = Math.max(0, car.panic - dt);
  }
  return controls;
}

export function updateTraffic(game, dt) {
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    if (car.driver !== 'ai' || car.aiKind !== 'traffic') continue;
    const controls = driveTraffic(car, game, dt);
    updateVehiclePhysics(car, controls, dt);
  }
}

/** Fills the streets with traffic at boot and keeps the population topped up. */
export function populateTraffic(game, count) {
  const rng = game.rng;
  for (let i = 0; i < count; i += 1) {
    const placement = randomLanePlacement(game.city, rng);
    game.vehicles.push(spawnTrafficCar(game.city, rng, placement));
  }
}

/** Shots fired nearby: everyone within earshot floors it and swerves. */
export function startleNearbyTraffic(game, x, y, radius = 760) {
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    if (car.driver !== 'ai' || car.aiKind !== 'traffic') continue;
    if (distance(car.x, car.y, x, y) < radius) car.panic = 3.5;
  }
  for (let i = 0; i < game.pedestrians.length; i += 1) {
    const ped = game.pedestrians[i];
    if (ped.state === 'walk' && distance(ped.x, ped.y, x, y) < radius) {
      ped.state = 'flee';
      ped.fleeTimer = 5.5;
      ped.threatX = x;
      ped.threatY = y;
    }
  }
}
