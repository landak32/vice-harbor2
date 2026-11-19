// The five districts of Vice Harbor, each with its own palette, roof shapes, prop mix and
// street furniture. Everything downstream asks this file "what does the block at column i,
// row j look like", so the city reads as one designed place rather than one repeated tile.

export const DISTRICTS = {
  downtown: {
    id: 'downtown',
    name: 'Kessler Heights',
    ground: '#23262e',
    sidewalk: '#3b3f4a',
    blockFloor: '#2a2d36',
    roofs: ['#4a5265', '#3f4658', '#565f74', '#454d61'],
    walls: ['#2b3140', '#333a4b', '#262b38'],
    trim: ['#8fa3c8', '#b9c8e6', '#6f8099'],
    neon: ['#ff5f7a', '#57e0ff', '#ffd166', '#c084fc'],
    accent: '#57e0ff',
    buildingHeight: [70, 130],
    traffic: 0.9,
    pedestrians: 1.0,
  },
  docks: {
    id: 'docks',
    name: 'Pier Nine',
    ground: '#2a2723',
    sidewalk: '#4a453c',
    blockFloor: '#332f2a',
    roofs: ['#7a4a32', '#6b5a44', '#8a5b3a', '#5c5347'],
    walls: ['#4a3426', '#3f342a', '#54402e'],
    trim: ['#d98b4a', '#e0b070', '#9a7a55'],
    neon: ['#ffb347', '#ff7b54'],
    accent: '#ffb347',
    buildingHeight: [26, 46],
    traffic: 0.7,
    pedestrians: 0.7,
  },
  beach: {
    id: 'beach',
    name: 'Marisol Strip',
    ground: '#c9b48d',
    sidewalk: '#e6dcc4',
    blockFloor: '#d8c9a8',
    roofs: ['#f3e3c8', '#e8c9b0', '#f7d9c4', '#efe0c0'],
    walls: ['#d9b294', '#c9a58c', '#e8c7ae'],
    trim: ['#ff8fa3', '#57c9c0', '#ffd166'],
    neon: ['#ff6f91', '#4ce0d2', '#ffd166'],
    accent: '#ff8fa3',
    buildingHeight: [30, 54],
    traffic: 0.8,
    pedestrians: 1.2,
  },
  park: {
    id: 'park',
    name: 'Vidal Green',
    ground: '#3f6b45',
    sidewalk: '#8a8a72',
    blockFloor: '#43724a',
    roofs: ['#4d7a52'],
    walls: ['#3c5c40'],
    trim: ['#7fb069'],
    neon: ['#9ae66e'],
    accent: '#9ae66e',
    buildingHeight: [0, 0],
    traffic: 0.3,
    pedestrians: 1.1,
  },
  residential: {
    id: 'residential',
    name: 'Larkspur Row',
    ground: '#4a4a4f',
    sidewalk: '#6f6f78',
    blockFloor: '#3f4a3c',
    roofs: ['#8a5a4a', '#6a7f8f', '#a8846a', '#7a6a8a', '#5f7a6a'],
    walls: ['#5a4a44', '#4f5a60', '#6a5a52'],
    trim: ['#e8d9b0', '#c8d8e8', '#f0c8a0'],
    neon: ['#ffd166'],
    accent: '#ffd166',
    buildingHeight: [20, 38],
    traffic: 0.6,
    pedestrians: 0.9,
  },
};

/** Which district a grid block belongs to, from its column and row. */
export function districtForBlock(column, row) {
  if (row >= 4) return DISTRICTS.docks;
  if (row <= 1 && column >= 3) return DISTRICTS.downtown;
  if (column === 5) return DISTRICTS.beach;
  if (column >= 1 && column <= 2 && row >= 1 && row <= 2) return DISTRICTS.park;
  return DISTRICTS.residential;
}

/** The name shown when the player crosses into a new neighbourhood. */
export function districtLabelAt(block) {
  return block ? block.district.name : 'Vice Harbor';
}
