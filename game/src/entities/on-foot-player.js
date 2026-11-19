// The player on foot and behind the wheel: acceleration and friction, eight-direction facing,
// a footstep bob, sprinting, fists, pistol and SMG, and getting in and out of any car with E.
// Health, armour, ammo and money live here too; the mission code reads them and pays into them.

import { clamp, damp, distance, angleTo, normalizeAngle } from '../core/geometry.js';

export const WEAPONS = {
  fists: { id: 'fists', name: 'Fists', rate: 0.36, damage: 16, spread: 0, range: 52, speed: 0, auto: false, ammoMax: Infinity },
  pistol: { id: 'pistol', name: 'Pistol', rate: 0.26, damage: 24, spread: 0.035, range: 900, speed: 1150, auto: false, ammoMax: 120 },
  smg: { id: 'smg', name: 'SMG', rate: 0.082, damage: 13, spread: 0.12, range: 760, speed: 1300, auto: true, ammoMax: 300 },
};

const WALK_SPEED = 148;
const RUN_SPEED = 268;
const ACCELERATION = 1500;
const FRICTION = 11;

export function createPlayer(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    aimAngle: -Math.PI / 2,
    health: 100,
    maxHealth: 100,
    armour: 0,
    weapon: 'pistol',
    unlocked: { fists: true, pistol: true, smg: false },
    ammo: { pistol: 36, smg: 0 },
    vehicle: null,
    onFoot: true,
    bob: 0,
    bobAmount: 0,
    stepTimer: 0,
    fireCooldown: 0,
    meleeTimer: 0,
    hurtTimer: 0,
    enterCooldown: 0,
    aimBlend: 0,
    muzzleTimer: 0,
    moving: 0,
    alive: true,
    respawnTimer: 0,
  };
}

/** Movement on foot. `intent` is {x, y, magnitude}; `sprint` is a held key. */
export function updatePlayerOnFoot(player, intent, sprint, dt) {
  const speedTarget = sprint && intent.magnitude > 0 ? RUN_SPEED : WALK_SPEED;
  const wishX = intent.x * speedTarget;
  const wishY = intent.y * speedTarget;
  const accel = intent.magnitude > 0 ? ACCELERATION : ACCELERATION * 0.7;
  player.vx += clamp(wishX - player.vx, -accel * dt, accel * dt);
  player.vy += clamp(wishY - player.vy, -accel * dt, accel * dt);
  if (intent.magnitude === 0) {
    player.vx = damp(player.vx, 0, FRICTION, dt);
    player.vy = damp(player.vy, 0, FRICTION, dt);
  }
  player.x += player.vx * dt;
  player.y += player.vy * dt;

  const speed = Math.hypot(player.vx, player.vy);
  player.moving = clamp(speed / RUN_SPEED, 0, 1);
  if (speed > 8) {
    // Eight-direction facing: the body snaps to the nearest 45 degrees, the sprite reads clean.
    const raw = Math.atan2(player.vy, player.vx);
    const snapped = Math.round(raw / (Math.PI / 4)) * (Math.PI / 4);
    player.angle = normalizeAngle(snapped);
    player.bob += speed * dt * 0.055;
    player.stepTimer -= dt * (speed / 120);
    if (player.stepTimer <= 0) {
      player.stepTimer = 0.42;
      return true;
    }
  } else {
    player.bob = damp(player.bob, Math.round(player.bob / Math.PI) * Math.PI, 8, dt);
  }
  player.bobAmount = damp(player.bobAmount, Math.min(1, speed / WALK_SPEED), 8, dt);
  return false;
}

/** Aim at a world point (the mouse), blended with the facing while running. */
export function updatePlayerAim(player, aimX, aimY, dt) {
  const wanted = angleTo(player.x, player.y, aimX, aimY);
  player.aimAngle = wanted;
  if (player.moving < 0.15) player.angle = wanted;
  player.aimBlend = damp(player.aimBlend, 1, 10, dt);
}

export function playerMuzzle(player) {
  const reach = 26;
  return {
    x: player.x + Math.cos(player.aimAngle) * reach,
    y: player.y + Math.sin(player.aimAngle) * reach,
  };
}

export function canFire(player) {
  const weapon = WEAPONS[player.weapon];
  if (player.fireCooldown > 0) return false;
  if (weapon.id === 'fists') return player.meleeTimer <= 0;
  return (player.ammo[weapon.id] ?? 0) > 0;
}

export function spendAmmo(player) {
  const weapon = WEAPONS[player.weapon];
  if (weapon.id === 'fists') return;
  player.ammo[weapon.id] = Math.max(0, (player.ammo[weapon.id] ?? 0) - 1);
  if (player.ammo[weapon.id] === 0 && weapon.id === 'pistol') {
    // An empty pistol still punches, so the player is never weaponless.
    player.weapon = 'fists';
  }
}

export function switchWeapon(player, id) {
  if (!player.unlocked[id]) return false;
  if (id !== 'fists' && (player.ammo[id] ?? 0) <= 0) return false;
  player.weapon = id;
  player.fireCooldown = 0.12;
  return true;
}

export function cycleWeapon(player) {
  const order = ['fists', 'pistol', 'smg'];
  const start = order.indexOf(player.weapon);
  for (let step = 1; step <= order.length; step += 1) {
    const id = order[(start + step) % order.length];
    if (player.unlocked[id] && (id === 'fists' || (player.ammo[id] ?? 0) > 0)) {
      player.weapon = id;
      return id;
    }
  }
  return player.weapon;
}

/** Applies damage through armour first. Returns true when the hit was fatal. */
export function damagePlayer(player, amount) {
  if (!player.alive) return false;
  player.hurtTimer = 0.6;
  let remaining = amount;
  if (player.armour > 0) {
    const absorbed = Math.min(player.armour, amount * 0.7);
    player.armour = Math.max(0, player.armour - absorbed);
    remaining = amount - absorbed;
  }
  player.health = Math.max(0, player.health - remaining);
  if (player.health <= 0) {
    player.alive = false;
    return true;
  }
  return false;
}

export function healPlayer(player, amount) {
  player.health = Math.min(player.maxHealth, player.health + amount);
}

export function addArmour(player, amount) {
  player.armour = Math.min(100, player.armour + amount);
}

/** Nearest drivable car within reach, for the "press E" prompt. */
export function nearestCar(vehicles, x, y, maxDistance = 96) {
  let best = null;
  let bestDistance = maxDistance;
  for (let i = 0; i < vehicles.length; i += 1) {
    const car = vehicles[i];
    if (car.driver === 'player') continue;
    if (Math.hypot(car.vx, car.vy) > 220) continue;
    const d = distance(x, y, car.x, car.y);
    if (d < bestDistance) {
      bestDistance = d;
      best = car;
    }
  }
  return best;
}

/** Where the player steps out: beside the driver's door, clear of the bodywork. */
export function exitPointFor(vehicle) {
  const side = vehicle.angle + Math.PI / 2;
  const reach = vehicle.spec.h * 0.5 + 22;
  return { x: vehicle.x + Math.cos(side) * reach, y: vehicle.y + Math.sin(side) * reach };
}
