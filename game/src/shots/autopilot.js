// The autopilot used to stage the screenshot scenes. It is not a separate game: it feeds the same
// input object and the same driving controls a person would, so every staged frame comes out of
// the real simulation, and the same seed always lands on the same frame.

import { angleDifference, angleTo, clamp } from '../core/geometry.js';
import { worldToScreen } from '../systems/camera-rig.js';

/** An input object with the same shape as the real keyboard, driven by a script. */
export class ScriptedInput {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.mouse = { x: 640, y: 360, down: false, clicked: false };
  }

  isDown(...codes) {
    for (let i = 0; i < codes.length; i += 1) if (this.held.has(codes[i])) return true;
    return false;
  }

  wasPressed(...codes) {
    for (let i = 0; i < codes.length; i += 1) if (this.pressed.has(codes[i])) return true;
    return false;
  }

  wantsSprint() {
    return this.held.has('Space');
  }

  wantsFire() {
    return this.mouse.down;
  }

  moveAxis() {
    let x = 0;
    let y = 0;
    if (this.held.has('KeyA')) x -= 1;
    if (this.held.has('KeyD')) x += 1;
    if (this.held.has('KeyW')) y -= 1;
    if (this.held.has('KeyS')) y += 1;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    return { x, y, magnitude: Math.min(1, length) };
  }

  hold(code) {
    this.held.add(code);
  }

  release(code) {
    this.held.delete(code);
  }

  releaseAll() {
    this.held.clear();
  }

  aimAtWorld(game, x, y) {
    const screen = worldToScreen(game.camera, x, y);
    this.mouse.x = clamp(screen.x, 0, 1280);
    this.mouse.y = clamp(screen.y, 0, 720);
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}

/** Steering that keeps a car pointed at a point, expressed as the same controls a player gives. */
export function planDrive(vehicle, targetX, targetY, options = {}) {
  const desired = angleTo(vehicle.x, vehicle.y, targetX, targetY);
  const error = angleDifference(vehicle.angle, desired);
  const distanceToTarget = Math.hypot(targetX - vehicle.x, targetY - vehicle.y);
  let throttle = Math.abs(error) > 0.9 ? 0.45 : 1;
  if (options.cruise !== undefined) {
    const speed = Math.hypot(vehicle.vx, vehicle.vy);
    if (speed > options.cruise) throttle = Math.min(throttle, 0.15);
  }
  if (options.slowRadius && distanceToTarget < options.slowRadius) throttle = Math.min(throttle, 0.3);
  return {
    throttle,
    steer: clamp(error * 2.1, -1, 1),
    brake: Boolean(options.brake),
  };
}

/** Runs the real simulation forward for a number of fixed steps. */
export function simulateSteps(game, input, steps, onStep) {
  for (let i = 0; i < steps; i += 1) {
    if (onStep) onStep(i);
    game.update(1 / 60, input);
    input.endFrame();
  }
}

/** A point a set distance along the road from a car, used to keep the autopilot driving straight. */
export function aheadOf(vehicle, distance, angleOffset = 0) {
  const angle = vehicle.angle + angleOffset;
  return { x: vehicle.x + Math.cos(angle) * distance, y: vehicle.y + Math.sin(angle) * distance };
}
