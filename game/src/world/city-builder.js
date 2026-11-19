// Builds the whole city from one seed: the road grid, the five districts' blocks, the buildings
// with their roofs, air-conditioning units and awnings, the waterfront, the piers, and every
// palm, lamp post, bench, bin, crate and hydrant. The result is a plain data structure that the
// renderer paints and the collision code queries; nothing here draws or simulates.

import { createSeededRandom } from '../core/seeded-random.js';
import { clamp } from '../core/geometry.js';
import { districtForBlock } from './district-palettes.js';

export const WORLD_WIDTH = 4400;
export const WORLD_HEIGHT = 3400;
export const ROAD_HALF = 55;
export const SIDEWALK = 26;
export const LANE_OFFSET = 26;
export const ROAD_COLS = [320, 900, 1480, 2060, 2640, 3220, 3800];
export const ROAD_ROWS = [280, 840, 1400, 1960, 2520, 3080];
export const OCEAN_EAST = 4110;
export const SAND_EAST = 3888;
export const HARBOR_SOUTH = 3260;
export const GRID_CELL = 256;

const STREET_NAMES = [
  'Calder Ave', 'Vidal Blvd', 'Kessler Way', 'Marisol Dr', 'Pier Nine Rd', 'Larkspur St',
  'Anselm Row', 'Delacroix Ave', 'Sabine St', 'Ortega Way', 'Hollis Blvd', 'Quintero St',
];

const HOTEL_NAMES = ['CASA DEL SOL', 'TIDEWATER', 'PALM COURT', 'SEA BREEZE', 'THE MARISOL'];
const TOWER_NAMES = ['KESSLER', 'HALCYON', 'MERIDIAN', 'NORTHSTAR', 'BLUEWATER', 'ATLAS'];

function inset(rect, amount) {
  return { x: rect.x + amount, y: rect.y + amount, w: rect.w - amount * 2, h: rect.h - amount * 2 };
}

/** One building footprint, with the roof detail and street dressing the painter expects. */
function addBuilding(city, rng, spec) {
  const { district } = spec;
  const lift = clamp(spec.height * 0.34, spec.minLift ?? 10, 44);
  const building = {
    x: spec.x,
    y: spec.y,
    w: spec.w,
    h: spec.h,
    district: district.id,
    roof: rng.pick(district.roofs),
    wall: rng.pick(district.walls),
    trim: rng.pick(district.trim),
    lift,
    roofStyle: spec.roofStyle ?? 'flat',
    windows: spec.windows ?? district.id === 'downtown',
    awning: spec.awning ? { height: spec.awning, color: rng.pick(district.trim) } : null,
    sign: spec.sign ?? null,
    acs: [],
    vents: [],
    special: spec.special ?? null,
  };
  const acCount = district.id === 'downtown' ? rng.int(2, 5) : rng.int(0, 2);
  for (let i = 0; i < acCount; i += 1) {
    const size = rng.range(10, 20);
    building.acs.push({
      x: rng.range(8, Math.max(10, building.w - size - 8)),
      y: rng.range(8, Math.max(10, building.h - lift - size - 8)),
      w: size,
      h: size * 0.8,
    });
  }
  for (let i = 0; i < rng.int(0, 3); i += 1) {
    building.vents.push({ x: rng.range(10, building.w - 18), y: rng.range(10, building.h - lift - 18), r: rng.range(3, 6) });
  }
  city.buildings.push(building);
  city.solids.push({ x: building.x, y: building.y, w: building.w, h: building.h, kind: 'building', ref: building });
  return building;
}

function addProp(city, type, x, y, options = {}) {
  const prop = {
    type,
    x,
    y,
    radius: options.radius ?? 0,
    solid: options.solid ?? false,
    angle: options.angle ?? 0,
    scale: options.scale ?? 1,
    color: options.color ?? null,
  };
  city.props.push(prop);
  if (prop.solid) city.solids.push({ x: x - prop.radius, y: y - prop.radius, w: prop.radius * 2, h: prop.radius * 2, kind: 'prop', ref: prop });
  return prop;
}

function fillDowntown(city, rng, block, interior) {
  const district = block.district;
  const twoTowers = interior.w > 360 && rng.chance(0.55);
  const lots = twoTowers ? 2 : 1;
  const gap = 16;
  const lotWidth = (interior.w - gap * (lots - 1)) / lots;
  for (let i = 0; i < lots; i += 1) {
    const margin = rng.range(2, 14);
    const x = interior.x + i * (lotWidth + gap) + margin;
    const y = interior.y + rng.range(2, 16);
    const w = lotWidth - margin * 2;
    const h = interior.h - rng.range(8, 30);
    const height = rng.range(district.buildingHeight[0], district.buildingHeight[1]);
    addBuilding(city, rng, {
      x, y, w, h, height, district,
      minLift: 20,
      windows: true,
      roofStyle: 'flat',
      sign: rng.chance(0.35) ? { text: rng.pick(TOWER_NAMES), color: rng.pick(district.neon), x: 0.5, y: 0.5 } : null,
    });
  }
  if (rng.chance(0.5)) addProp(city, 'planter', interior.x + 10, interior.y + interior.h - 8, { radius: 9, solid: true });
}

function fillResidential(city, rng, block, interior) {
  const district = block.district;
  const columns = interior.w > 380 ? 2 : 1;
  const rows = 2;
  const lotW = interior.w / columns;
  const lotH = interior.h / rows;
  for (let cx = 0; cx < columns; cx += 1) {
    for (let cy = 0; cy < rows; cy += 1) {
      const empty = rng.chance(0.16);
      const lotX = interior.x + cx * lotW;
      const lotY = interior.y + cy * lotH;
      if (empty) {
        addProp(city, 'tree', lotX + lotW * 0.5, lotY + lotH * 0.5, { radius: 16, solid: true, scale: rng.range(0.9, 1.4) });
        continue;
      }
      const w = lotW * rng.range(0.56, 0.7);
      const h = lotH * rng.range(0.5, 0.62);
      const x = lotX + rng.range(6, lotW - w - 6);
      const y = lotY + rng.range(6, lotH - h - 6);
      addBuilding(city, rng, {
        x, y, w, h,
        height: rng.range(district.buildingHeight[0], district.buildingHeight[1]),
        district,
        roofStyle: rng.chance(0.6) ? 'gable' : 'flat',
        windows: rng.chance(0.3),
        awning: rng.chance(0.3) ? 10 : 0,
      });
      if (rng.chance(0.45)) addProp(city, 'bin', x + w + 8, y + h - 6, { radius: 7, solid: true });
      if (rng.chance(0.3)) addProp(city, 'hydrant', x - 10, y + h + 6, { radius: 6, solid: true });
    }
  }
}

function fillDocks(city, rng, block, interior) {
  const district = block.district;
  const warehouseCount = interior.h > 380 ? 2 : 1;
  const whHeight = (interior.h - 20 * (warehouseCount - 1)) / warehouseCount;
  for (let i = 0; i < warehouseCount; i += 1) {
    const y = interior.y + i * (whHeight + 20);
    const x = interior.x + rng.range(2, 10);
    const w = interior.w - rng.range(4, 18);
    addBuilding(city, rng, {
      x, y, w, h: whHeight * 0.82, height: rng.range(district.buildingHeight[0], district.buildingHeight[1]),
      district, minLift: 8, windows: false, roofStyle: 'saw',
      sign: rng.chance(0.4) ? { text: rng.pick(['PIER NINE', 'COLD STORE', 'HARBOR FREIGHT', 'DOCK 4']), color: rng.pick(district.neon), x: 0.5, y: 0.5 } : null,
    });
  }
  const stackX = interior.x + interior.w * 0.18;
  const stackY = interior.y + interior.h - 46;
  for (let i = 0; i < rng.int(2, 4); i += 1) {
    addProp(city, 'container', stackX + i * 46, stackY + (i % 2) * 8, { radius: 22, solid: true, angle: 0, color: rng.pick(['#c0563a', '#3f7a8a', '#b8913a', '#5a6b7a']) });
  }
  for (let i = 0; i < rng.int(1, 3); i += 1) {
    addProp(city, 'crate', interior.x + rng.range(20, interior.w - 20), interior.y + rng.range(20, interior.h - 20), { radius: 12, solid: true });
  }
}

function fillBeach(city, rng, block, interior) {
  const district = block.district;
  const count = 2;
  const unitH = interior.h / count;
  for (let i = 0; i < count; i += 1) {
    const w = interior.w - rng.range(0, 24);
    const x = interior.x + rng.range(0, 12);
    const y = interior.y + i * unitH + rng.range(4, 12);
    const h = unitH - rng.range(26, 44);
    addBuilding(city, rng, {
      x, y, w, h,
      height: rng.range(district.buildingHeight[0], district.buildingHeight[1]),
      district, windows: true, roofStyle: 'flat', awning: rng.chance(0.8) ? 14 : 0,
      sign: { text: rng.pick(HOTEL_NAMES), color: rng.pick(district.neon), x: 0.5, y: 0.5 },
    });
  }
}

function fillPark(city, rng, block, interior) {
  const trees = rng.int(7, 12);
  for (let i = 0; i < trees; i += 1) {
    addProp(city, 'tree', interior.x + rng.range(14, interior.w - 14), interior.y + rng.range(14, interior.h - 14), {
      radius: rng.range(12, 20), solid: true, scale: rng.range(0.9, 1.5),
    });
  }
  for (let i = 0; i < rng.int(2, 4); i += 1) {
    addProp(city, 'bench', interior.x + rng.range(20, interior.w - 20), interior.y + rng.range(20, interior.h - 20), { radius: 10, solid: true, angle: rng.chance(0.5) ? 0 : Math.PI / 2 });
  }
  addProp(city, 'fountain', interior.x + interior.w / 2, interior.y + interior.h / 2, { radius: 34, solid: true });
}

function buildBlocks(city, rng) {
  for (let column = 0; column < ROAD_COLS.length - 1; column += 1) {
    for (let row = 0; row < ROAD_ROWS.length - 1; row += 1) {
      const x = ROAD_COLS[column] + ROAD_HALF;
      const y = ROAD_ROWS[row] + ROAD_HALF;
      const w = ROAD_COLS[column + 1] - ROAD_COLS[column] - ROAD_HALF * 2;
      const h = ROAD_ROWS[row + 1] - ROAD_ROWS[row] - ROAD_HALF * 2;
      const block = {
        column, row, x, y, w, h,
        district: districtForBlock(column, row),
        street: STREET_NAMES[(column + row * 3) % STREET_NAMES.length],
      };
      city.blocks.push(block);
      const interior = inset({ x, y, w, h }, SIDEWALK);
      if (block.district.id === 'park') fillPark(city, rng, block, interior);
      else if (block.district.id === 'downtown') fillDowntown(city, rng, block, interior);
      else if (block.district.id === 'docks') fillDocks(city, rng, block, interior);
      else if (block.district.id === 'beach') fillBeach(city, rng, block, interior);
      else fillResidential(city, rng, block, interior);
    }
  }
}

function buildStreetFurniture(city, rng) {
  for (let c = 0; c < ROAD_COLS.length; c += 1) {
    const x = ROAD_COLS[c];
    for (let y = 90; y < HARBOR_SOUTH; y += 200) {
      if (isIntersectionPoint(city, x, y, 90)) continue;
      addProp(city, 'lamp', x - ROAD_HALF - 12, y, { radius: 5, solid: true });
      addProp(city, 'lamp', x + ROAD_HALF + 12, y + 100, { radius: 5, solid: true });
    }
  }
  for (let r = 0; r < ROAD_ROWS.length; r += 1) {
    const y = ROAD_ROWS[r];
    for (let x = 90; x < SAND_EAST; x += 200) {
      if (isIntersectionPoint(city, x, y, 90)) continue;
      addProp(city, 'lamp', x, y - ROAD_HALF - 12, { radius: 5, solid: true });
      addProp(city, 'lamp', x + 100, y + ROAD_HALF + 12, { radius: 5, solid: true });
    }
  }
  for (let i = 0; i < 46; i += 1) {
    const x = rng.range(SAND_EAST + 14, OCEAN_EAST - 20);
    const y = rng.range(40, HARBOR_SOUTH - 40);
    addProp(city, 'palm', x, y, { radius: 7, solid: true, scale: rng.range(0.9, 1.3) });
  }
  for (let i = 0; i < 18; i += 1) {
    const x = rng.range(SAND_EAST + 20, OCEAN_EAST - 30);
    const y = rng.range(60, HARBOR_SOUTH - 60);
    addProp(city, 'umbrella', x, y, { radius: 0, solid: false, color: rng.pick(['#ff6f91', '#4ce0d2', '#ffd166', '#ffffff']) });
  }
  for (let i = 0; i < 26; i += 1) {
    addProp(city, 'crate', rng.range(120, 2400), rng.range(HARBOR_SOUTH - 80, HARBOR_SOUTH - 16), { radius: 11, solid: true });
  }
  for (let i = 0; i < 20; i += 1) {
    addProp(city, 'bin', rng.range(120, SAND_EAST - 60), rng.range(80, HARBOR_SOUTH - 40), { radius: 6, solid: false });
  }
}

function isIntersectionPoint(city, x, y, reach) {
  for (let c = 0; c < ROAD_COLS.length; c += 1) {
    if (Math.abs(ROAD_COLS[c] - x) > reach + ROAD_HALF) continue;
    for (let r = 0; r < ROAD_ROWS.length; r += 1) {
      if (Math.abs(ROAD_ROWS[r] - y) <= reach + ROAD_HALF) return true;
    }
  }
  return false;
}

function buildWaterfront(city) {
  city.water.push({ x: OCEAN_EAST, y: 0, w: WORLD_WIDTH - OCEAN_EAST, h: WORLD_HEIGHT, kind: 'ocean' });
  city.water.push({ x: 0, y: HARBOR_SOUTH, w: OCEAN_EAST, h: WORLD_HEIGHT - HARBOR_SOUTH, kind: 'harbor' });
  city.sand.push({ x: SAND_EAST, y: 0, w: OCEAN_EAST - SAND_EAST, h: HARBOR_SOUTH });
  // Piers reach out from the docks quay into the harbor basin.
  for (let i = 0; i < 4; i += 1) {
    const x = 420 + i * 620;
    city.piers.push({ x, y: HARBOR_SOUTH - 10, w: 64, h: 150 });
  }
  for (let i = 0; i < 8; i += 1) {
    city.bollards.push({ x: 260 + i * 470, y: HARBOR_SOUTH - 14 });
  }
}

function buildIntersections(city) {
  for (let c = 0; c < ROAD_COLS.length; c += 1) {
    for (let r = 0; r < ROAD_ROWS.length; r += 1) {
      city.intersections.push({
        x: ROAD_COLS[c],
        y: ROAD_ROWS[r],
        column: c,
        row: r,
        offset: (c * 3 + r * 5) % 4,
      });
    }
  }
}

function buildSpatialGrid(city) {
  const cells = new Map();
  for (let i = 0; i < city.solids.length; i += 1) {
    const solid = city.solids[i];
    const minX = Math.floor(solid.x / GRID_CELL);
    const maxX = Math.floor((solid.x + solid.w) / GRID_CELL);
    const minY = Math.floor(solid.y / GRID_CELL);
    const maxY = Math.floor((solid.y + solid.h) / GRID_CELL);
    for (let gx = minX; gx <= maxX; gx += 1) {
      for (let gy = minY; gy <= maxY; gy += 1) {
        const key = gx * 10000 + gy;
        let bucket = cells.get(key);
        if (!bucket) {
          bucket = [];
          cells.set(key, bucket);
        }
        bucket.push(solid);
      }
    }
  }
  city.cells = cells;
}

export function buildCity(seed) {
  const rng = createSeededRandom((seed ^ 0x5eed1234) | 0);
  const city = {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    roadHalf: ROAD_HALF,
    sidewalk: SIDEWALK,
    laneOffset: LANE_OFFSET,
    cols: ROAD_COLS,
    rows: ROAD_ROWS,
    blocks: [],
    buildings: [],
    props: [],
    solids: [],
    water: [],
    sand: [],
    piers: [],
    bollards: [],
    intersections: [],
    landmarks: {},
    cells: new Map(),
    cellSize: GRID_CELL,
  };
  buildBlocks(city, rng);
  buildStreetFurniture(city, rng);
  buildWaterfront(city);
  buildIntersections(city);

  // Landmarks: the respawn points and the two side-job depots, each a named building.
  city.landmarks.hospital = { x: 690, y: 1440, name: 'Vidal General' };
  city.landmarks.station = { x: 2380, y: 880, name: 'Harbor PD' };
  city.landmarks.garage = { x: 1180, y: 2280, name: 'Quintero Garage' };
  city.landmarks.taxiStand = { x: 1690, y: 1230, name: 'Calder Taxi Rank' };
  city.landmarks.courierDepot = { x: 2450, y: 2450, name: 'Pier Nine Freight' };
  city.landmarks.pier = { x: 1044, y: HARBOR_SOUTH + 60, name: 'Pier Nine' };

  buildSpatialGrid(city);
  return city;
}

/** The block under a world point, or null when the point is on a road, water or sand. */
export function blockAt(city, x, y) {
  for (let i = 0; i < city.blocks.length; i += 1) {
    const b = city.blocks[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}
