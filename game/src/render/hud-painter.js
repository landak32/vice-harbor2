// The heads-up display: a minimap drawn from the real city data, health and armour bars, the money
// counter, the wanted stars, the current weapon and its ammo, the one-line objective, the job
// dialogue with its portrait, and the little toasts that announce what just happened.

import {
  fillRoundRect, roundRectPath, strokeRoundRect, text, drawStar, diamondPath,
  hexToRgba, fitText, MONO_STACK, FONT_STACK,
} from './canvas-kit.js';
import { paintPortrait } from './portrait-painter.js';
import { CONTACTS } from '../systems/mission-story.js';
import { formatMoney, clamp } from '../core/geometry.js';
import { VIEW_WIDTH, VIEW_HEIGHT } from '../systems/camera-rig.js';
import { wantedLabel } from '../systems/wanted-level.js';
import { sideJobObjective, sideJobMarker } from '../systems/side-jobs.js';

const MAP_SIZE = 224;
const MAP_X = 22;
const MAP_Y = VIEW_HEIGHT - MAP_SIZE - 22;
const MAP_RANGE = 760;

function paintMinimap(ctx, game) {
  const player = game.player;
  const size = MAP_SIZE;
  ctx.save();
  roundRectPath(ctx, MAP_X, MAP_Y, size, size, 16);
  ctx.fillStyle = '#080c14';
  ctx.fill();
  ctx.clip();

  const scale = size / (MAP_RANGE * 2);
  ctx.translate(MAP_X + size / 2, MAP_Y + size / 2);
  ctx.scale(scale, scale);
  ctx.translate(-player.x, -player.y);

  const city = game.city;
  // Water and sand.
  for (let i = 0; i < city.water.length; i += 1) {
    ctx.fillStyle = '#123a55';
    ctx.fillRect(city.water[i].x, city.water[i].y, city.water[i].w, city.water[i].h);
  }
  for (let i = 0; i < city.sand.length; i += 1) {
    ctx.fillStyle = '#b9a173';
    ctx.fillRect(city.sand[i].x, city.sand[i].y, city.sand[i].w, city.sand[i].h);
  }
  // Blocks.
  for (let i = 0; i < city.blocks.length; i += 1) {
    const block = city.blocks[i];
    ctx.fillStyle = block.district.id === 'park' ? '#2c4a33' : '#1b212b';
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
  // Roads.
  ctx.strokeStyle = '#39414d';
  ctx.lineWidth = city.roadHalf * 2;
  ctx.lineCap = 'butt';
  for (let i = 0; i < city.cols.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(city.cols[i], 0);
    ctx.lineTo(city.cols[i], city.height);
    ctx.stroke();
  }
  for (let i = 0; i < city.rows.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, city.rows[i]);
    ctx.lineTo(city.width, city.rows[i]);
    ctx.stroke();
  }
  // Big roofs read as city blocks at this scale.
  ctx.fillStyle = 'rgba(90, 100, 118, 0.55)';
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (b.w < 70) continue;
    ctx.fillRect(b.x, b.y, b.w, b.h);
  }

  // Job markers.
  const marker = game.missions.marker;
  if (marker) {
    ctx.fillStyle = 'rgba(255, 209, 102, 0.9)';
    diamondPath(ctx, marker.x, marker.y, 46);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 12;
    ctx.stroke();
  }
  const sideMarker = sideJobMarker(game.sideJobs);
  if (sideMarker) {
    ctx.fillStyle = '#8ae66e';
    diamondPath(ctx, sideMarker.x, sideMarker.y, 34);
    ctx.fill();
  }
  // Police.
  const flash = Math.floor(game.time * 6) % 2 === 0;
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    if (car.role !== 'police') continue;
    ctx.fillStyle = flash ? '#ff4455' : '#4f7bff';
    ctx.beginPath();
    ctx.arc(car.x, car.y, 34, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < game.gunmen.length; i += 1) {
    const actor = game.gunmen[i];
    if (actor.faction !== 'cop' || actor.health <= 0) continue;
    ctx.fillStyle = flash ? '#ff8899' : '#88aaff';
    ctx.beginPath();
    ctx.arc(actor.x, actor.y, 24, 0, Math.PI * 2);
    ctx.fill();
  }
  // Other cars as small dots.
  ctx.fillStyle = 'rgba(190, 200, 215, 0.5)';
  for (let i = 0; i < game.vehicles.length; i += 1) {
    const car = game.vehicles[i];
    if (car.role === 'police') continue;
    ctx.fillRect(car.x - 18, car.y - 18, 36, 36);
  }
  ctx.restore();

  // Player arrow, drawn upright at the centre of the map.
  ctx.save();
  ctx.translate(MAP_X + size / 2, MAP_Y + size / 2);
  ctx.rotate(player.onFoot ? player.angle : (player.vehicle ? player.vehicle.angle : player.angle));
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-7, -7);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 7);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // Frame, compass and the ring around the map.
  strokeRoundRect(ctx, MAP_X, MAP_Y, size, size, 16, 'rgba(255,255,255,0.28)', 2);
  ctx.fillStyle = 'rgba(8, 12, 20, 0.78)';
  fillRoundRect(ctx, MAP_X + size / 2 - 11, MAP_Y - 9, 22, 18, 6, 'rgba(8, 12, 20, 0.85)');
  text(ctx, 'N', MAP_X + size / 2, MAP_Y + 1, { size: 12, weight: 800, color: '#ffd166', align: 'center' });
}

function paintBars(ctx, game) {
  const player = game.player;
  const width = MAP_SIZE;
  const x = MAP_X;
  const healthY = MAP_Y - 34;
  const armourY = MAP_Y - 18;

  ctx.fillStyle = 'rgba(6, 9, 15, 0.72)';
  fillRoundRect(ctx, x - 2, healthY - 3, width + 4, 15, 6, 'rgba(6, 9, 15, 0.72)');
  const healthRatio = clamp(player.health / player.maxHealth, 0, 1);
  const healthColor = healthRatio > 0.55 ? '#4ade80' : healthRatio > 0.25 ? '#facc15' : '#ef4444';
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(x + 2, healthY, width - 4, 9);
  ctx.fillStyle = healthColor;
  ctx.fillRect(x + 2, healthY, (width - 4) * healthRatio, 9);
  if (player.armour > 0) {
    fillRoundRect(ctx, x - 2, armourY - 2, width + 4, 11, 5, 'rgba(6, 9, 15, 0.72)');
    ctx.fillStyle = '#57b8ff';
    ctx.fillRect(x + 2, armourY, (width - 4) * clamp(player.armour / 100, 0, 1), 6);
  }
  text(ctx, `${Math.ceil(player.health)}`, x + width + 8, healthY + 9, { size: 11, weight: 700, color: '#e8eef8', font: MONO_STACK });
}

function paintWantedStars(ctx, game) {
  const stars = game.wanted.stars;
  const flashOn = game.wanted.flash > 0 && Math.floor(game.time * 6) % 2 === 0;
  const baseX = VIEW_WIDTH - 28;
  const y = 76;
  for (let i = 0; i < 5; i += 1) {
    const x = baseX - (4 - i) * 26;
    const filled = i < stars;
    const alpha = filled ? (flashOn ? 1 : 0.92) : 0.18;
    ctx.globalAlpha = alpha;
    drawStar(ctx, x, y, 11, 5, filled ? '#ffd166' : '#6b7280');
    ctx.globalAlpha = 1;
    if (filled) {
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  if (stars > 0) {
    text(ctx, wantedLabel(stars), baseX, y + 24, { size: 10, weight: 700, color: 'rgba(255, 209, 102, 0.8)', align: 'right', letterSpacing: 1.5 });
  }
}

function paintMoney(ctx, game) {
  const x = VIEW_WIDTH - 28;
  text(ctx, formatMoney(game.money), x, 46, {
    size: 30, weight: 800, color: '#eaf2ff', align: 'right', font: MONO_STACK,
    shadow: { color: 'rgba(0,0,0,0.7)', blur: 8 },
  });
}

function paintObjective(ctx, game) {
  const mission = game.missions;
  const side = sideJobObjective(game.sideJobs);
  const line = side || mission.objective;
  if (!line) return;
  const panelW = 430;
  const panelH = mission.dialogue ? 46 : 62;
  fillRoundRect(ctx, 22, 22, panelW, panelH, 12, 'rgba(6, 10, 18, 0.72)');
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(22, 22, 4, panelH);
  const title = side ? (game.sideJobs.active?.kind === 'taxi' ? 'Taxi fare' : 'Courier run') : mission.missions[mission.index]?.title ?? 'Vice Harbor';
  text(ctx, title.toUpperCase(), 38, 44, { size: 11, weight: 800, color: '#ffd166', letterSpacing: 2 });
  text(ctx, fitText(ctx, line, panelW - 34, 14, 500), 38, 64, { size: 14, weight: 500, color: '#e6edf8' });
}

function paintWeapon(ctx, game) {
  const player = game.player;
  const weapon = player.weapon;
  const names = { fists: 'Fists', pistol: 'Pistol', smg: 'SMG' };
  const ammo = weapon === 'fists' ? '—' : String(player.ammo[weapon] ?? 0);
  const x = VIEW_WIDTH - 26;
  const y = VIEW_HEIGHT - 26;
  fillRoundRect(ctx, x - 190, y - 58, 190, 58, 12, 'rgba(6, 10, 18, 0.72)');
  text(ctx, names[weapon].toUpperCase(), x - 14, y - 34, { size: 12, weight: 800, color: '#cfd8e6', align: 'right', letterSpacing: 1.5 });
  text(ctx, ammo, x - 14, y - 10, { size: 24, weight: 800, color: ammo === '0' ? '#ef4444' : '#ffd166', align: 'right', font: MONO_STACK });
  // Small weapon glyph.
  ctx.save();
  ctx.translate(x - 172, y - 30);
  ctx.fillStyle = '#cfd8e6';
  if (weapon === 'pistol') {
    ctx.fillRect(0, -2, 18, 5);
    ctx.fillRect(4, 3, 5, 8);
  } else if (weapon === 'smg') {
    ctx.fillRect(0, -2, 22, 5);
    ctx.fillRect(6, 3, 5, 9);
    ctx.fillRect(12, 3, 3, 6);
  } else {
    ctx.beginPath();
    ctx.arc(7, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintToasts(ctx, game) {
  const toasts = game.toasts;
  for (let i = 0; i < toasts.length; i += 1) {
    const toast = toasts[i];
    const alpha = Math.min(1, toast.life / 0.6);
    const y = VIEW_HEIGHT - 150 - i * 34;
    ctx.globalAlpha = alpha;
    const width = Math.min(520, 40 + toast.text.length * 8.2);
    fillRoundRect(ctx, VIEW_WIDTH / 2 - width / 2, y - 20, width, 28, 8, 'rgba(8, 12, 20, 0.82)');
    ctx.fillStyle = toast.color ?? '#ffd166';
    ctx.fillRect(VIEW_WIDTH / 2 - width / 2, y - 20, 3, 28);
    text(ctx, toast.text, VIEW_WIDTH / 2, y - 1, { size: 13, weight: 600, color: '#eef3fa', align: 'center' });
    ctx.globalAlpha = 1;
  }
}

function paintDialogue(ctx, game) {
  const dialogue = game.missions.dialogue;
  if (!dialogue) return;
  const width = 760;
  const height = 132;
  const x = (VIEW_WIDTH - width) / 2;
  const y = VIEW_HEIGHT - height - 26;
  fillRoundRect(ctx, x, y, width, height, 14, 'rgba(5, 8, 14, 0.9)');
  strokeRoundRect(ctx, x, y, width, height, 14, 'rgba(255, 209, 102, 0.45)', 2);
  const contact = CONTACTS[dialogue.portrait] ?? CONTACTS.marisol;
  paintPortrait(ctx, x + 16, y + 16, 100, contact, { mood: contact.name === 'Ruben Salazar' ? 'angry' : 'talk' });
  text(ctx, dialogue.speaker ?? contact.name, x + 132, y + 36, { size: 15, weight: 800, color: contact.accent, letterSpacing: 0.5 });
  const lines = wrapText(ctx, dialogue.text ?? '', width - 160, 16);
  for (let i = 0; i < Math.min(3, lines.length); i += 1) {
    text(ctx, lines[i], x + 132, y + 64 + i * 22, { size: 15, weight: 500, color: '#e8eef8' });
  }
  text(ctx, 'E', x + width - 30, y + height - 18, { size: 12, weight: 800, color: '#ffd166', align: 'right' });
  text(ctx, 'continue', x + width - 44, y + height - 18, { size: 11, weight: 500, color: 'rgba(230, 238, 248, 0.55)', align: 'right' });
}

function wrapText(ctx, value, maxWidth, size) {
  ctx.font = `500 ${size}px ${FONT_STACK}`;
  const words = value.split(' ');
  const lines = [];
  let current = '';
  for (let i = 0; i < words.length; i += 1) {
    const candidate = current ? `${current} ${words[i]}` : words[i];
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = words[i];
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function paintPrompt(ctx, game) {
  const prompt = game.prompt;
  if (!prompt) return;
  const y = VIEW_HEIGHT - 190;
  const width = 40 + prompt.length * 8.4;
  fillRoundRect(ctx, VIEW_WIDTH / 2 - width / 2, y - 18, width, 30, 8, 'rgba(8, 12, 20, 0.82)');
  text(ctx, prompt, VIEW_WIDTH / 2, y + 2, { size: 13, weight: 600, color: '#eef3fa', align: 'center' });
}

function paintCrosshair(ctx, game, mouse) {
  if (!mouse) return;
  if (game.player.vehicle) return;
  if (game.player.weapon === 'fists') return;
  const x = mouse.x;
  const y = mouse.y;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x, y, 9, 0, Math.PI * 2);
  ctx.moveTo(x - 15, y);
  ctx.lineTo(x - 5, y);
  ctx.moveTo(x + 5, y);
  ctx.lineTo(x + 15, y);
  ctx.moveTo(x, y - 15);
  ctx.lineTo(x, y - 5);
  ctx.moveTo(x, y + 5);
  ctx.lineTo(x, y + 15);
  ctx.stroke();
}

export function paintHud(ctx, game, mouse) {
  paintObjective(ctx, game);
  paintMoney(ctx, game);
  paintWantedStars(ctx, game);
  paintMinimap(ctx, game);
  paintBars(ctx, game);
  paintWeapon(ctx, game);
  paintPrompt(ctx, game);
  paintToasts(ctx, game);
  paintDialogue(ctx, game);
  paintCrosshair(ctx, game, mouse);
}

export { MAP_SIZE, MAP_X, MAP_Y };
