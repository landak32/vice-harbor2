// Two ways to make money that never run out: taxi fares (pick up a fare in a cab, drive them
// across town before the meter runs out) and courier runs (collect a parcel on foot, deliver it
// by car). Both put their own marker on the minimap and pay on arrival.

import { distance } from '../core/geometry.js';
import { roadPointNear } from '../world/city-queries.js';

export function createSideJobBoard() {
  return {
    active: null,
    completed: 0,
    cooldown: 0,
    lastResult: '',
    prompt: '',
  };
}

function randomDropoff(game, fromX, fromY) {
  const spot = roadPointNear(game.city, fromX, fromY, 700, 1900, game.rng);
  return { x: spot.x + 26, y: spot.y + 26 };
}

export function startTaxiFare(game) {
  const board = game.sideJobs;
  if (board.active || board.cooldown > 0) return false;
  const player = game.player;
  if (!player.vehicle || player.vehicle.type !== 'taxi') return false;
  const pickup = randomDropoff(game, player.x, player.y);
  board.active = {
    kind: 'taxi',
    stage: 'pickup',
    pickup,
    dropoff: randomDropoff(game, pickup.x, pickup.y),
    timer: 0,
    limit: 150,
    payout: 240,
    fare: 0,
  };
  game.toast('Fare flagged down: pick them up');
  game.sound.blip(true);
  return true;
}

export function startCourierRun(game) {
  const board = game.sideJobs;
  if (board.active || board.cooldown > 0) return false;
  const player = game.player;
  if (player.vehicle) {
    game.toast('Courier runs start on foot at the depot');
    return false;
  }
  const depot = game.city.landmarks.courierDepot;
  if (distance(player.x, player.y, depot.x, depot.y) > 220) {
    game.toast('Find the freight depot on Pier Nine to take a run');
    return false;
  }
  const pickup = { x: depot.x, y: depot.y };
  board.active = {
    kind: 'courier',
    stage: 'pickup',
    pickup,
    dropoff: randomDropoff(game, pickup.x, pickup.y),
    timer: 0,
    limit: 120,
    payout: 200,
    fare: 0,
  };
  game.toast('Parcel ready: collect it from the depot');
  game.sound.blip(true);
  return true;
}

export function updateSideJobs(game, dt) {
  const board = game.sideJobs;
  board.cooldown = Math.max(0, board.cooldown - dt);
  board.prompt = '';
  const player = game.player;

  if (!board.active) {
    if (player.vehicle && player.vehicle.type === 'taxi') board.prompt = 'Press T to take a fare';
    else if (!player.vehicle && distance(player.x, player.y, game.city.landmarks.courierDepot.x, game.city.landmarks.courierDepot.y) < 220) {
      board.prompt = 'Press C to take a courier run';
    }
    return;
  }

  const job = board.active;
  job.timer += dt;

  if (job.timer > job.limit) {
    board.active = null;
    board.cooldown = 6;
    board.lastResult = 'Job expired';
    game.toast('The job expired: no pay');
    game.sound.blip(false);
    return;
  }

  if (job.stage === 'pickup') {
    if (distance(player.x, player.y, job.pickup.x, job.pickup.y) < 70) {
      job.stage = 'dropoff';
      job.payout += Math.round(job.timer * 1.5);
      game.toast(job.kind === 'taxi' ? 'Fare aboard: drive to the pin' : 'Parcel aboard: deliver it');
      game.sound.blip(true);
    }
    return;
  }

  if (distance(player.x, player.y, job.dropoff.x, job.dropoff.y) < 80) {
    const pay = job.payout;
    board.active = null;
    board.cooldown = 4;
    board.completed += 1;
    board.lastResult = `Paid $${pay}`;
    game.earn(pay, 'sidejob');
    game.stats.sideJobs += 1;
    game.toast(`Job done: +$${pay}`);
    game.sound.cash();
  }
}

export function sideJobMarker(board) {
  if (!board.active) return null;
  const job = board.active;
  const point = job.stage === 'pickup' ? job.pickup : job.dropoff;
  return { x: point.x, y: point.y, radius: 40, kind: job.stage === 'pickup' ? 'pickup' : 'dropoff' };
}

export function sideJobObjective(board) {
  if (!board.active) return '';
  const job = board.active;
  const left = Math.max(0, Math.ceil(job.limit - job.timer));
  if (job.kind === 'taxi') return job.stage === 'pickup' ? `Taxi: pick up the fare (${left}s)` : `Taxi: drive the fare to the pin (${left}s)`;
  return job.stage === 'pickup' ? `Courier: collect the parcel (${left}s)` : `Courier: deliver the parcel (${left}s)`;
}

export function cancelSideJob(board) {
  if (!board.active) return false;
  board.active = null;
  board.cooldown = 5;
  return true;
}
