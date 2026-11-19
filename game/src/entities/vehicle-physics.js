// Arcade car physics: one rigid body per car with an engine, brakes, a steering wheel that only
// bites at speed, and lateral grip that decides how far the tail steps out. Six classes of car
// share the model but differ in speed, grip and mass, so a truck wallows where a sports car cuts.

import { clamp, approachZero, angleDifference, angleTo, distance } from '../core/geometry.js';

export const VEHICLE_TYPES = {
  sports: {
    id: 'sports', label: 'Meridian GT', maxSpeed: 660, accel: 620, brake: 900, drag: 0.55,
    grip: 8.4, turn: 3.3, mass: 900, w: 94, h: 42, seats: 2,
    colors: ['#e8402a', '#2fd0c8', '#f2c94c', '#f5f5f5', '#7a4bff'],
    headlights: true,
  },
  sedan: {
    id: 'sedan', label: 'Vantage 4D', maxSpeed: 480, accel: 340, brake: 780, drag: 0.7,
    grip: 6.1, turn: 2.9, mass: 1250, w: 102, h: 45, seats: 4,
    colors: ['#4a6fa5', '#8a8f98', '#2b2f36', '#b23a48', '#d8d8d8'],
    headlights: true,
  },
  van: {
    id: 'van', label: 'Cargo Hauler', maxSpeed: 410, accel: 250, brake: 700, drag: 0.8,
    grip: 4.9, turn: 2.4, mass: 1900, w: 114, h: 50, seats: 2,
    colors: ['#e8e2d0', '#5a6b7a', '#c0563a', '#3f7a8a'],
    headlights: true,
  },
  taxi: {
    id: 'taxi', label: 'Checker Cab', maxSpeed: 470, accel: 330, brake: 760, drag: 0.7,
    grip: 5.7, turn: 2.8, mass: 1300, w: 102, h: 45, seats: 4,
    colors: ['#f2c94c', '#e8b53a'],
    headlights: true,
  },
  police: {
    id: 'police', label: 'HPD Cruiser', maxSpeed: 570, accel: 450, brake: 900, drag: 0.6,
    grip: 6.9, turn: 3.0, mass: 1450, w: 104, h: 46, seats: 4,
    colors: ['#e8eef5', '#1b2a4a'],
    headlights: true,
  },
  truck: {
    id: 'truck', label: 'Flatbed 900', maxSpeed: 350, accel: 180, brake: 620, drag: 0.9,
    grip: 3.9, turn: 2.0, mass: 3200, w: 128, h: 54, seats: 2,
    colors: ['#8a5a3a', '#4a5a6a', '#c9a05a'],
    headlights: true,
  },
};

const TYPE_KEYS = Object.keys(VEHICLE_TYPES);

export function randomVehicleType(rng) {
  return rng.pick(TYPE_KEYS);
}

export function createVehicle(typeId, x, y, angle, options = {}) {
  const spec = VEHICLE_TYPES[typeId] ?? VEHICLE_TYPES.sedan;
  const maxHealth = options.health ?? (spec.id === 'truck' ? 260 : 160);
  return {
    type: spec.id,
    spec,
    label: spec.label,
    x,
    y,
    angle,
    vx: 0,
    vy: 0,
    health: maxHealth,
    maxHealth,
    wrecked: false,
    color: options.color ?? spec.colors[0],
    driver: options.driver ?? null,
    role: options.role ?? 'civilian',
    ai: options.ai ?? null,
    lightsOn: false,
    sirenOn: false,
    honkCooldown: 0,
    blockedTimer: 0,
    skidTimer: 0,
    smokeTimer: 0,
    damageFlash: 0,
    panic: 0,
    deployTimer: 0,
    missionTag: options.missionTag ?? null,
    stolen: false,
  };
}

/**
 * Advance one car by `dt` seconds. `controls` is { throttle -1..1, steer -1..1, brake }.
 * Returns the lateral slip in units/second, which the caller turns into tyre marks.
 */
export function updateVehiclePhysics(vehicle, controls, dt) {
  const spec = vehicle.spec;
  const throttle = clamp(controls.throttle ?? 0, -1, 1);
  const steer = clamp(controls.steer ?? 0, -1, 1);
  const braking = Boolean(controls.brake);
  const power = vehicle.wrecked ? 0.18 : 1;

  let forward = vehicle.vx * Math.cos(vehicle.angle) + vehicle.vy * Math.sin(vehicle.angle);
  let lateral = -vehicle.vx * Math.sin(vehicle.angle) + vehicle.vy * Math.cos(vehicle.angle);

  if (throttle > 0) {
    forward += spec.accel * power * throttle * dt;
  } else if (throttle < 0) {
    if (forward > 12) forward += spec.brake * throttle * dt;
    else forward += spec.accel * 0.55 * power * throttle * dt;
  }
  forward -= forward * spec.drag * dt;
  if (braking) forward = approachZero(forward, spec.brake * dt);
  forward = clamp(forward, -spec.maxSpeed * 0.4, spec.maxSpeed * (vehicle.wrecked ? 0.4 : 1));

  const grip = spec.grip * (vehicle.wrecked ? 0.55 : 1);
  lateral *= Math.exp(-grip * dt);

  const bite = clamp(Math.abs(forward) / 130, 0, 1);
  const directionSign = forward < -1 ? -1 : 1;
  vehicle.angle += steer * spec.turn * bite * directionSign * dt;
  if (Math.abs(forward) < 3 && Math.abs(steer) > 0.4) vehicle.angle += steer * 0.5 * dt;

  const cos = Math.cos(vehicle.angle);
  const sin = Math.sin(vehicle.angle);
  vehicle.vx = cos * forward - sin * lateral;
  vehicle.vy = sin * forward + cos * lateral;
  vehicle.x += vehicle.vx * dt;
  vehicle.y += vehicle.vy * dt;
  vehicle.forwardSpeed = forward;
  vehicle.lateralSpeed = lateral;
  vehicle.damageFlash = Math.max(0, vehicle.damageFlash - dt * 3);
  vehicle.honkCooldown = Math.max(0, vehicle.honkCooldown - dt);
  vehicle.panic = Math.max(0, vehicle.panic - dt);
  return Math.abs(lateral);
}

/** Controls that aim a car at a point: the AI drivers and the autopilot both use this. */
export function steerToward(vehicle, targetX, targetY, options = {}) {
  const desired = angleTo(vehicle.x, vehicle.y, targetX, targetY);
  const error = angleDifference(vehicle.angle, desired);
  const distanceToTarget = distance(vehicle.x, vehicle.y, targetX, targetY);
  const speed = Math.hypot(vehicle.vx, vehicle.vy);
  const turnLimit = clamp(1.6 - speed / 900, 0.5, 1.4);
  const steer = clamp(error * (options.steerGain ?? 1.9), -turnLimit, turnLimit);
  let throttle = 1;
  if (Math.abs(error) > 1.1) throttle = 0.35;
  if (options.slowRadius && distanceToTarget < options.slowRadius) throttle = 0.25;
  if (options.stopRadius && distanceToTarget < options.stopRadius) throttle = 0;
  const brake = Boolean(options.brake);
  return { throttle, steer, brake };
}

/** A point a little ahead of the car's nose, where its headlights and muzzle flashes sit. */
export function noseOf(vehicle, offset = 0) {
  const reach = vehicle.spec.w * 0.5 + offset;
  return {
    x: vehicle.x + Math.cos(vehicle.angle) * reach,
    y: vehicle.y + Math.sin(vehicle.angle) * reach,
  };
}

export function isPlayerDriven(vehicle) {
  return vehicle.driver === 'player';
}
