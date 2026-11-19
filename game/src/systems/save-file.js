// Saving and continuing. One localStorage slot holds money, mission progress, weapons, health and
// where the player stood, so closing the tab and coming back picks the story up where it stopped.
// Every storage call is guarded: a private window simply plays without saving.

const SLOT = 'vice-harbor.save.v1';

function storage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function hasSave() {
  const store = storage();
  if (!store) return false;
  try {
    return Boolean(store.getItem(SLOT));
  } catch {
    return false;
  }
}

export function readSave() {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(SLOT);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || !data.player) return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(game) {
  const store = storage();
  if (!store) return false;
  try {
    const payload = {
      version: 1,
      savedAt: Date.now(),
      money: game.money,
      hour: game.clock.hour,
      missionIndex: game.missions.index,
      missionStage: game.missions.stage,
      sideJobsDone: game.sideJobs.completed,
      stats: game.stats,
      player: {
        x: game.player.x,
        y: game.player.y,
        health: game.player.health,
        armour: game.player.armour,
        weapon: game.player.weapon,
        unlocked: game.player.unlocked,
        ammo: game.player.ammo,
      },
    };
    store.setItem(SLOT, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function applySave(game, data) {
  if (!data) return false;
  game.money = Number.isFinite(data.money) ? data.money : game.money;
  if (Number.isFinite(data.hour)) game.clock.hour = data.hour;
  game.missions.index = Math.max(0, Math.min(game.missions.missions.length - 1, data.missionIndex ?? 0));
  game.missions.stage = 0;
  game.sideJobs.completed = data.sideJobsDone ?? 0;
  if (data.stats) Object.assign(game.stats, data.stats);
  const player = game.player;
  if (data.player) {
    if (Number.isFinite(data.player.x)) player.x = data.player.x;
    if (Number.isFinite(data.player.y)) player.y = data.player.y;
    if (Number.isFinite(data.player.health)) player.health = data.player.health;
    if (Number.isFinite(data.player.armour)) player.armour = data.player.armour;
    if (data.player.unlocked) Object.assign(player.unlocked, data.player.unlocked);
    if (data.player.ammo) Object.assign(player.ammo, data.player.ammo);
    if (data.player.weapon && player.unlocked[data.player.weapon]) player.weapon = data.player.weapon;
  }
  return true;
}

export function deleteSave() {
  const store = storage();
  if (!store) return;
  try {
    store.removeItem(SLOT);
  } catch {
    // Nothing to do: the slot was never written.
  }
}
