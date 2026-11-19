// The things the city leaves lying around: health kits outside a pharmacy, body armour in an
// alley, boxes of pistol and SMG rounds, and the cash a fallen gunman drops. Each bobs in place
// and is collected by walking over it.

import { distance } from '../core/geometry.js';

const PICKUP_RADIUS = 34;

export function createPickup(type, x, y, amount = 1) {
  return {
    type,
    x,
    y,
    amount,
    bob: ((x * 0.37 + y * 0.11) % 6.283),
    life: type === 'cash' ? 40 : Infinity,
    collected: false,
  };
}

export function populatePickups(game) {
  const spots = [
    ['health', 640, 1310], ['health', 2320, 780], ['health', 3560, 2380],
    ['armour', 1120, 2180], ['armour', 2720, 1680],
    ['pistol', 1460, 640], ['pistol', 3060, 2860],
    ['smg', 980, 2760], ['smg', 3320, 1180],
  ];
  for (let i = 0; i < spots.length; i += 1) {
    const [type, x, y] = spots[i];
    game.pickups.push(createPickup(type, x, y, type === 'pistol' ? 24 : type === 'smg' ? 60 : type === 'health' ? 40 : 50));
  }
}

export function updatePickups(game, dt) {
  const player = game.player;
  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = game.pickups[i];
    pickup.bob += dt * 2.4;
    if (pickup.life !== Infinity) {
      pickup.life -= dt;
      if (pickup.life <= 0) {
        game.pickups.splice(i, 1);
        continue;
      }
    }
    if (!player.alive) continue;
    if (distance(player.x, player.y, pickup.x, pickup.y) > PICKUP_RADIUS) continue;
    if (collectPickup(game, pickup)) {
      game.pickups.splice(i, 1);
      game.sound.blip(true);
      game.toast(pickupLabel(pickup));
    }
  }
}

export function collectPickup(game, pickup) {
  const player = game.player;
  if (pickup.type === 'health') {
    if (player.health >= player.maxHealth) return false;
    player.health = Math.min(player.maxHealth, player.health + pickup.amount);
    return true;
  }
  if (pickup.type === 'armour') {
    if (player.armour >= 100) return false;
    player.armour = Math.min(100, player.armour + pickup.amount);
    return true;
  }
  if (pickup.type === 'pistol') {
    player.unlocked.pistol = true;
    player.ammo.pistol = Math.min(120, (player.ammo.pistol ?? 0) + pickup.amount);
    if (player.weapon === 'fists') player.weapon = 'pistol';
    return true;
  }
  if (pickup.type === 'smg') {
    player.unlocked.smg = true;
    player.ammo.smg = Math.min(300, (player.ammo.smg ?? 0) + pickup.amount);
    player.weapon = 'smg';
    return true;
  }
  if (pickup.type === 'cash') {
    game.earn(pickup.amount, 'pickup');
    return true;
  }
  return false;
}

export function pickupLabel(pickup) {
  if (pickup.type === 'health') return 'Health restored';
  if (pickup.type === 'armour') return 'Body armour';
  if (pickup.type === 'pistol') return 'Pistol ammo';
  if (pickup.type === 'smg') return 'SMG acquired';
  return 'Cash picked up';
}

export function dropCash(game, x, y, amount) {
  game.pickups.push(createPickup('cash', x, y, amount));
}
