// Paints the city itself: sea and surf, sand, asphalt with lane paint and zebra crossings, kerbs,
// then the buildings with their roofs, air-conditioning units, awnings and neon signs, then every
// palm, lamp post, bench, bin, crate and hydrant, and finally the world markers for jobs.

import { fillRoundRect, glowDisc, hexToRgba, shade, text } from './canvas-kit.js';
import { isVisible } from '../systems/camera-rig.js';
import { hash2 } from '../core/geometry.js';
import { HARBOR_SOUTH } from '../world/city-builder.js';

function overlaps(rect, bounds) {
  return rect.x < bounds.x + bounds.w && rect.x + rect.w > bounds.x && rect.y < bounds.y + bounds.h && rect.y + rect.h > bounds.y;
}

function paintSea(ctx, city, bounds, time) {
  for (let i = 0; i < city.water.length; i += 1) {
    const water = city.water[i];
    if (!overlaps(water, bounds)) continue;
    const gradient = ctx.createLinearGradient(water.x, water.y, water.x + water.w, water.y + water.h);
    gradient.addColorStop(0, '#12405c');
    gradient.addColorStop(0.5, '#0f5474');
    gradient.addColorStop(1, '#0a3450');
    ctx.fillStyle = gradient;
    ctx.fillRect(water.x, water.y, water.w, water.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(water.x, water.y, water.w, water.h);
    ctx.clip();
    ctx.strokeStyle = 'rgba(190, 232, 255, 0.16)';
    ctx.lineWidth = 2;
    const step = 30;
    const startY = Math.floor(bounds.y / step) * step;
    for (let y = startY; y < bounds.y + bounds.h; y += step) {
      const phase = time * 1.4 + y * 0.02;
      ctx.beginPath();
      for (let x = Math.floor(bounds.x / 40) * 40; x < bounds.x + bounds.w; x += 40) {
        const wave = Math.sin(phase + x * 0.012) * 5;
        if (x === Math.floor(bounds.x / 40) * 40) ctx.moveTo(x, y + wave);
        else ctx.lineTo(x, y + wave);
      }
      ctx.stroke();
    }
    // Surf along the shoreline.
    ctx.strokeStyle = 'rgba(235, 250, 255, 0.5)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    const foamX = water.kind === 'ocean' ? water.x + 4 : bounds.x;
    if (water.kind === 'ocean') {
      for (let y = Math.floor(bounds.y / 30) * 30; y < bounds.y + bounds.h; y += 30) {
        const wobble = Math.sin(time * 2 + y * 0.05) * 4;
        if (y === Math.floor(bounds.y / 30) * 30) ctx.moveTo(foamX + wobble, y);
        else ctx.lineTo(foamX + wobble, y);
      }
    } else {
      for (let x = Math.floor(bounds.x / 30) * 30; x < bounds.x + bounds.w; x += 30) {
        const wobble = Math.sin(time * 2 + x * 0.05) * 4;
        if (x === Math.floor(bounds.x / 30) * 30) ctx.moveTo(x, water.y + 4 + wobble);
        else ctx.lineTo(x, water.y + 4 + wobble);
      }
    }
    ctx.stroke();
    ctx.restore();
  }
}

function paintSand(ctx, city, bounds) {
  for (let i = 0; i < city.sand.length; i += 1) {
    const sand = city.sand[i];
    if (!overlaps(sand, bounds)) continue;
    ctx.fillStyle = '#d9c49b';
    ctx.fillRect(sand.x, sand.y, sand.w, sand.h);
    ctx.fillStyle = 'rgba(180, 150, 100, 0.28)';
    const startY = Math.floor(bounds.y / 24) * 24;
    for (let y = startY; y < bounds.y + bounds.h; y += 24) {
      for (let x = Math.floor(bounds.x / 24) * 24; x < bounds.x + bounds.w; x += 24) {
        const noise = hash2(x, y) % 100;
        if (noise < 22) ctx.fillRect(x + (noise % 9), y + (noise % 7), 2, 2);
      }
    }
  }
}

function paintAsphalt(ctx, city, bounds) {
  const half = city.roadHalf;
  const southLimit = Math.min(city.height, bounds.y + bounds.h);
  ctx.fillStyle = '#2e323a';
  for (let i = 0; i < city.cols.length; i += 1) {
    const x = city.cols[i];
    if (x + half < bounds.x || x - half > bounds.x + bounds.w) continue;
    const top = Math.max(0, bounds.y);
    const bottom = Math.min(southLimit, HARBOR_SOUTH);
    if (bottom <= top) continue;
    ctx.fillRect(x - half, top, half * 2, bottom - top);
  }
  for (let i = 0; i < city.rows.length; i += 1) {
    const y = city.rows[i];
    if (y + half < bounds.y || y - half > bounds.y + bounds.h) continue;
    ctx.fillRect(Math.max(0, bounds.x), y - half, Math.min(city.width, bounds.x + bounds.w) - Math.max(0, bounds.x), half * 2);
  }
}

function paintKerbsAndFloors(ctx, city, bounds) {
  for (let i = 0; i < city.blocks.length; i += 1) {
    const block = city.blocks[i];
    if (!overlaps({ x: block.x - 30, y: block.y - 30, w: block.w + 60, h: block.h + 60 }, bounds)) continue;
    const district = block.district;
    ctx.fillStyle = district.sidewalk;
    ctx.fillRect(block.x - city.sidewalk, block.y - city.sidewalk, block.w + city.sidewalk * 2, block.h + city.sidewalk * 2);
    ctx.fillStyle = district.blockFloor;
    ctx.fillRect(block.x, block.y, block.w, block.h);
    // Kerb edge highlight.
    ctx.strokeStyle = hexToRgba('#ffffff', 0.1);
    ctx.lineWidth = 2;
    ctx.strokeRect(block.x - city.sidewalk + 1, block.y - city.sidewalk + 1, block.w + city.sidewalk * 2 - 2, block.h + city.sidewalk * 2 - 2);
    if (district.id === 'park') {
      // Mown stripes across the lawn.
      ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
      for (let s = 0; s < block.h; s += 46) ctx.fillRect(block.x, block.y + s, block.w, 22);
    }
    if (district.id === 'docks') {
      // Cracks and oil stains on the concrete apron.
      ctx.fillStyle = 'rgba(20, 16, 12, 0.18)';
      for (let s = 0; s < 6; s += 1) {
        const px = block.x + ((hash2(block.column * 13 + s, block.row * 7) % 100) / 100) * block.w;
        const py = block.y + ((hash2(block.row * 17, block.column * 5 + s) % 100) / 100) * block.h;
        ctx.beginPath();
        ctx.ellipse(px, py, 18 + (s % 3) * 6, 8 + (s % 2) * 5, s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function paintLanePaint(ctx, city, bounds) {
  const half = city.roadHalf;
  const dash = 30;
  const gap = 26;

  function nearJunction(x, y) {
    for (let c = 0; c < city.cols.length; c += 1) {
      if (Math.abs(x - city.cols[c]) > half + 30) continue;
      for (let r = 0; r < city.rows.length; r += 1) {
        if (Math.abs(y - city.rows[r]) < half + 30) return true;
      }
    }
    return false;
  }

  ctx.strokeStyle = 'rgba(230, 200, 90, 0.85)';
  ctx.lineWidth = 3;
  ctx.setLineDash([dash, gap]);
  for (let i = 0; i < city.cols.length; i += 1) {
    const x = city.cols[i];
    if (x < bounds.x - 10 || x > bounds.x + bounds.w + 10) continue;
    ctx.beginPath();
    let y = Math.max(0, bounds.y);
    let drawing = false;
    for (; y < Math.min(city.height, bounds.y + bounds.h); y += 8) {
      if (nearJunction(x, y)) {
        drawing = false;
        continue;
      }
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  for (let i = 0; i < city.rows.length; i += 1) {
    const y = city.rows[i];
    if (y < bounds.y - 10 || y > bounds.y + bounds.h + 10) continue;
    ctx.beginPath();
    let x = Math.max(0, bounds.x);
    let drawing = false;
    for (; x < Math.min(city.width, bounds.x + bounds.w); x += 8) {
      if (nearJunction(x, y)) {
        drawing = false;
        continue;
      }
      if (!drawing) {
        ctx.moveTo(x, y);
        drawing = true;
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // White edge lines.
  ctx.strokeStyle = 'rgba(240, 244, 250, 0.35)';
  ctx.lineWidth = 2;
  for (let i = 0; i < city.cols.length; i += 1) {
    const x = city.cols[i];
    if (x < bounds.x - 10 || x > bounds.x + bounds.w + 10) continue;
    ctx.beginPath();
    ctx.moveTo(x - half + 7, Math.max(0, bounds.y));
    ctx.lineTo(x - half + 7, Math.min(city.height, bounds.y + bounds.h));
    ctx.moveTo(x + half - 7, Math.max(0, bounds.y));
    ctx.lineTo(x + half - 7, Math.min(city.height, bounds.y + bounds.h));
    ctx.stroke();
  }
  for (let i = 0; i < city.rows.length; i += 1) {
    const y = city.rows[i];
    if (y < bounds.y - 10 || y > bounds.y + bounds.h + 10) continue;
    ctx.beginPath();
    ctx.moveTo(Math.max(0, bounds.x), y - half + 7);
    ctx.lineTo(Math.min(city.width, bounds.x + bounds.w), y - half + 7);
    ctx.moveTo(Math.max(0, bounds.x), y + half - 7);
    ctx.lineTo(Math.min(city.width, bounds.x + bounds.w), y + half - 7);
    ctx.stroke();
  }
}

function paintCrosswalks(ctx, city, bounds) {
  const half = city.roadHalf;
  for (let i = 0; i < city.intersections.length; i += 1) {
    const node = city.intersections[i];
    if (!isVisible(bounds, node.x, node.y, half + 60)) continue;
    ctx.fillStyle = 'rgba(238, 242, 248, 0.62)';
    for (let bar = 0; bar < 6; bar += 1) {
      const offset = -half + 12 + bar * 17;
      // North and south approaches.
      ctx.fillRect(node.x + offset, node.y - half - 30, 9, 20);
      ctx.fillRect(node.x + offset, node.y + half + 10, 9, 20);
      // East and west approaches.
      ctx.fillRect(node.x - half - 30, node.y + offset, 20, 9);
      ctx.fillRect(node.x + half + 10, node.y + offset, 20, 9);
    }
    // Stop bars.
    ctx.fillStyle = 'rgba(238, 242, 248, 0.45)';
    ctx.fillRect(node.x - half + 6, node.y - half - 8, half * 2 - 12, 4);
    ctx.fillRect(node.x - half - 8, node.y - half + 6, 4, half * 2 - 12);
  }
}

function paintTrafficSignals(ctx, city, bounds, clock) {
  const half = city.roadHalf;
  for (let i = 0; i < city.intersections.length; i += 1) {
    const node = city.intersections[i];
    if (!isVisible(bounds, node.x, node.y, half + 40)) continue;
    const phase = (clock + node.offset * 2) % 16;
    const verticalGreen = phase < 7;
    const corners = [
      [node.x - half - 16, node.y - half - 16],
      [node.x + half + 16, node.y - half - 16],
      [node.x - half - 16, node.y + half + 16],
      [node.x + half + 16, node.y + half + 16],
    ];
    for (let c = 0; c < corners.length; c += 1) {
      const [x, y] = corners[c];
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 3, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#20242a';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = verticalGreen ? '#4ade80' : '#ef4444';
      ctx.beginPath();
      ctx.arc(x, y, 3.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function paintOneBuilding(ctx, building, lighting) {
  const lift = building.lift;
  const roofHeight = Math.max(6, building.h - lift);
  const roofY = building.y;

  // Wall body: the visible south face and the footprint.
  ctx.fillStyle = building.wall;
  ctx.fillRect(building.x, roofY, building.w, building.h);
  const wallGradient = ctx.createLinearGradient(0, roofY + roofHeight, 0, roofY + building.h);
  wallGradient.addColorStop(0, 'rgba(255,255,255,0.06)');
  wallGradient.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = wallGradient;
  ctx.fillRect(building.x, roofY + roofHeight, building.w, lift);

  // Roof slab.
  ctx.fillStyle = building.roof;
  ctx.fillRect(building.x, roofY, building.w, roofHeight);
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(building.x, roofY, building.w, 3);
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 2;
  ctx.strokeRect(building.x + 1, roofY + 1, building.w - 2, roofHeight - 2);

  if (building.roofStyle === 'gable') {
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    ctx.beginPath();
    ctx.moveTo(building.x + 4, roofY + 4);
    ctx.lineTo(building.x + building.w / 2, roofY + roofHeight * 0.35);
    ctx.lineTo(building.x + building.w - 4, roofY + 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(building.x + building.w / 2, roofY + 4);
    ctx.lineTo(building.x + building.w / 2, roofY + roofHeight - 4);
    ctx.stroke();
  } else if (building.roofStyle === 'saw') {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 3;
    for (let x = building.x + 16; x < building.x + building.w - 8; x += 26) {
      ctx.beginPath();
      ctx.moveTo(x, roofY + 6);
      ctx.lineTo(x + 12, roofY + roofHeight - 6);
      ctx.stroke();
    }
  } else {
    // Flat roof: parapet shadow and a few vents.
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(building.x + 5, roofY + 5, building.w - 10, roofHeight - 10);
  }

  // Air-conditioning units and vents.
  for (let i = 0; i < building.acs.length; i += 1) {
    const ac = building.acs[i];
    const ax = building.x + ac.x;
    const ay = roofY + ac.y;
    if (ay + ac.h > roofY + roofHeight) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(ax + 2, ay + 2, ac.w, ac.h);
    ctx.fillStyle = '#9aa2ad';
    ctx.fillRect(ax, ay, ac.w, ac.h);
    ctx.fillStyle = '#6d747d';
    ctx.beginPath();
    ctx.arc(ax + ac.w / 2, ay + ac.h / 2, ac.w * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < building.vents.length; i += 1) {
    const vent = building.vents[i];
    ctx.fillStyle = 'rgba(40, 44, 52, 0.8)';
    ctx.beginPath();
    ctx.arc(building.x + vent.x, roofY + vent.y, vent.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Windows on the south face.
  if (building.windows && lift > 14) {
    const rows = lift > 30 ? 3 : 2;
    const columns = Math.max(2, Math.floor(building.w / 26));
    const cellW = building.w / columns;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < columns; c += 1) {
        const wx = building.x + c * cellW + cellW * 0.25;
        const wy = roofY + roofHeight + 5 + r * ((lift - 8) / rows);
        const lit = lighting.isNight && hash2(c * 31 + r, building.x + building.y) % 10 < 6;
        ctx.fillStyle = lit ? 'rgba(255, 208, 120, 0.85)' : 'rgba(120, 160, 200, 0.22)';
        ctx.fillRect(wx, wy, cellW * 0.5, Math.max(3, (lift - 12) / rows - 3));
      }
    }
  }

  // Awning over the pavement.
  if (building.awning) {
    const height = building.awning.height;
    ctx.fillStyle = building.awning.color;
    ctx.fillRect(building.x + 3, building.y + building.h - 4, building.w - 6, height);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    for (let x = building.x + 3; x < building.x + building.w - 6; x += 16) ctx.fillRect(x, building.y + building.h - 4, 7, height);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(building.x + 3, building.y + building.h + height - 4, building.w - 6, 4);
  }

  // Neon sign on the facade.
  if (building.sign && building.sign.text) {
    const signY = roofY + roofHeight + Math.min(lift - 6, 20);
    ctx.save();
    if (lighting.isNight) {
      ctx.shadowColor = building.sign.color;
      ctx.shadowBlur = 14;
    }
    text(ctx, building.sign.text, building.x + building.w / 2, signY + 4, {
      size: Math.min(15, Math.max(9, building.w / 16)),
      weight: 700,
      color: building.sign.color,
      align: 'center',
      baseline: 'middle',
      letterSpacing: 1,
    });
    ctx.restore();
  }
}

export function paintBuildings(ctx, city, bounds, lighting) {
  const visible = [];
  for (let i = 0; i < city.buildings.length; i += 1) {
    const b = city.buildings[i];
    if (isVisible(bounds, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h))) visible.push(b);
  }
  visible.sort((a, b) => a.y - b.y);

  for (let i = 0; i < visible.length; i += 1) {
    const b = visible[i];
    const stretch = 1 + (lighting.warmth ?? 0) * 1.1 + lighting.darkness * 0.2;
    const offsetX = (12 + b.lift * 0.35) * stretch;
    const offsetY = (14 + b.lift * 0.3) * stretch;
    ctx.fillStyle = `rgba(4, 6, 12, ${0.3 + (lighting.warmth ?? 0) * 0.12})`;
    ctx.fillRect(b.x + offsetX, b.y + offsetY, b.w, b.h);
  }
  for (let i = 0; i < visible.length; i += 1) paintOneBuilding(ctx, visible[i], lighting);
}

function paintOneProp(ctx, prop, lighting, time) {
  const { x, y, type } = prop;
  switch (type) {
    case 'palm': {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + 7, y + 8, 15, 10, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#6b4a2f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 3, y - 3);
      ctx.stroke();
      for (let i = 0; i < 6; i += 1) {
        const angle = (i / 6) * Math.PI * 2 + (prop.angle ?? 0);
        ctx.strokeStyle = i % 2 === 0 ? '#2f7a4a' : '#3f9a5a';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(angle) * 12, y + Math.sin(angle) * 12, x + Math.cos(angle) * 20, y + Math.sin(angle) * 20);
        ctx.stroke();
      }
      ctx.fillStyle = '#3f9a5a';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'lamp': {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 4, y + 5, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2f36';
      ctx.beginPath();
      ctx.arc(x, y, 4.5, 0, Math.PI * 2);
      ctx.fill();
      if (lighting.lampsOn) {
        ctx.fillStyle = '#ffe2a8';
        ctx.beginPath();
        ctx.arc(x, y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'bench': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(prop.angle ?? 0);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-11, -3, 24, 10);
      ctx.fillStyle = '#8a5a3a';
      ctx.fillRect(-12, -5, 24, 9);
      ctx.fillStyle = '#a8703f';
      ctx.fillRect(-12, -5, 24, 3);
      ctx.restore();
      break;
    }
    case 'bin': {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + 3, y + 4, 7, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a5058';
      ctx.beginPath();
      ctx.arc(x, y, 6.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#666e78';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'crate': {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.fillRect(x - 10, y - 8, 24, 22);
      ctx.fillStyle = '#a8783f';
      ctx.fillRect(x - 11, y - 11, 22, 22);
      ctx.strokeStyle = '#7a5429';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 11, y - 11, 22, 22);
      ctx.beginPath();
      ctx.moveTo(x - 11, y - 11);
      ctx.lineTo(x + 11, y + 11);
      ctx.moveTo(x + 11, y - 11);
      ctx.lineTo(x - 11, y + 11);
      ctx.stroke();
      break;
    }
    case 'container': {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(prop.angle ?? 0);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-20, -12, 46, 30);
      ctx.fillStyle = prop.color ?? '#c0563a';
      ctx.fillRect(-22, -15, 44, 30);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let i = -18; i < 22; i += 6) ctx.fillRect(i, -15, 2, 30);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(-22, -15, 44, 4);
      ctx.restore();
      break;
    }
    case 'hydrant': {
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(x + 2, y + 3, 6, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#c23a3a';
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e05555';
      ctx.fillRect(x - 1.5, y - 6, 3, 12);
      break;
    }
    case 'umbrella': {
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.beginPath();
      ctx.ellipse(x + 6, y + 7, 18, 12, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = prop.color ?? '#ff6f91';
      for (let i = 0; i < 8; i += 1) {
        const a0 = (i / 8) * Math.PI * 2;
        const a1 = ((i + 1) / 8) * Math.PI * 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.arc(x, y, 18, a0, a1);
        ctx.closePath();
        ctx.fillStyle = i % 2 === 0 ? prop.color ?? '#ff6f91' : '#f7f2e6';
        ctx.fill();
      }
      break;
    }
    case 'tree': {
      const scale = prop.scale ?? 1;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(x + 9, y + 10, 20 * scale, 13 * scale, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f5c37';
      ctx.beginPath();
      ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3f7a48';
      ctx.beginPath();
      ctx.arc(x - 5 * scale, y - 4 * scale, 12 * scale, 0, Math.PI * 2);
      ctx.arc(x + 7 * scale, y + 3 * scale, 10 * scale, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'fountain': {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath();
      ctx.arc(x + 5, y + 6, 38, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#b8b0a0';
      ctx.beginPath();
      ctx.arc(x, y, 36, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f7a9a';
      ctx.beginPath();
      ctx.arc(x, y, 27, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(220, 245, 255, 0.5)';
      ctx.lineWidth = 2;
      for (let i = 1; i <= 3; i += 1) {
        ctx.beginPath();
        ctx.arc(x, y, i * 7 + Math.sin(time * 2 + i) * 1.5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(220, 245, 255, 0.7)';
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'planter': {
      ctx.fillStyle = '#5a5f52';
      ctx.fillRect(x - 12, y - 8, 24, 16);
      ctx.fillStyle = '#3f7a48';
      ctx.beginPath();
      ctx.arc(x - 5, y, 6, 0, Math.PI * 2);
      ctx.arc(x + 5, y, 6, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    default:
      break;
  }
}

export function paintProps(ctx, city, bounds, lighting, time) {
  for (let i = 0; i < city.props.length; i += 1) {
    const prop = city.props[i];
    if (!isVisible(bounds, prop.x, prop.y, 40)) continue;
    paintOneProp(ctx, prop, lighting, time);
  }
  // Bollards along the quay.
  for (let i = 0; i < city.bollards.length; i += 1) {
    const b = city.bollards[i];
    if (!isVisible(bounds, b.x, b.y, 20)) continue;
    ctx.fillStyle = '#2b2f36';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#4a5058';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function paintPiers(ctx, city, bounds) {
  for (let i = 0; i < city.piers.length; i += 1) {
    const pier = city.piers[i];
    if (!overlaps(pier, bounds)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(pier.x + 6, pier.y + 8, pier.w, pier.h);
    ctx.fillStyle = '#7a5a3a';
    ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    for (let y = pier.y; y < pier.y + pier.h; y += 12) ctx.fillRect(pier.x, y, pier.w, 3);
    ctx.strokeStyle = '#9a7a55';
    ctx.lineWidth = 2;
    ctx.strokeRect(pier.x, pier.y, pier.w, pier.h);
  }
}

export function paintSkidMarks(ctx, effects, bounds) {
  for (let i = 0; i < effects.marks.length; i += 1) {
    const mark = effects.marks[i];
    if (!isVisible(bounds, mark.x, mark.y, 10)) continue;
    const alpha = Math.min(0.5, mark.life / 26) * mark.strength;
    ctx.strokeStyle = `rgba(18, 18, 20, ${alpha})`;
    ctx.lineWidth = mark.width;
    ctx.beginPath();
    ctx.moveTo(mark.x, mark.y);
    ctx.lineTo(mark.x - Math.cos(mark.angle) * 9, mark.y - Math.sin(mark.angle) * 9);
    ctx.stroke();
  }
  for (let i = 0; i < effects.decals.length; i += 1) {
    const decal = effects.decals[i];
    if (!isVisible(bounds, decal.x, decal.y, 20)) continue;
    ctx.fillStyle = `rgba(60, 20, 20, ${Math.min(0.35, decal.life / 90)})`;
    ctx.beginPath();
    ctx.ellipse(decal.x, decal.y, decal.size, decal.size * 0.6, decal.angle, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The pulsing cylinder of light that marks a job in the world. */
export function paintWorldMarker(ctx, marker, time, color = '#ffd166') {
  if (!marker) return;
  const pulse = 0.5 + Math.sin(time * 3.4) * 0.5;
  ctx.save();
  ctx.translate(marker.x, marker.y);
  const radius = marker.radius ?? 46;
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, hexToRgba(color, 0.32));
  gradient.addColorStop(0.7, hexToRgba(color, 0.14));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = hexToRgba(color, 0.8);
  ctx.lineWidth = 3;
  ctx.setLineDash([12, 10]);
  ctx.lineDashOffset = -time * 26;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  // Floating diamond.
  const bob = Math.sin(time * 2.2) * 5;
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(0, -26 + bob);
  ctx.lineTo(10, -14 + bob);
  ctx.lineTo(0, -2 + bob);
  ctx.lineTo(-10, -14 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function paintPickups(ctx, game, bounds, time) {
  for (let i = 0; i < game.pickups.length; i += 1) {
    const pickup = game.pickups[i];
    if (!isVisible(bounds, pickup.x, pickup.y, 30)) continue;
    const bob = Math.sin(pickup.bob) * 3;
    const color = pickup.type === 'health' ? '#4ade80'
      : pickup.type === 'armour' ? '#57b8ff'
      : pickup.type === 'smg' ? '#c084fc'
      : pickup.type === 'pistol' ? '#ffd166' : '#8ae66e';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(pickup.x + 2, pickup.y + 8, 12, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    glowDisc(ctx, pickup.x, pickup.y + bob, 26, hexToRgba(color, 0.5), 0.6);
    ctx.fillStyle = '#0b0e16';
    fillRoundRect(ctx, pickup.x - 11, pickup.y - 11 + bob, 22, 22, 6, 'rgba(10, 14, 22, 0.9)');
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(pickup.x - 11, pickup.y - 11 + bob, 22, 22);
    ctx.fillStyle = color;
    if (pickup.type === 'health') {
      ctx.fillRect(pickup.x - 2, pickup.y - 7 + bob, 4, 14);
      ctx.fillRect(pickup.x - 7, pickup.y - 2 + bob, 14, 4);
    } else if (pickup.type === 'armour') {
      ctx.beginPath();
      ctx.moveTo(pickup.x, pickup.y - 7 + bob);
      ctx.lineTo(pickup.x + 7, pickup.y - 3 + bob);
      ctx.lineTo(pickup.x + 5, pickup.y + 6 + bob);
      ctx.lineTo(pickup.x, pickup.y + 8 + bob);
      ctx.lineTo(pickup.x - 5, pickup.y + 6 + bob);
      ctx.lineTo(pickup.x - 7, pickup.y - 3 + bob);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(pickup.x - 6, pickup.y - 2 + bob, 12, 4);
      ctx.fillRect(pickup.x - 2, pickup.y - 6 + bob, 4, 8);
    }
  }
}

export { paintSea, paintSand, paintAsphalt, paintKerbsAndFloors, paintLanePaint, paintCrosswalks, paintTrafficSignals };
