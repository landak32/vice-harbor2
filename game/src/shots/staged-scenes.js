// The four screenshot scenes. Each one builds a real starting state — a car, a crowd, a wanted
// level, a job — and then runs the actual simulation forward with the autopilot, so what the
// camera sees is the game playing itself, not an overlay. Same seed, same frame.

import { createSeededRandom } from '../core/seeded-random.js';
import { createVehicle } from '../entities/vehicle-physics.js';
import { spawnTrafficCar } from '../entities/traffic-drivers.js';
import { createPedestrian } from '../entities/pedestrians.js';
import { createGunman } from '../entities/armed-npcs.js';
import { blockContaining } from '../world/city-queries.js';
import { snapCamera } from '../systems/camera-rig.js';
import { ScriptedInput, planDrive, simulateSteps, aheadOf } from './autopilot.js';

function putPlayerInCar(game, typeId, x, y, angle, color, speed) {
  const car = createVehicle(typeId, x, y, angle, { color, driver: 'player' });
  car.lightsOn = true;
  car.stolen = true;
  car.vx = Math.cos(angle) * speed;
  car.vy = Math.sin(angle) * speed;
  game.vehicles.push(car);
  game.player.vehicle = car;
  game.player.onFoot = false;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = angle;
  game.player.aimAngle = angle;
  snapCamera(game.camera, x, y, game.city);
  return car;
}

function clearArea(game, minX, minY, maxX, maxY) {
  for (let i = game.vehicles.length - 1; i >= 0; i -= 1) {
    const car = game.vehicles[i];
    if (car.x > minX && car.x < maxX && car.y > minY && car.y < maxY) {
      if (car.driver === 'player') continue;
      game.vehicles.splice(i, 1);
    }
  }
}

function placeTraffic(game, rng, from, to, t, type) {
  const car = spawnTrafficCar(game.city, rng, { from, to, t }, type ? { type } : {});
  game.vehicles.push(car);
  return car;
}

function addCruiser(game, x, y, angle, speed) {
  const cruiser = createVehicle('police', x, y, angle, { driver: 'ai', role: 'police', color: '#e8eef5' });
  cruiser.aiKind = 'pursuit';
  cruiser.sirenOn = true;
  cruiser.lightsOn = true;
  cruiser.vx = Math.cos(angle) * speed;
  cruiser.vy = Math.sin(angle) * speed;
  cruiser.deployTimer = 1.4;
  cruiser.pursuitAge = 2;
  game.vehicles.push(cruiser);
  return cruiser;
}

function spawnCrowd(game, centerX, centerY, count, rng) {
  const near = [];
  for (let i = 0; i < game.city.blocks.length; i += 1) {
    const block = game.city.blocks[i];
    const cx = block.x + block.w / 2;
    const cy = block.y + block.h / 2;
    if (Math.hypot(cx - centerX, cy - centerY) < 760) near.push(block);
  }
  if (near.length === 0) return;
  for (let placed = 0; placed < count; placed += 1) {
    const block = near[rng.int(0, near.length - 1)];
    const ped = createPedestrian(game.city, rng, block);
    // Stand them on the pavement ring, never on a roof.
    const edge = rng.int(0, 3);
    const inset = 13;
    if (edge === 0) {
      ped.x = block.x + rng.range(inset, block.w - inset);
      ped.y = block.y + inset;
    } else if (edge === 1) {
      ped.x = block.x + block.w - inset;
      ped.y = block.y + rng.range(inset, block.h - inset);
    } else if (edge === 2) {
      ped.x = block.x + rng.range(inset, block.w - inset);
      ped.y = block.y + block.h - inset;
    } else {
      ped.x = block.x + inset;
      ped.y = block.y + rng.range(inset, block.h - inset);
    }
    ped.target = rng.int(0, 3);
    game.pedestrians.push(ped);
  }
}

function stageMission(game, index, objective, markerPoint, radius) {
  game.missions.staged = true;
  game.missions.index = index;
  game.missions.status = 'running';
  game.missions.objective = objective;
  game.missions.marker = markerPoint ? { x: markerPoint.x, y: markerPoint.y, radius: radius ?? 60 } : null;
}

function stageChase(game, rng) {
  game.clock.hour = 22.4;
  game.clock.frozen = true;
  clearArea(game, 2300, 150, 3020, 2700);

  const car = putPlayerInCar(game, 'sports', 2666, 2340, -Math.PI / 2, '#e8402a', 420);
  car.health = 150;

  const c1 = addCruiser(game, 2590, 2560, -Math.PI / 2, 420);
  const c2 = addCruiser(game, 2746, 2640, -Math.PI / 2, 420);
  const c3 = addCruiser(game, 2666, 2720, -Math.PI / 2, 420);
  c1.pursuitBias = -76;
  c2.pursuitBias = 76;
  c3.pursuitBias = 0;

  game.wanted.heat = 100;
  game.wanted.stars = 3;
  game.wanted.flash = 1.4;
  game.wanted.peakStars = 3;

  stageMission(game, 4, 'Shake the pursuit and reach Kessler Heights', { x: 2640, y: 430 }, 70);
  game.missions.dialogue = null;

  spawnCrowd(game, 2640, 1500, 14, rng);

  // Traffic on the avenue itself, in both lanes, and on the parallel streets.
  placeTraffic(game, rng, { column: 4, row: 4 }, { column: 4, row: 3 }, 0.72);
  placeTraffic(game, rng, { column: 4, row: 3 }, { column: 4, row: 2 }, 0.55);
  placeTraffic(game, rng, { column: 4, row: 2 }, { column: 4, row: 1 }, 0.35);
  placeTraffic(game, rng, { column: 4, row: 2 }, { column: 4, row: 3 }, 0.28);
  placeTraffic(game, rng, { column: 4, row: 1 }, { column: 4, row: 2 }, 0.5);
  placeTraffic(game, rng, { column: 3, row: 4 }, { column: 3, row: 3 }, 0.55);
  placeTraffic(game, rng, { column: 3, row: 2 }, { column: 3, row: 3 }, 0.2);
  placeTraffic(game, rng, { column: 3, row: 1 }, { column: 3, row: 2 }, 0.7);
  placeTraffic(game, rng, { column: 5, row: 3 }, { column: 5, row: 2 }, 0.35);
  placeTraffic(game, rng, { column: 5, row: 2 }, { column: 5, row: 1 }, 0.6);
  placeTraffic(game, rng, { column: 5, row: 1 }, { column: 5, row: 0 }, 0.25);
  placeTraffic(game, rng, { column: 3, row: 3 }, { column: 4, row: 3 }, 0.45);
  placeTraffic(game, rng, { column: 4, row: 2 }, { column: 5, row: 2 }, 0.5);
  placeTraffic(game, rng, { column: 5, row: 1 }, { column: 4, row: 1 }, 0.4);
  placeTraffic(game, rng, { column: 3, row: 1 }, { column: 4, row: 1 }, 0.65);

  const input = new ScriptedInput();
  simulateSteps(game, input, 150, () => {
    const aim = aheadOf(car, 900);
    game.autoDrive = planDrive(car, aim.x, aim.y, { cruise: 500 });
  });
  game.autoDrive = null;
  game.wanted.heat = 100;
  game.wanted.stars = 3;
  game.wanted.flash = 1.4;
  game.wanted.unseenFor = 0;
}

function stageFoot(game, rng) {
  game.clock.hour = 11.2;
  game.clock.frozen = true;
  const x = 2708;
  const y = 1210;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = -Math.PI / 2;
  game.player.aimAngle = -Math.PI / 2;
  game.player.onFoot = true;
  game.player.weapon = 'pistol';
  game.player.unlocked.pistol = true;
  game.player.ammo.pistol = 36;
  game.player.health = 92;
  snapCamera(game.camera, x, y, game.city);

  spawnCrowd(game, x, y, 62, rng);
  placeTraffic(game, rng, { column: 4, row: 2 }, { column: 4, row: 1 }, 0.55);
  placeTraffic(game, rng, { column: 4, row: 1 }, { column: 4, row: 2 }, 0.4);
  placeTraffic(game, rng, { column: 3, row: 2 }, { column: 4, row: 2 }, 0.35);
  placeTraffic(game, rng, { column: 4, row: 1 }, { column: 3, row: 1 }, 0.6);
  placeTraffic(game, rng, { column: 3, row: 1 }, { column: 3, row: 2 }, 0.5);
  placeTraffic(game, rng, { column: 4, row: 3 }, { column: 4, row: 2 }, 0.35);
  placeTraffic(game, rng, { column: 5, row: 2 }, { column: 5, row: 1 }, 0.3);
  placeTraffic(game, rng, { column: 5, row: 1 }, { column: 4, row: 1 }, 0.55);
  placeTraffic(game, rng, { column: 3, row: 2 }, { column: 3, row: 3 }, 0.2);
  placeTraffic(game, rng, { column: 4, row: 2 }, { column: 5, row: 2 }, 0.5);
  placeTraffic(game, rng, { column: 2, row: 2 }, { column: 3, row: 2 }, 0.45);
  placeTraffic(game, rng, { column: 5, row: 3 }, { column: 5, row: 2 }, 0.4);

  stageMission(game, 3, 'Get inside the Kessler Heights bank', { x: 2708, y: 940 }, 54);
  game.missions.dialogue = null;
  game.wanted.heat = 0;
  game.wanted.stars = 0;

  const input = new ScriptedInput();
  input.aimAtWorld(game, 2708, 940);
  simulateSteps(game, input, 96, (step) => {
    if (step < 40) {
      input.hold('KeyW');
      input.release('KeyS');
    } else {
      input.releaseAll();
      input.aimAtWorld(game, 2708, 940);
    }
  });
  input.releaseAll();
  input.mouse.down = false;
  game.wanted.heat = 0;
  game.wanted.stars = 0;
  game.player.health = 92;
}

function stageDrive(game, rng) {
  game.clock.hour = 19.05;
  game.clock.frozen = true;
  clearArea(game, 3400, 700, 4000, 2600);

  const car = putPlayerInCar(game, 'sports', 3800, 1180, Math.PI / 2, '#2fd0c8', 320);
  car.health = 160;

  placeTraffic(game, rng, { column: 6, row: 2 }, { column: 6, row: 3 }, 0.42);
  placeTraffic(game, rng, { column: 6, row: 3 }, { column: 6, row: 2 }, 0.55);
  placeTraffic(game, rng, { column: 6, row: 3 }, { column: 6, row: 4 }, 0.3);
  placeTraffic(game, rng, { column: 6, row: 1 }, { column: 6, row: 2 }, 0.62);
  placeTraffic(game, rng, { column: 6, row: 4 }, { column: 6, row: 3 }, 0.2);
  placeTraffic(game, rng, { column: 5, row: 2 }, { column: 6, row: 2 }, 0.5);

  stageMission(game, 4, 'Take the coast road south to the marina', { x: 3800, y: 2960 }, 70);
  game.missions.dialogue = null;
  game.wanted.heat = 0;
  game.wanted.stars = 0;

  const input = new ScriptedInput();
  simulateSteps(game, input, 190, () => {
    const aim = aheadOf(car, 800);
    game.autoDrive = planDrive(car, aim.x, aim.y, { cruise: 380 });
  });
  game.autoDrive = null;
  game.wanted.heat = 0;
  game.wanted.stars = 0;
}

function stageMissionScene(game, rng) {
  game.clock.hour = 20.7;
  game.clock.frozen = true;
  const x = 900;
  const y = 2960;
  game.player.x = x;
  game.player.y = y;
  game.player.angle = -Math.PI / 2;
  game.player.aimAngle = -Math.PI / 2;
  game.player.onFoot = true;
  game.player.health = 38;
  game.player.maxHealth = 100;
  game.player.armour = 14;
  game.player.weapon = 'smg';
  game.player.unlocked.smg = true;
  game.player.ammo.smg = 120;
  snapCamera(game.camera, x, y, game.city);

  clearArea(game, x - 220, y - 160, x + 220, y + 160);
  spawnCrowd(game, x, y - 120, 8, rng);

  const thugs = [
    game.spawnThug(x - 96, y - 150, { guard: true, health: 70 }),
    game.spawnThug(x + 104, y - 190, { guard: true, health: 70 }),
    game.spawnThug(x + 16, y - 240, { guard: true, health: 70 }),
    game.spawnThug(x - 40, y - 96, { guard: true, health: 70 }),
  ];
  for (let i = 0; i < thugs.length; i += 1) {
    thugs[i].fireCooldown = 3.2;
    thugs[i].accuracy = 0.2;
  }

  game.spawnOfficer(x + 120, y - 170);
  game.spawnOfficer(x + 160, y - 210);
  const cruiser = addCruiser(game, x, y - 300, Math.PI / 2, 120);
  cruiser.pursuitBias = 30;

  stageMission(game, 2, 'Clear the pier (2/4)', { x, y: y - 180 }, 70);
  game.missions.dialogue = {
    lines: [{ who: 'Marisol Vega', text: 'Cops are rolling in. Finish this and get to the water.' }],
    index: 0,
    portrait: 'marisol',
    speaker: 'Marisol Vega',
    text: 'Cops are rolling in. Finish this and get to the water.',
    timer: 0,
  };

  const input = new ScriptedInput();
  input.mouse.down = true;
  simulateSteps(game, input, 80, () => {
    let target = thugs[0];
    let best = Infinity;
    for (let i = 0; i < thugs.length; i += 1) {
      const thug = thugs[i];
      if (thug.health <= 0) continue;
      const d = Math.hypot(thug.x - game.player.x, thug.y - game.player.y);
      if (d < best) {
        best = d;
        target = thug;
      }
    }
    input.aimAtWorld(game, target.x, target.y);
  });
  input.mouse.down = false;
  game.player.health = Math.min(game.player.health, 34);
  game.player.armour = Math.max(0, Math.min(game.player.armour, 12));
  game.wanted.heat = 80;
  game.wanted.stars = 2;
  game.wanted.flash = 1.1;
  // End on a live shot so the frame carries a real muzzle flash and a tracer.
  game.player.fireCooldown = 0;
  game.tryFire();
}

const SCENES = {
  chase: stageChase,
  foot: stageFoot,
  drive: stageDrive,
  mission: stageMissionScene,
};

/** Stage `name` on a fresh-ish game and return the game ready to be drawn once. */
export function stageScene(name, game, seed) {
  const rng = createSeededRandom((seed ^ 0x51ce) | 0);
  const build = SCENES[name] ?? stageChase;
  game.mode = 'play';
  build(game, rng);
  game.mode = 'play';
  game.toasts.length = 0;
  game.prompt = '';
  game.effects.shakeAmount = 0;
  game.effects.shakeTime = 0;
  game.player.vehicle ? (game.player.x = game.player.vehicle.x, game.player.y = game.player.vehicle.y) : null;
  return game;
}

export const SCENE_NAMES = Object.keys(SCENES);
