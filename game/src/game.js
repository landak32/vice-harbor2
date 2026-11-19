// The game object: it owns the city, the player, every moving thing, the clock, the wanted level,
// the job board and the score, and it runs one fixed simulation step in a fixed order. Menus,
// input mapping and rendering live elsewhere; this file is the world and its rules.

import { createSeededRandom } from './core/seeded-random.js';
import { buildCity } from './world/city-builder.js';
import { advanceClock, createDayClock } from './world/day-clock.js';
import { distance, clamp } from './core/geometry.js';
import { Soundscape } from './core/soundscape.js';
import {
  createPlayer, updatePlayerOnFoot, updatePlayerAim, canFire, spendAmmo, switchWeapon,
  damagePlayer, healPlayer, addArmour, nearestCar, exitPointFor, WEAPONS, playerMuzzle,
} from './entities/on-foot-player.js';
import { updateVehiclePhysics, createVehicle, VEHICLE_TYPES } from './entities/vehicle-physics.js';
import { populateTraffic, updateTraffic, startleNearbyTraffic, spawnTrafficCar, randomLanePlacement } from './entities/traffic-drivers.js';
import { populatePedestrians, updatePedestrians, knockDownPedestrian, killPedestrian } from './entities/pedestrians.js';
import { createGunman, updateGunmen, deployOfficersFrom } from './entities/armed-npcs.js';
import { updatePoliceResponse, spawnCruiser } from './entities/police-response.js';
import { updateBullets, createBullet } from './entities/projectiles.js';
import { populatePickups, updatePickups, dropCash } from './entities/pickups.js';
import { Effects } from './systems/effects.js';
import { createCamera, updateCamera, snapCamera, screenToWorld } from './systems/camera-rig.js';
import { resolveVehicleWorld, resolveVehiclePairs, resolvePersonWorld, checkPeopleAgainstCars, clampActorToWorld, damageVehicle } from './systems/collision-response.js';
import { createWantedLevel, addHeat, clearWanted, updateWanted } from './systems/wanted-level.js';
import { createMissionDirector, updateMissions, startMission, retryMission, completeMission, failMission, advanceDialogue, sayLine } from './systems/mission-story.js';
import { createSideJobBoard, updateSideJobs, startTaxiFare, startCourierRun, cancelSideJob } from './systems/side-jobs.js';
import { writeSave, readSave, applySave, hasSave } from './systems/save-file.js';

const SPAWN = { x: 962, y: 2186 };

export class Game {
  constructor(seed) {
    this.seed = seed;
    this.rng = createSeededRandom(seed);
    this.city = buildCity(seed);
    this.player = createPlayer(SPAWN.x, SPAWN.y);
    this.vehicles = [];
    this.pedestrians = [];
    this.gunmen = [];
    this.bullets = [];
    this.pickups = [];
    this.effects = new Effects(createSeededRandom(seed ^ 0x7f4a7c15));
    this.sound = new Soundscape();
    this.camera = createCamera(SPAWN.x, SPAWN.y);
    this.clock = createDayClock(17, 20);
    this.wanted = createWantedLevel();
    this.missions = createMissionDirector();
    this.sideJobs = createSideJobBoard();
    this.stats = {
      missions: 0, sideJobs: 0, kills: 0, carsStolen: 0,
      distanceDriven: 0, shotsFired: 0, officersDown: 0, policeCars: 0, pedestriansDown: 0,
    };
    this.money = 500;
    this.time = 0;
    this.mode = 'title';
    this.toasts = [];
    this.prompt = '';
    this.hasSaveFile = hasSave();
    this.menuSelection = 0;
    this.pausePanel = 'main';
    this.endCost = 0;
    this.showCityMap = false;
    this.policeSpawnTimer = 0;
    this.officerSpawnTimer = 0;
    this.crimeFlash = 0;
    this.demoTarget = null;
    this.autoDrive = null;

    populateTraffic(this, 34);
    populatePedestrians(this);
    populatePickups(this);
    this.parkCars(16);
    snapCamera(this.camera, SPAWN.x, SPAWN.y, this.city);
  }

  /** Cars left at the kerb for the taking. */
  parkCars(count) {
    const rng = this.rng;
    for (let i = 0; i < count; i += 1) {
      const placement = randomLanePlacement(this.city, rng);
      const car = spawnTrafficCar(this.city, rng, placement, { role: 'parked' });
      car.driver = null;
      car.aiKind = null;
      car.vx = 0;
      car.vy = 0;
      car.lightsOn = false;
      car.cruise = 0;
      this.vehicles.push(car);
    }
  }

  // ---------------------------------------------------------------- economy and messages

  earn(amount, source = '') {
    this.money += Math.max(0, Math.round(amount));
    this.sound.cash();
  }

  spend(amount) {
    this.money = Math.max(0, this.money - Math.max(0, Math.round(amount)));
  }

  toast(text, color = '#ffd166') {
    this.toasts.unshift({ text, life: 3.6, color });
    if (this.toasts.length > 4) this.toasts.pop();
  }

  addHeat(amount, reason = '') {
    addHeat(this.wanted, amount, reason);
    this.crimeFlash = 0.5;
  }

  saveGame() {
    if (writeSave(this)) {
      this.hasSaveFile = true;
      this.toast('Progress saved');
    }
  }

  loadGame() {
    const data = readSave();
    if (!data) return false;
    applySave(this, data);
    snapCamera(this.camera, this.player.x, this.player.y, this.city);
    this.toast('Welcome back to Vice Harbor');
    return true;
  }

  newGame() {
    this.player = createPlayer(SPAWN.x, SPAWN.y);
    this.player.x = SPAWN.x;
    this.player.y = SPAWN.y;
    this.money = 500;
    this.missions.index = 0;
    this.missions.status = 'idle';
    this.missions.dialogue = null;
    this.missions.marker = null;
    this.missions.objective = '';
    this.sideJobs.active = null;
    this.stats = {
      missions: 0, sideJobs: 0, kills: 0, carsStolen: 0,
      distanceDriven: 0, shotsFired: 0, officersDown: 0, policeCars: 0, pedestriansDown: 0,
    };
    clearWanted(this.wanted);
    this.clock = createDayClock(17, 20);
    snapCamera(this.camera, SPAWN.x, SPAWN.y, this.city);
    this.mode = 'play';
    this.toast('Meet Marisol Vega at the garage');
  }

  // ---------------------------------------------------------------- damage and consequences

  hurtPlayer(amount) {
    if (!this.player.alive) return;
    this.effects.hitFlash = 1;
    const fatal = damagePlayer(this.player, amount);
    if (fatal) this.onPlayerDeath();
  }

  onPlayerDeath() {
    if (this.mode !== 'play') return;
    this.player.alive = false;
    this.mode = 'dead';
    this.endCost = 250 + this.wanted.stars * 60;
    this.spend(this.endCost);
    clearWanted(this.wanted);
    this.sound.impact(1);
    this.effects.shake(10);
  }

  onBusted() {
    if (this.mode !== 'play') return;
    this.mode = 'busted';
    this.endCost = 120 + this.wanted.stars * 50;
    this.spend(this.endCost);
    clearWanted(this.wanted);
    this.sound.blip(false);
  }

  respawnPlayerAt(x, y, options = {}) {
    const player = this.player;
    player.alive = true;
    player.health = options.health ?? 100;
    player.armour = 0;
    player.x = x;
    player.y = y;
    player.vx = 0;
    player.vy = 0;
    player.vehicle = null;
    player.onFoot = true;
    player.fireCooldown = 0;
    if (options.cost) this.spend(options.cost);
    clearWanted(this.wanted);
    this.bullets.length = 0;
    for (let i = this.gunmen.length - 1; i >= 0; i -= 1) {
      if (this.gunmen[i].faction === 'cop') this.gunmen.splice(i, 1);
    }
    snapCamera(this.camera, x, y, this.city);
  }

  respawnAfterDeath() {
    const hospital = this.city.landmarks.hospital;
    this.respawnPlayerAt(hospital.x, hospital.y + 60);
    this.mode = 'play';
    this.missions.status = 'idle';
    this.missions.dialogue = null;
    this.toast('Vidal General stitched you up');
  }

  respawnAfterArrest() {
    const station = this.city.landmarks.station;
    this.respawnPlayerAt(station.x + 60, station.y + 60);
    this.mode = 'play';
    this.missions.status = 'idle';
    this.missions.dialogue = null;
    this.toast('Released on bail at Harbor PD');
  }

  onOfficerDown(actor) {
    this.stats.officersDown += 1;
    this.addHeat(55, 'officer down');
    dropCash(this, actor.x, actor.y, 40);
  }

  onThugDown(actor) {
    if (actor.dropsLoot) dropCash(this, actor.x, actor.y, 60 + this.rng.int(0, 60));
  }

  killPedestrian(ped) {
    killPedestrian(ped);
    this.stats.pedestriansDown += 1;
    this.addHeat(18, 'assault');
  }

  knockPedestrian(ped) {
    knockDownPedestrian(ped);
    this.stats.pedestriansDown += 1;
    this.addHeat(10, 'assault');
  }

  spawnThug(x, y, options = {}) {
    const actor = createGunman(options.boss ? 'boss' : 'thug', x, y, {
      guard: options.guard ?? false,
      health: options.health,
      accuracy: options.boss ? 0.08 : 0.15,
      damage: options.boss ? 16 : 11,
    });
    actor.faction = options.boss ? 'boss' : 'thug';
    this.gunmen.push(actor);
    return actor;
  }

  spawnOfficer(x, y) {
    const actor = createGunman('cop', x, y, { health: 75 });
    this.gunmen.push(actor);
    return actor;
  }

  onHonk(car) {
    this.sound.horn();
    this.effects.dust(car.x, car.y, 2);
  }

  // ---------------------------------------------------------------- the step

  update(dt, input) {
    this.time += dt;
    this.crimeFlash = Math.max(0, this.crimeFlash - dt);

    if (this.mode === 'play') {
      this.stepPlay(dt, input);
    } else if (this.mode === 'title') {
      this.stepAmbient(dt);
      this.missions.marker = null;
    } else {
      this.effects.update(dt);
    }

    this.updateToasts(dt);
    this.sound.tickMusic(clamp(this.wanted.stars / 5 + (this.player.vehicle ? 0.18 : 0), 0, 1));
    this.sound.setSiren(this.wanted.stars > 0 && this.policeNearPlayer(900));
    if (!this.player.vehicle) this.sound.updateEngine(0, 0, false);
  }

  policeNearPlayer(radius) {
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const car = this.vehicles[i];
      if (car.role === 'police' && distance(car.x, car.y, this.player.x, this.player.y) < radius) return true;
    }
    return false;
  }

  updateToasts(dt) {
    for (let i = this.toasts.length - 1; i >= 0; i -= 1) {
      this.toasts[i].life -= dt;
      if (this.toasts[i].life <= 0) this.toasts.splice(i, 1);
    }
  }

  /** Traffic and crowds keep living behind the title screen. */
  stepAmbient(dt) {
    advanceClock(this.clock, dt);
    updateTraffic(this, dt);
    updatePedestrians(this, dt);
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const car = this.vehicles[i];
      if (car.driver === 'ai') resolveVehicleWorld(this, car);
    }
    resolveVehiclePairs(this);
    this.effects.update(dt);
    const scenic = { x: 2360 + Math.sin(this.time * 0.06) * 240, y: 900 + Math.cos(this.time * 0.05) * 160 };
    this.camera.x = scenic.x;
    this.camera.y = scenic.y;
  }

  stepPlay(dt, input) {
    advanceClock(this.clock, dt);
    this.handlePlayer(dt, input);
    updateTraffic(this, dt);
    updatePoliceResponse(this, dt);
    const fallen = updateGunmen(this, dt);
    for (let i = 0; i < fallen.length; i += 1) this.effects.shake(1.5);
    updatePedestrians(this, dt);

    for (let i = 0; i < this.vehicles.length; i += 1) {
      const car = this.vehicles[i];
      if (car.driver !== 'player') resolveVehicleWorld(this, car);
    }
    resolveVehiclePairs(this);
    if (this.player.onFoot) resolvePersonWorld(this, this.player, 10);
    clampActorToWorld(this.city, this.player, 14);
    checkPeopleAgainstCars(this);

    updateBullets(this, dt);
    updatePickups(this, dt);
    updateMissions(this, dt);
    updateSideJobs(this, dt);
    updateWanted(this, dt);
    this.checkArrest(dt);
    this.updatePrompt();

    const target = this.player.vehicle ?? this.player;
    updateCamera(this.camera, target.x, target.y, target.vx, target.vy, dt, this.city);
    this.effects.update(dt);

    // Smoke pours from a wrecked engine.
    if (this.player.vehicle && this.player.vehicle.wrecked) {
      this.player.vehicle.smokeTimer -= dt;
      if (this.player.vehicle.smokeTimer <= 0) {
        this.player.vehicle.smokeTimer = 0.12;
        this.effects.smoke(this.player.vehicle.x, this.player.vehicle.y, 2, 0.8);
      }
    }
    for (let i = 0; i < this.vehicles.length; i += 1) {
      const car = this.vehicles[i];
      if (!car.wrecked) continue;
      car.smokeTimer -= dt;
      if (car.smokeTimer <= 0) {
        car.smokeTimer = 0.3;
        this.effects.smoke(car.x, car.y, 1, 0.7);
      }
    }
  }

  checkArrest(dt) {
    if (this.mode !== 'play' || !this.player.alive) return;
    if (this.player.vehicle) return;
    if (this.wanted.stars <= 0) return;
    for (let i = 0; i < this.gunmen.length; i += 1) {
      const actor = this.gunmen[i];
      if (actor.faction !== 'cop' || actor.health <= 0) continue;
      if (distance(actor.x, actor.y, this.player.x, this.player.y) < 44) {
        this.onBusted();
        return;
      }
    }
  }

  updatePrompt() {
    const player = this.player;
    if (player.vehicle) {
      this.prompt = this.sideJobs.prompt || '';
      return;
    }
    const car = nearestCar(this.vehicles, player.x, player.y, 100);
    if (car) {
      this.prompt = `E  ·  take the ${car.label}`;
      return;
    }
    this.prompt = this.sideJobs.prompt || '';
  }

  // ---------------------------------------------------------------- the player

  handlePlayer(dt, input) {
    const player = this.player;
    player.fireCooldown = Math.max(0, player.fireCooldown - dt);
    player.meleeTimer = Math.max(0, player.meleeTimer - dt);
    player.muzzleTimer = Math.max(0, player.muzzleTimer - dt);
    player.enterCooldown = Math.max(0, player.enterCooldown - dt);
    if (player.hurtTimer > 0) player.hurtTimer = Math.max(0, player.hurtTimer - dt);

    if (input.wasPressed('Escape')) return;

    if (player.vehicle) {
      this.driveVehicle(dt, input);
      return;
    }

    const intent = input.moveAxis();
    const sprint = input.wantsSprint();
    const stepped = updatePlayerOnFoot(player, intent, sprint, dt);
    if (stepped) this.sound.footstep();

    const aim = screenToWorld(this.camera, input.mouse.x, input.mouse.y);
    updatePlayerAim(player, aim.x, aim.y, dt);

    if (input.wasPressed('KeyE') && player.enterCooldown <= 0) {
      const car = nearestCar(this.vehicles, player.x, player.y, 100);
      if (car) this.enterVehicle(car);
    }
    if (input.wasPressed('Digit1')) switchWeapon(player, 'fists');
    if (input.wasPressed('Digit2')) switchWeapon(player, 'pistol');
    if (input.wasPressed('Digit3')) switchWeapon(player, 'smg');
    if (input.wasPressed('KeyT')) startTaxiFare(this);
    if (input.wasPressed('KeyC')) startCourierRun(this);

    if (input.wantsFire()) this.tryFire();

    if (this.missions.dialogue && input.wasPressed('KeyE', 'Enter', 'Space')) advanceDialogue(this.missions);
  }

  enterVehicle(car) {
    const player = this.player;
    if (car.driver === 'player') return;
    if (car.role === 'police') this.addHeat(30, 'stealing a cruiser');
    if (car.driver === 'ai' && car.aiKind === 'pursuit') this.addHeat(20, 'stealing a cruiser');
    car.driver = 'player';
    car.aiKind = null;
    car.ai = null;
    car.sirenOn = false;
    car.lightsOn = true;
    car.stolen = true;
    player.vehicle = car;
    player.onFoot = false;
    player.vx = 0;
    player.vy = 0;
    player.enterCooldown = 0.4;
    this.stats.carsStolen += 1;
    if (car.role !== 'police') this.addHeat(24, 'grand theft auto');
    this.toast(`Stolen: ${car.label}`);
    this.sound.blip(true);
    this.sound.startEngine();
  }

  exitVehicle() {
    const player = this.player;
    const car = player.vehicle;
    if (!car) return;
    const spot = exitPointFor(car);
    car.driver = null;
    car.vx *= 0.2;
    car.vy *= 0.2;
    player.vehicle = null;
    player.onFoot = true;
    player.x = spot.x;
    player.y = spot.y;
    player.enterCooldown = 0.45;
    this.sound.stopEngine();
    this.sound.updateEngine(0, 0, false);
  }

  driveVehicle(dt, input) {
    const player = this.player;
    const car = player.vehicle;
    const auto = this.autoDrive;
    const throttle = auto ? auto.throttle : (input.isDown('KeyW', 'ArrowUp') ? 1 : 0) - (input.isDown('KeyS', 'ArrowDown') ? 1 : 0);
    const steer = auto ? auto.steer : (input.isDown('KeyD', 'ArrowRight') ? 1 : 0) - (input.isDown('KeyA', 'ArrowLeft') ? 1 : 0);
    const brake = auto ? Boolean(auto.brake) : input.isDown('Space');
    car.steerAngle = steer * 0.5;
    const slip = updateVehiclePhysics(car, { throttle, steer, brake }, dt);
    const impact = resolveVehicleWorld(this, car);
    if (impact > 0) this.effects.shake(Math.min(8, impact / 70));
    const speed = Math.hypot(car.vx, car.vy);
    this.stats.distanceDriven += speed * dt;
    this.sound.updateEngine(speed / car.spec.maxSpeed, throttle, true);
    if (slip > 60 || (brake && speed > 210)) {
      car.skidTimer -= dt;
      if (car.skidTimer <= 0) {
        car.skidTimer = 0.03;
        const rear = car.angle + Math.PI;
        const offset = car.spec.h * 0.32;
        this.effects.skid(
          car.x + Math.cos(rear) * car.spec.w * 0.28 + Math.cos(car.angle + Math.PI / 2) * offset,
          car.y + Math.sin(rear) * car.spec.w * 0.28 + Math.sin(car.angle + Math.PI / 2) * offset,
          car.angle,
          Math.min(1, slip / 200),
        );
      }
    }
    player.x = car.x;
    player.y = car.y;
    if (input.wasPressed('KeyE') && player.enterCooldown <= 0) this.exitVehicle();
    if (car.wrecked && car.health <= 0 && speed < 6) {
      // A dead engine: the car can still be left, but never driven again.
      car.engineDead = true;
    }
    if (input.wasPressed('KeyT')) startTaxiFare(this);
  }

  tryFire() {
    const player = this.player;
    if (!canFire(player)) return;
    const weapon = WEAPONS[player.weapon];
    const aim = player.aimAngle;
    if (weapon.id === 'fists') {
      player.meleeTimer = weapon.rate;
      this.sound.punch();
      const targetX = player.x + Math.cos(aim) * 34;
      const targetY = player.y + Math.sin(aim) * 34;
      for (let i = 0; i < this.gunmen.length; i += 1) {
        const actor = this.gunmen[i];
        if (actor.health <= 0) continue;
        if (distance(targetX, targetY, actor.x, actor.y) < 34) {
          actor.health -= weapon.damage;
          actor.hurtFlash = 1;
          this.effects.spark(actor.x, actor.y, 5, '#ffe0a0');
          if (actor.health <= 0 && actor.faction === 'cop') this.onOfficerDown(actor);
          return;
        }
      }
      for (let i = 0; i < this.pedestrians.length; i += 1) {
        const ped = this.pedestrians[i];
        if (ped.state === 'down' || ped.state === 'dead') continue;
        if (distance(targetX, targetY, ped.x, ped.y) < 34) {
          ped.health -= weapon.damage;
          if (ped.health <= 0) this.killPedestrian(ped);
          else {
            ped.state = 'flee';
            ped.fleeTimer = 5;
            ped.threatX = player.x;
            ped.threatY = player.y;
          }
          this.addHeat(8, 'assault');
          return;
        }
      }
      return;
    }

    const muzzle = playerMuzzle(player);
    const shots = weapon.id === 'smg' ? 1 : 1;
    for (let s = 0; s < shots; s += 1) {
      const spread = this.rng.range(-weapon.spread, weapon.spread);
      this.bullets.push(createBullet(muzzle.x, muzzle.y, aim + spread, weapon.speed, weapon.damage, 'player'));
    }
    spendAmmo(player);
    player.fireCooldown = weapon.rate;
    player.muzzleTimer = 0.09;
    this.stats.shotsFired += 1;
    this.sound.gunshot(weapon.id);
    this.effects.muzzle(muzzle.x, muzzle.y, aim);
    this.effects.shake(weapon.id === 'smg' ? 1.2 : 1.8);
    startleNearbyTraffic(this, player.x, player.y, 700);
    this.addHeat(weapon.id === 'smg' ? 5 : 4, 'shooting');
  }
}
