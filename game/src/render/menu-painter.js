// Title, pause, controls, stats, death, arrest and job-failed screens. They sit over the live city,
// which keeps running behind the menu, so the title screen is the game itself at dusk.

import {
  fillRoundRect, strokeRoundRect, text, drawStar, hexToRgba, roundRectPath, FONT_STACK,
} from './canvas-kit.js';
import { VIEW_WIDTH, VIEW_HEIGHT } from '../systems/camera-rig.js';
import { CONTACTS } from '../systems/mission-story.js';
import { formatMoney } from '../core/geometry.js';
import { failReasonText, currentMission } from '../systems/mission-story.js';

const TITLE_GRADIENT = ['#ffd166', '#ff8fa3', '#57e0ff'];

export function paintTitleOverlay(ctx, game, time, selection, hasSaveFile) {
  // Night falls over the city behind the title.
  const gradient = ctx.createLinearGradient(0, 0, 0, VIEW_HEIGHT);
  gradient.addColorStop(0, 'rgba(4, 6, 14, 0.78)');
  gradient.addColorStop(0.55, 'rgba(4, 8, 18, 0.4)');
  gradient.addColorStop(1, 'rgba(4, 6, 14, 0.82)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  // A neon horizon line behind the wordmark.
  const glow = ctx.createRadialGradient(VIEW_WIDTH / 2, 250, 20, VIEW_WIDTH / 2, 250, 520);
  glow.addColorStop(0, 'rgba(255, 120, 140, 0.28)');
  glow.addColorStop(1, 'rgba(255, 120, 140, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);

  ctx.save();
  ctx.textAlign = 'center';
  const titleY = 214;
  ctx.font = `900 96px ${FONT_STACK}`;
  ctx.letterSpacing = '10px';
  ctx.shadowColor = 'rgba(255, 90, 120, 0.55)';
  ctx.shadowBlur = 26;
  const wordmark = ctx.createLinearGradient(VIEW_WIDTH / 2 - 300, 0, VIEW_WIDTH / 2 + 300, 0);
  wordmark.addColorStop(0, TITLE_GRADIENT[0]);
  wordmark.addColorStop(0.5, TITLE_GRADIENT[1]);
  wordmark.addColorStop(1, TITLE_GRADIENT[2]);
  ctx.fillStyle = wordmark;
  ctx.fillText('VICE HARBOR', VIEW_WIDTH / 2, titleY);
  ctx.shadowBlur = 0;
  ctx.letterSpacing = '6px';
  ctx.font = `600 15px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(226, 236, 248, 0.78)';
  ctx.fillText('AN OPEN-WORLD CRIME STORY IN FIVE DISTRICTS', VIEW_WIDTH / 2, titleY + 38);
  ctx.restore();

  const items = [
    { label: 'New Game', enabled: true },
    { label: 'Continue', enabled: hasSaveFile },
    { label: 'Controls', enabled: true },
  ];
  const menuY = 360;
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    const selected = i === selection;
    const y = menuY + i * 56;
    const width = 300;
    const x = VIEW_WIDTH / 2 - width / 2;
    if (selected) {
      fillRoundRect(ctx, x, y - 26, width, 42, 10, 'rgba(255, 209, 102, 0.14)');
      ctx.fillStyle = '#ffd166';
      ctx.fillRect(x, y - 26, 4, 42);
    }
    text(ctx, item.label, VIEW_WIDTH / 2, y + 4, {
      size: 24,
      weight: selected ? 800 : 500,
      color: item.enabled ? (selected ? '#ffe6a8' : '#dfe7f2') : 'rgba(160, 172, 190, 0.35)',
      align: 'center',
      letterSpacing: 2,
    });
  }

  text(ctx, 'WASD to move  ·  E to enter a car  ·  Space to sprint  ·  Click or J to fire  ·  Esc to pause', VIEW_WIDTH / 2, VIEW_HEIGHT - 92, {
    size: 13, weight: 500, color: 'rgba(200, 212, 230, 0.62)', align: 'center',
  });
  text(ctx, 'Six jobs  ·  Two side hustles  ·  Five districts  ·  One city that never asks twice', VIEW_WIDTH / 2, VIEW_HEIGHT - 64, {
    size: 12, weight: 500, color: 'rgba(160, 176, 200, 0.45)', align: 'center',
  });
  text(ctx, '↑ ↓ to choose  ·  Enter to start', VIEW_WIDTH / 2, VIEW_HEIGHT - 34, {
    size: 12, weight: 700, color: 'rgba(255, 209, 102, 0.65)', align: 'center', letterSpacing: 1.5,
  });
}

export function paintPauseOverlay(ctx, game, selection) {
  ctx.fillStyle = 'rgba(3, 6, 12, 0.72)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const width = 420;
  const height = 400;
  const x = (VIEW_WIDTH - width) / 2;
  const y = (VIEW_HEIGHT - height) / 2;
  fillRoundRect(ctx, x, y, width, height, 16, 'rgba(9, 13, 22, 0.95)');
  strokeRoundRect(ctx, x, y, width, height, 16, 'rgba(255, 209, 102, 0.35)', 2);
  text(ctx, 'PAUSED', VIEW_WIDTH / 2, y + 56, { size: 34, weight: 900, color: '#ffd166', align: 'center', letterSpacing: 6 });
  text(ctx, `${currentMission(game.missions)?.title ?? 'Vice Harbor'}`, VIEW_WIDTH / 2, y + 82, {
    size: 12, weight: 600, color: 'rgba(200, 212, 230, 0.55)', align: 'center', letterSpacing: 2,
  });
  const items = ['Resume', 'Controls', 'Stats', 'Save Game', 'Quit to title'];
  for (let i = 0; i < items.length; i += 1) {
    const selected = i === selection;
    const itemY = y + 132 + i * 46;
    if (selected) {
      fillRoundRect(ctx, x + 40, itemY - 22, width - 80, 34, 8, 'rgba(255, 209, 102, 0.12)');
    }
    text(ctx, items[i], VIEW_WIDTH / 2, itemY, {
      size: 19, weight: selected ? 800 : 500, color: selected ? '#ffe6a8' : '#cfd8e6', align: 'center', letterSpacing: 1.5,
    });
  }
  text(ctx, 'Esc to resume', VIEW_WIDTH / 2, y + height - 22, { size: 12, weight: 500, color: 'rgba(180, 195, 215, 0.5)', align: 'center' });
}

export function paintControlsOverlay(ctx, game) {
  ctx.fillStyle = 'rgba(3, 6, 12, 0.82)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const width = 860;
  const height = 470;
  const x = (VIEW_WIDTH - width) / 2;
  const y = (VIEW_HEIGHT - height) / 2;
  fillRoundRect(ctx, x, y, width, height, 18, 'rgba(9, 13, 22, 0.96)');
  strokeRoundRect(ctx, x, y, width, height, 18, 'rgba(87, 224, 255, 0.35)', 2);
  text(ctx, 'CONTROLS', VIEW_WIDTH / 2, y + 52, { size: 28, weight: 900, color: '#57e0ff', align: 'center', letterSpacing: 6 });

  const rows = [
    ['WASD / arrows', 'Walk, run and steer'],
    ['E', 'Enter or leave a vehicle'],
    ['Space', 'Sprint on foot, handbrake in a car'],
    ['Left click / J', 'Fire the equipped weapon'],
    ['1 2 3', 'Fists, pistol, SMG'],
    ['T', 'Start a taxi fare (in a cab)'],
    ['C', 'Start a courier run (at the depot)'],
    ['Esc / P', 'Pause'],
    ['M', 'Toggle the city map'],
  ];
  for (let i = 0; i < rows.length; i += 1) {
    const rowY = y + 108 + i * 38;
    text(ctx, rows[i][0], x + 90, rowY, { size: 15, weight: 800, color: '#ffd166', font: '"SF Mono", "Consolas", monospace' });
    text(ctx, rows[i][1], x + 300, rowY, { size: 15, weight: 500, color: '#dbe4f0' });
  }
  text(ctx, 'Esc or Enter to go back', VIEW_WIDTH / 2, y + height - 24, { size: 12, weight: 500, color: 'rgba(180, 195, 215, 0.5)', align: 'center' });
}

export function paintStatsOverlay(ctx, game) {
  ctx.fillStyle = 'rgba(3, 6, 12, 0.82)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const width = 620;
  const height = 440;
  const x = (VIEW_WIDTH - width) / 2;
  const y = (VIEW_HEIGHT - height) / 2;
  fillRoundRect(ctx, x, y, width, height, 18, 'rgba(9, 13, 22, 0.96)');
  strokeRoundRect(ctx, x, y, width, height, 18, 'rgba(255, 209, 102, 0.35)', 2);
  text(ctx, 'CAREER', VIEW_WIDTH / 2, y + 52, { size: 26, weight: 900, color: '#ffd166', align: 'center', letterSpacing: 6 });
  const stats = [
    ['Money', formatMoney(game.money)],
    ['Jobs completed', `${game.stats.missions} / 6`],
    ['Side jobs run', String(game.stats.sideJobs)],
    ['Cars stolen', String(game.stats.carsStolen)],
    ['Distance driven', `${(game.stats.distanceDriven / 1000).toFixed(1)} km`],
    ['Shots fired', String(game.stats.shotsFired)],
    ['Officers down', String(game.stats.officersDown)],
    ['Highest wanted level', `${game.wanted.peakStars} star${game.wanted.peakStars === 1 ? '' : 's'}`],
  ];
  for (let i = 0; i < stats.length; i += 1) {
    const rowY = y + 108 + i * 34;
    text(ctx, stats[i][0], x + 60, rowY, { size: 14, weight: 500, color: 'rgba(200, 212, 230, 0.7)' });
    text(ctx, stats[i][1], x + width - 60, rowY, { size: 15, weight: 800, color: '#eef3fa', align: 'right', font: '"SF Mono", "Consolas", monospace' });
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(x + 60, rowY + 10, width - 120, 1);
  }
  text(ctx, 'Esc or Enter to go back', VIEW_WIDTH / 2, y + height - 24, { size: 12, weight: 500, color: 'rgba(180, 195, 215, 0.5)', align: 'center' });
}

export function paintEndOverlay(ctx, game, kind, cost) {
  const arrested = kind === 'busted';
  const red = arrested ? '#57b8ff' : '#ef4444';
  ctx.fillStyle = arrested ? 'rgba(6, 10, 24, 0.86)' : 'rgba(24, 4, 6, 0.86)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const gradient = ctx.createRadialGradient(VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 40, VIEW_WIDTH / 2, VIEW_HEIGHT / 2, 520);
  gradient.addColorStop(0, hexToRgba(red, 0.24));
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  text(ctx, arrested ? 'BOOKED' : 'FLATLINED', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 40, {
    size: 84, weight: 900, color: red, align: 'center', letterSpacing: 12, shadow: { color: hexToRgba(red, 0.6), blur: 30 },
  });
  text(ctx, arrested ? 'The Harbor PD ran your prints. Bail was not cheap.' : 'Vidal General patched you up. The bill came first.', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 16, {
    size: 16, weight: 500, color: '#dbe4f0', align: 'center',
  });
  text(ctx, `Cost: ${formatMoney(cost)}`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 52, {
    size: 18, weight: 800, color: '#ffd166', align: 'center', font: '"SF Mono", "Consolas", monospace',
  });
  text(ctx, 'Press Enter to get back on the street', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 116, {
    size: 14, weight: 600, color: 'rgba(220, 230, 244, 0.7)', align: 'center',
  });
}

export function paintMissionFailedOverlay(ctx, game) {
  const director = game.missions;
  const mission = currentMission(director);
  ctx.fillStyle = 'rgba(14, 6, 10, 0.82)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  text(ctx, 'JOB FAILED', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 70, {
    size: 62, weight: 900, color: '#ff5f7a', align: 'center', letterSpacing: 8,
  });
  text(ctx, mission ? mission.title : '', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 - 20, {
    size: 20, weight: 700, color: '#eef3fa', align: 'center', letterSpacing: 2,
  });
  text(ctx, failReasonText(director.failReason), VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 20, {
    size: 16, weight: 500, color: 'rgba(220, 230, 244, 0.7)', align: 'center',
  });
  const contact = mission ? CONTACTS[mission.contact] : CONTACTS.marisol;
  text(ctx, `${contact.name}: "${mission ? mission.brief : ''}"`, VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 62, {
    size: 14, weight: 500, color: contact.accent, align: 'center',
  });
  text(ctx, 'Enter to retry  ·  Esc for the pause menu', VIEW_WIDTH / 2, VIEW_HEIGHT / 2 + 130, {
    size: 14, weight: 700, color: '#ffd166', align: 'center',
  });
}

export function paintCityMapOverlay(ctx, game) {
  ctx.fillStyle = 'rgba(3, 6, 12, 0.88)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  const size = 560;
  const x = (VIEW_WIDTH - size) / 2;
  const y = 80;
  fillRoundRect(ctx, x - 18, y - 18, size + 36, size + 36, 18, 'rgba(9, 13, 22, 0.96)');
  ctx.save();
  roundRectPath(ctx, x, y, size, size, 10);
  ctx.clip();
  const scale = size / game.city.width;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#0c121c';
  ctx.fillRect(0, 0, game.city.width, game.city.height);
  for (let i = 0; i < game.city.water.length; i += 1) {
    ctx.fillStyle = '#123a55';
    ctx.fillRect(game.city.water[i].x, game.city.water[i].y, game.city.water[i].w, game.city.water[i].h);
  }
  for (let i = 0; i < game.city.sand.length; i += 1) {
    ctx.fillStyle = '#b9a173';
    ctx.fillRect(game.city.sand[i].x, game.city.sand[i].y, game.city.sand[i].w, game.city.sand[i].h);
  }
  for (let i = 0; i < game.city.blocks.length; i += 1) {
    const block = game.city.blocks[i];
    ctx.fillStyle = block.district.id === 'park' ? '#2c4a33' : block.district.id === 'downtown' ? '#2a3140' : '#1d232d';
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
  ctx.strokeStyle = '#3a4250';
  ctx.lineWidth = game.city.roadHalf * 2;
  for (let i = 0; i < game.city.cols.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(game.city.cols[i], 0);
    ctx.lineTo(game.city.cols[i], game.city.height);
    ctx.stroke();
  }
  for (let i = 0; i < game.city.rows.length; i += 1) {
    ctx.beginPath();
    ctx.moveTo(0, game.city.rows[i]);
    ctx.lineTo(game.city.width, game.city.rows[i]);
    ctx.stroke();
  }
  const marker = game.missions.marker;
  if (marker) {
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(marker.x, marker.y, 70, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(game.player.x, game.player.y, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  text(ctx, 'VICE HARBOR', x + size / 2, y + size + 2, { size: 12, weight: 800, color: 'rgba(255,209,102,0.7)', align: 'center', letterSpacing: 3 });
  text(ctx, 'M or Esc to close', VIEW_WIDTH / 2, VIEW_HEIGHT - 40, { size: 12, weight: 500, color: 'rgba(180, 195, 215, 0.5)', align: 'center' });
}

export function paintStarRow(ctx, x, y, count, max = 5) {
  for (let i = 0; i < max; i += 1) drawStar(ctx, x + i * 22, y, 9, 4, i < count ? '#ffd166' : 'rgba(120, 130, 145, 0.35)');
}
