// The camera: it trails the player, leans ahead in the direction of travel, pulls back a little
// at speed, shakes on impacts and never shows anything past the edge of the city.

import { clamp, damp, distance } from '../core/geometry.js';

export const VIEW_WIDTH = 1280;
export const VIEW_HEIGHT = 720;

export function createCamera(x, y) {
  return { x, y, leadX: 0, leadY: 0, zoom: 1, shakeX: 0, shakeY: 0 };
}

export function updateCamera(camera, targetX, targetY, velocityX, velocityY, dt, world) {
  const speed = Math.hypot(velocityX, velocityY);
  const leadScale = clamp(speed / 500, 0, 1) * 0.34;
  const wantedLeadX = clamp(velocityX * leadScale * 0.4, -120, 120);
  const wantedLeadY = clamp(velocityY * leadScale * 0.4, -96, 96);
  camera.leadX = damp(camera.leadX, wantedLeadX, 3.2, dt);
  camera.leadY = damp(camera.leadY, wantedLeadY, 3.2, dt);
  const followX = targetX + camera.leadX;
  const followY = targetY + camera.leadY;
  camera.x = damp(camera.x, followX, 6.5, dt);
  camera.y = damp(camera.y, followY, 6.5, dt);
  camera.zoom = damp(camera.zoom, 1 + clamp(speed / 2600, 0, 0.06), 2, dt);
  clampCamera(camera, world);
}

export function clampCamera(camera, world) {
  const halfW = VIEW_WIDTH / 2;
  const halfH = VIEW_HEIGHT / 2;
  camera.x = clamp(camera.x, halfW, Math.max(halfW, world.width - halfW));
  camera.y = clamp(camera.y, halfH, Math.max(halfH, world.height - halfH));
}

export function snapCamera(camera, x, y, world) {
  camera.x = x;
  camera.y = y;
  camera.leadX = 0;
  camera.leadY = 0;
  clampCamera(camera, world);
}

export function worldToScreen(camera, x, y) {
  return {
    x: (x - camera.x) * camera.zoom + VIEW_WIDTH / 2,
    y: (y - camera.y) * camera.zoom + VIEW_HEIGHT / 2,
  };
}

export function screenToWorld(camera, x, y) {
  return {
    x: (x - VIEW_WIDTH / 2) / camera.zoom + camera.x,
    y: (y - VIEW_HEIGHT / 2) / camera.zoom + camera.y,
  };
}

/** The rectangle of the world the camera can see, padded so nothing pops at the edges. */
export function visibleBounds(camera, pad = 120) {
  const halfW = VIEW_WIDTH / 2 / camera.zoom + pad;
  const halfH = VIEW_HEIGHT / 2 / camera.zoom + pad;
  return { x: camera.x - halfW, y: camera.y - halfH, w: halfW * 2, h: halfH * 2 };
}

export function isVisible(bounds, x, y, radius = 0) {
  return x + radius > bounds.x && x - radius < bounds.x + bounds.w && y + radius > bounds.y && y - radius < bounds.y + bounds.h;
}

export function cameraDistance(camera, x, y) {
  return distance(camera.x, camera.y, x, y);
}
