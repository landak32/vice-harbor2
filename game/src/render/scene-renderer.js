// The frame: clears the window, sets the letterboxed 1280x720 transform, paints the world in
// layers from the sea up to the sparks, adds the night light and the vignette, then the HUD and
// whichever screen is open. Camera shake moves the world, never the interface.

import { VIEW_WIDTH, VIEW_HEIGHT, visibleBounds } from '../systems/camera-rig.js';
import { lightingFor } from '../world/day-clock.js';
import {
  paintSea, paintSand, paintAsphalt, paintKerbsAndFloors, paintLanePaint,
  paintCrosswalks, paintTrafficSignals, paintPiers, paintSkidMarks,
  paintBuildings, paintProps, paintPickups, paintWorldMarker,
} from './city-painter.js';
import {
  paintVehicle, paintVehicleGlow, paintPedestrian, paintGunman, paintPlayer, paintBullet, paintParticles,
} from './actor-painter.js';
import { paintHud } from './hud-painter.js';
import {
  paintTitleOverlay, paintPauseOverlay, paintControlsOverlay, paintStatsOverlay,
  paintEndOverlay, paintMissionFailedOverlay, paintCityMapOverlay,
} from './menu-painter.js';
import { sideJobMarker } from '../systems/side-jobs.js';
import { clamp } from '../core/geometry.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, offsetX: 0, offsetY: 0 };

  function resize() {
    const width = Math.max(320, window.innerWidth);
    const height = Math.max(240, window.innerHeight);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW_WIDTH, height / VIEW_HEIGHT);
    view.offsetX = (width - VIEW_WIDTH * view.scale) / 2;
    view.offsetY = (height - VIEW_HEIGHT * view.scale) / 2;
  }

  function paintLighting(game, bounds, lighting) {
    if (lighting.darkness > 0.02) {
      ctx.fillStyle = `rgba(9, 16, 42, ${lighting.darkness * 0.44})`;
      ctx.fillRect(bounds.x - 40, bounds.y - 40, bounds.w + 80, bounds.h + 80);
    }
    if (lighting.warmth > 0.02) {
      const wash = ctx.createLinearGradient(0, bounds.y, 0, bounds.y + bounds.h);
      wash.addColorStop(0, `rgba(255, 140, 80, ${lighting.warmth * 0.16})`);
      wash.addColorStop(1, `rgba(255, 90, 60, ${lighting.warmth * 0.24})`);
      ctx.fillStyle = wash;
      ctx.fillRect(bounds.x - 40, bounds.y - 40, bounds.w + 80, bounds.h + 80);
    }
    if (!lighting.lampsOn) return;
    ctx.globalCompositeOperation = 'lighter';
    const city = game.city;
    for (let i = 0; i < city.props.length; i += 1) {
      const prop = city.props[i];
      if (prop.type !== 'lamp') continue;
      if (prop.x < bounds.x - 120 || prop.x > bounds.x + bounds.w + 120) continue;
      if (prop.y < bounds.y - 120 || prop.y > bounds.y + bounds.h + 120) continue;
      const gradient = ctx.createRadialGradient(prop.x, prop.y, 0, prop.x, prop.y, 132);
      const strength = 0.15 + lighting.darkness * 0.2;
      gradient.addColorStop(0, `rgba(255, 214, 150, ${strength})`);
      gradient.addColorStop(1, 'rgba(255, 180, 90, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(prop.x, prop.y, 132, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = 0; i < game.vehicles.length; i += 1) {
      const car = game.vehicles[i];
      if (car.x < bounds.x - 300 || car.x > bounds.x + bounds.w + 300) continue;
      if (car.y < bounds.y - 300 || car.y > bounds.y + bounds.h + 300) continue;
      paintVehicleGlow(ctx, car, game.time, lighting);
    }
    // Muzzle flashes and sparks glow.
    for (let i = 0; i < game.effects.particles.length; i += 1) {
      const p = game.effects.particles[i];
      if (p.kind !== 'flash') continue;
      const life = Math.max(0, p.life / p.maxLife);
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 62);
      gradient.addColorStop(0, `rgba(255, 226, 150, ${0.38 * life})`);
      gradient.addColorStop(1, 'rgba(255, 200, 90, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 62, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function paintVignette(game) {
    const gradient = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 300, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 800);
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

    const health = game.player.health / game.player.maxHealth;
    if (health < 0.55) {
      const pulse = 0.88 + Math.sin(game.time * 6) * 0.12;
      const intensity = clamp((1 - health / 0.6) * 1.15 * pulse, 0, 0.62);
      const red = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 200, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 700);
      red.addColorStop(0, 'rgba(170, 18, 24, 0)');
      red.addColorStop(0.55, `rgba(170, 18, 24, ${intensity * 0.45})`);
      red.addColorStop(1, `rgba(150, 10, 16, ${intensity})`);
      ctx.fillStyle = red;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
    if (game.effects.hitFlash > 0.01) {
      ctx.fillStyle = `rgba(255, 60, 60, ${game.effects.hitFlash * 0.3})`;
      ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    }
  }

  function paintWorld(game, bounds) {
    const city = game.city;
    const lighting = lightingFor(game.clock);
    paintSea(ctx, city, bounds, game.time);
    paintSand(ctx, city, bounds);
    paintAsphalt(ctx, city, bounds);
    paintKerbsAndFloors(ctx, city, bounds);
    paintLanePaint(ctx, city, bounds);
    paintCrosswalks(ctx, city, bounds);
    paintTrafficSignals(ctx, city, bounds, game.clock.seconds);
    paintPiers(ctx, city, bounds);
    paintSkidMarks(ctx, game.effects, bounds);
    paintBuildings(ctx, city, bounds, lighting);
    paintProps(ctx, city, bounds, lighting, game.time);
    paintPickups(ctx, game, bounds, game.time);

    paintWorldMarker(ctx, game.missions.marker, game.time, '#ffd166');
    paintWorldMarker(ctx, sideJobMarker(game.sideJobs), game.time, '#8ae66e');

    const cars = [];
    for (let i = 0; i < game.vehicles.length; i += 1) {
      const car = game.vehicles[i];
      if (car.x < bounds.x - 120 || car.x > bounds.x + bounds.w + 120) continue;
      if (car.y < bounds.y - 120 || car.y > bounds.y + bounds.h + 120) continue;
      cars.push(car);
    }
    cars.sort((a, b) => a.y - b.y);
    for (let i = 0; i < cars.length; i += 1) paintVehicle(ctx, cars[i], game.time, lighting);

    for (let i = 0; i < game.pedestrians.length; i += 1) {
      const ped = game.pedestrians[i];
      if (ped.x < bounds.x - 40 || ped.x > bounds.x + bounds.w + 40) continue;
      if (ped.y < bounds.y - 40 || ped.y > bounds.y + bounds.h + 40) continue;
      paintPedestrian(ctx, ped, game.time);
    }
    for (let i = 0; i < game.gunmen.length; i += 1) {
      const actor = game.gunmen[i];
      if (actor.x < bounds.x - 60 || actor.x > bounds.x + bounds.w + 60) continue;
      if (actor.y < bounds.y - 60 || actor.y > bounds.y + bounds.h + 60) continue;
      paintGunman(ctx, actor, game.time);
    }
    if (!game.player.vehicle && game.player.alive) paintPlayer(ctx, game.player, game.time, game.player.weapon);
    for (let i = 0; i < game.bullets.length; i += 1) paintBullet(ctx, game.bullets[i]);
    paintParticles(ctx, game.effects);
    paintLighting(game, bounds, lighting);
  }

  function draw(game, mouse) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05070d';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.offsetX, view.offsetY);

    const bounds = visibleBounds(game.camera, 200);
    const shake = game.effects.shakeOffset(game.time);
    ctx.save();
    ctx.translate(shake.x, shake.y);
    ctx.translate(VIEW_WIDTH / 2, VIEW_HEIGHT / 2);
    ctx.scale(game.camera.zoom, game.camera.zoom);
    ctx.translate(-game.camera.x, -game.camera.y);
    paintWorld(game, bounds);
    ctx.restore();

    paintVignette(game);
    if (game.mode !== 'title') paintHud(ctx, game, mouse);

    if (game.mode === 'title') paintTitleOverlay(ctx, game, game.time, game.menuSelection, game.hasSaveFile);
    else if (game.mode === 'controls') paintControlsOverlay(ctx, game);
    else if (game.mode === 'paused') {
      if (game.pausePanel === 'controls') paintControlsOverlay(ctx, game);
      else if (game.pausePanel === 'stats') paintStatsOverlay(ctx, game);
      else paintPauseOverlay(ctx, game, game.menuSelection);
    } else if (game.mode === 'dead' || game.mode === 'busted') paintEndOverlay(ctx, game, game.mode, game.endCost);
    else if (game.mode === 'failed') paintMissionFailedOverlay(ctx, game);
    else if (game.showCityMap) paintCityMapOverlay(ctx, game);
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, resize, view, context: ctx };
}
