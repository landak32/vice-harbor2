// The city clock and its light. Vice Harbor runs a fast day: one real minute is one game hour by
// default, so a session drifts from noon into a neon night. This module only says how dark it is
// and what colour the light is; the renderer applies it.

import { clamp, smoothstep } from '../core/geometry.js';

export const MINUTES_PER_SECOND = 60;

export function createDayClock(hour = 10, minute = 0) {
  return { hour: hour + minute / 60, day: 0, seconds: 0, frozen: false };
}

export function advanceClock(clock, dt) {
  if (clock.frozen) return;
  clock.seconds += dt;
  clock.hour += (dt * MINUTES_PER_SECOND) / 3600;
  while (clock.hour >= 24) {
    clock.hour -= 24;
    clock.day += 1;
  }
}

export function timeLabel(clock) {
  const hours = Math.floor(clock.hour);
  const minutes = Math.floor((clock.hour - hours) * 60);
  const suffix = hours < 12 ? 'AM' : 'PM';
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, '0')} ${suffix}`;
}

/**
 * How the sky treats the city right now: `darkness` 0 (noon) to 1 (deep night), `warmth` for the
 * sunset and dawn bands, and the tint colour the renderer multiplies over the scene.
 */
export function lightingFor(clock) {
  const hour = clock.hour;
  const night = smoothstep(20.4, 22.2, hour) + (1 - smoothstep(4.4, 6.2, hour));
  const darkness = clamp(night, 0, 1);
  const dawn = Math.max(0, 1 - Math.abs(hour - 6.1) / 1.6);
  const dusk = Math.max(0, 1 - Math.abs(hour - 19.1) / 1.7);
  const warmth = clamp(Math.max(dawn, dusk) * 0.9, 0, 1);
  let tint = 'rgba(8, 14, 38, 0.62)';
  if (darkness < 0.45 && warmth > 0.35) tint = 'rgba(255, 128, 74, 0.28)';
  else if (darkness < 0.2) tint = 'rgba(255, 255, 255, 0.0)';
  return {
    darkness,
    warmth,
    tint,
    sunAngle: ((hour - 6) / 12) * Math.PI,
    isNight: darkness > 0.5,
    lampsOn: darkness > 0.25 || warmth > 0.5,
  };
}

export function setHour(clock, hour) {
  clock.hour = clamp(hour, 0, 23.999);
}

export function labelForHour(clock) {
  const hour = clock.hour;
  if (hour < 5) return 'Late night';
  if (hour < 8) return 'Early morning';
  if (hour < 12) return 'Morning';
  if (hour < 16) return 'Afternoon';
  if (hour < 19) return 'Golden hour';
  if (hour < 21) return 'Dusk';
  return 'Night';
}
