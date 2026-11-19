// The story of Vice Harbor, six jobs deep: a delivery, a chase, a shootout, a heist, an escape and
// a last stand. Each job is a small state machine with a marker in the world, an objective line on
// the HUD, dialogue with a portrait, a fail state (death, leaving the area, running out of time)
// and a retry. Marisol Vega and her crew are the ones handing out the work.

import { distance } from '../core/geometry.js';
import { createGunman } from '../entities/armed-npcs.js';
import { createVehicle } from '../entities/vehicle-physics.js';
import { addHeat } from './wanted-level.js';

export const CONTACTS = {
  marisol: { name: 'Marisol Vega', skin: '#c98a5a', hair: '#2b1a12', shirt: '#e0576f', accent: '#ff8fa3', role: 'Fixer' },
  tino: { name: 'Tino Quintero', skin: '#8a5a3a', hair: '#141414', shirt: '#3f7a8a', accent: '#57e0ff', role: 'Wheelman' },
  nadia: { name: 'Nadia Kessler', skin: '#f0c8a0', hair: '#c9a86a', shirt: '#2b3140', accent: '#ffd166', role: 'Broker' },
  salazar: { name: 'Ruben Salazar', skin: '#d8a878', hair: '#1a1a1a', shirt: '#7a2b3a', accent: '#e8402a', role: 'Rival crew' },
};

/** One line of dialogue: who says it and what they say. */
function line(who, text) {
  return { who, text };
}

function marker(x, y, radius = 46) {
  return { x, y, radius };
}

const GARAGE = { x: 900, y: 2260 };
const PIER = { x: 1044, y: 3160 };
const BANK = { x: 2060, y: 790 };
const MARINA = { x: 3800, y: 2960 };
const SAFEHOUSE = { x: 1480, y: 1410 };
const DOCKSIDE = { x: 1520, y: 2880 };

const MISSION_CHAIN = [
  {
    id: 'first-shift',
    title: 'First Shift',
    contact: 'marisol',
    start: GARAGE,
    reward: 650,
    brief: 'Take the hauler down to Pier Nine. Do not open the back.',
    setup(game, m) {
      const van = createVehicle('van', GARAGE.x + 40, GARAGE.y - 30, 0, { color: '#e8e2d0', missionTag: 'hauler' });
      van.health = 220;
      van.maxHealth = 220;
      game.vehicles.push(van);
      m.data.van = van;
      m.data.delivered = false;
    },
    update(game, m, dt) {
      const van = m.data.van;
      const inVan = game.player.vehicle === van;
      if (!m.data.delivered) {
        if (inVan) {
          m.objective = 'Drive the hauler to Pier Nine';
          m.marker = marker(PIER.x, PIER.y, 60);
          if (distance(van.x, van.y, PIER.x, PIER.y) < 90) {
            m.data.delivered = true;
            return 'done';
          }
        } else {
          m.objective = 'Get in the hauler at Quintero Garage';
          m.marker = marker(van.x, van.y, 40);
        }
        m.timer += dt;
        if (m.timer > 260) return 'failed:time';
        return 'running';
      }
      return 'done';
    },
  },
  {
    id: 'bad-debt',
    title: 'Bad Debt',
    contact: 'tino',
    start: { x: 2640, y: 1400 },
    reward: 950,
    brief: 'A debtor is running his mouth in a silver sedan. Put the car in the wall.',
    setup(game, m) {
      const target = createVehicle('sedan', 2720, 1400, 0, { color: '#c8ccd4', driver: 'ai', missionTag: 'debtor' });
      target.health = 120;
      target.aiKind = 'flee';
      target.cruise = 320;
      game.vehicles.push(target);
      m.data.target = target;
      m.data.escaped = 0;
    },
    update(game, m, dt) {
      const target = m.data.target;
      m.objective = 'Wreck the debtor\'s sedan';
      m.marker = marker(target.x, target.y, 40);
      if (target.wrecked || target.health <= 0) return 'done';
      if (distance(target.x, target.y, game.player.x, game.player.y) > 2200) {
        m.data.escaped += dt;
        if (m.data.escaped > 12) return 'failed:area';
      } else {
        m.data.escaped = 0;
      }
      m.timer += dt;
      if (m.timer > 200) return 'failed:time';
      return 'running';
    },
  },
  {
    id: 'sunset-shakedown',
    title: 'Sunset Shakedown',
    contact: 'marisol',
    start: { x: 900, y: 2900 },
    reward: 1400,
    brief: 'Salazar\'s boys are leaning on the pier. Lean back.',
    setup(game, m) {
      const spots = [
        [PIER.x - 90, PIER.y - 120], [PIER.x + 80, PIER.y - 150],
        [PIER.x - 40, PIER.y - 220], [PIER.x + 130, PIER.y - 60],
      ];
      for (let i = 0; i < spots.length; i += 1) {
        game.spawnThug(spots[i][0], spots[i][1], { guard: false, health: 65 });
      }
      m.data.kills = 0;
      m.data.needed = spots.length;
      m.data.startKills = game.stats.kills;
    },
    update(game, m, dt) {
      m.objective = `Clear the pier (${Math.min(m.data.needed, game.stats.kills - m.data.startKills)}/${m.data.needed})`;
      const living = game.gunmen.filter((actor) => actor.faction === 'thug' && actor.health > 0).length;
      if (living === 0) return 'done';
      m.marker = marker(PIER.x, PIER.y - 120, 130);
      m.timer += dt;
      if (distance(game.player.x, game.player.y, PIER.x, PIER.y) > 1600) {
        m.data.escaped = (m.data.escaped ?? 0) + dt;
        if (m.data.escaped > 8) return 'failed:area';
      } else {
        m.data.escaped = 0;
      }
      if (m.timer > 300) return 'failed:time';
      return 'running';
    },
  },
  {
    id: 'the-ledger',
    title: 'The Ledger',
    contact: 'nadia',
    start: BANK,
    reward: 2600,
    brief: 'The ledger is in the Kessler Heights vault. Take it, then lose the heat.',
    setup(game, m) {
      m.data.grabbed = false;
      m.data.alarm = false;
    },
    update(game, m, dt) {
      m.timer += dt;
      if (!m.data.grabbed) {
        m.objective = 'Get inside the Kessler Heights bank';
        m.marker = marker(BANK.x, BANK.y, 60);
        if (distance(game.player.x, game.player.y, BANK.x, BANK.y) < 70) {
          m.data.grabbed = true;
          m.data.alarm = true;
          addHeat(game.wanted, 120, 'armed robbery');
          game.toast('Alarm tripped: the ledger is yours, now run');
          game.sound.alarm();
          game.effects.shake(4);
        }
        if (m.timer > 240) return 'failed:time';
        return 'running';
      }
      m.objective = 'Lose the cops, then reach Quintero Garage';
      m.marker = marker(GARAGE.x, GARAGE.y, 60);
      if (distance(game.player.x, game.player.y, GARAGE.x, GARAGE.y) < 80) {
        if (game.wanted.stars > 0) {
          m.objective = 'Shake the pursuit before you go to ground';
          return 'running';
        }
        return 'done';
      }
      if (m.timer > 420) return 'failed:time';
      return 'running';
    },
  },
  {
    id: 'heat-wave',
    title: 'Heat Wave',
    contact: 'tino',
    start: SAFEHOUSE,
    reward: 3200,
    brief: 'They are tearing the city apart for you. Sit in it, then get to the marina.',
    setup(game, m) {
      addHeat(game.wanted, 230, 'the whole force is looking');
      m.data.survived = 0;
      m.data.required = 40;
    },
    update(game, m, dt) {
      m.data.survived += dt;
      if (m.data.survived < m.data.required) {
        m.objective = `Stay alive: ${Math.ceil(m.data.required - m.data.survived)}s`;
        m.marker = null;
        if (game.wanted.stars < 2) addHeat(game.wanted, 40, 'heat');
      } else {
        m.objective = 'Reach the marina on the coast road';
        m.marker = marker(MARINA.x, MARINA.y, 70);
        if (distance(game.player.x, game.player.y, MARINA.x, MARINA.y) < 100) return 'done';
      }
      if (m.data.survived > 240) return 'failed:time';
      return 'running';
    },
  },
  {
    id: 'last-call',
    title: 'Last Call',
    contact: 'salazar',
    start: DOCKSIDE,
    reward: 6000,
    brief: 'Salazar is at the docks with what is left of his crew. End it.',
    setup(game, m) {
      game.spawnThug(DOCKSIDE.x - 80, DOCKSIDE.y - 60, { guard: true });
      game.spawnThug(DOCKSIDE.x + 70, DOCKSIDE.y - 40, { guard: true });
      game.spawnThug(DOCKSIDE.x + 10, DOCKSIDE.y - 140, { guard: true, health: 90 });
      const boss = game.spawnThug(DOCKSIDE.x, DOCKSIDE.y - 200, { guard: true, health: 180, boss: true });
      boss.faction = 'boss';
      m.data.boss = boss;
      m.data.started = true;
    },
    update(game, m, dt) {
      m.timer += dt;
      const boss = m.data.boss;
      if (boss && boss.health > 0) {
        m.objective = 'Take down Ruben Salazar';
        m.marker = marker(boss.x, boss.y, 40);
        if (m.timer > 400) return 'failed:time';
        return 'running';
      }
      m.objective = 'Get out of the harbor and reach Vidal General';
      m.marker = marker(690, 1440, 70);
      addHeat(game.wanted, 60, 'shootout at the docks');
      if (distance(game.player.x, game.player.y, 690, 1440) < 100) return 'done';
      if (m.timer > 600) return 'failed:time';
      return 'running';
    },
  },
];

export function createMissionDirector() {
  return {
    missions: MISSION_CHAIN,
    index: 0,
    status: 'idle',
    objective: '',
    marker: null,
    dialogue: null,
    timer: 0,
    failReason: '',
    data: {},
    flash: 0,
  };
}

export function currentMission(director) {
  return director.missions[Math.min(director.index, director.missions.length - 1)];
}

export function missionStartMarker(director) {
  const mission = currentMission(director);
  if (!mission || director.index >= director.missions.length) return null;
  return { x: mission.start.x, y: mission.start.y, radius: 50, kind: 'start' };
}

export function beginDialogue(director, lines, portraitKey) {
  if (!lines || lines.length === 0) return;
  director.dialogue = {
    lines,
    index: 0,
    portrait: portraitKey,
    timer: 0,
    speaker: lines[0].who,
    text: lines[0].text,
  };
}

export function advanceDialogue(director) {
  if (!director.dialogue) return;
  const dialogue = director.dialogue;
  dialogue.index += 1;
  if (dialogue.index >= dialogue.lines.length) {
    director.dialogue = null;
    return;
  }
  dialogue.timer = 0;
  dialogue.speaker = dialogue.lines[dialogue.index].who;
  dialogue.text = dialogue.lines[dialogue.index].text;
}

export function updateDialogue(director, dt) {
  if (!director.dialogue) return;
  director.dialogue.timer += dt;
  if (director.dialogue.timer > 7) advanceDialogue(director);
}

export function startMission(game) {
  const director = game.missions;
  const mission = currentMission(director);
  director.status = 'running';
  director.timer = 0;
  director.data = {};
  director.failReason = '';
  mission.setup(game, director);
  director.objective = mission.brief;
  director.marker = marker(mission.start.x, mission.start.y, 50);
  const intro = [
    line(CONTACTS[mission.contact].name, mission.brief),
    line('You', mission.id === 'the-ledger' ? 'In and out. Nobody has to get hurt.' : 'On it.'),
  ];
  beginDialogue(director, intro, mission.contact);
  game.sound.blip(true);
  game.toast(`Job started: ${mission.title}`);
}

export function completeMission(game) {
  const director = game.missions;
  const mission = currentMission(director);
  game.earn(mission.reward, 'mission');
  game.stats.missions += 1;
  director.status = 'idle';
  director.index = Math.min(director.index + 1, director.missions.length);
  director.marker = null;
  director.objective = '';
  director.dialogue = null;
  if (mission.id === 'the-ledger') {
    game.player.unlocked.smg = true;
    game.player.ammo.smg = Math.max(game.player.ammo.smg, 90);
    game.player.weapon = 'smg';
    game.toast('SMG unlocked: Nadia left one in the garage');
  }
  game.toast(`Job complete: ${mission.title} +$${mission.reward}`);
  game.sound.cash();
  game.saveGame();
}

export function failMission(game, reason) {
  const director = game.missions;
  if (director.status !== 'running') return;
  director.status = 'failed';
  director.failReason = reason;
  game.sound.blip(false);
}

export function retryMission(game) {
  const director = game.missions;
  director.status = 'idle';
  director.timer = 0;
  director.data = {};
  director.failReason = '';
  director.objective = '';
  director.dialogue = null;
  game.respawnPlayerAt(currentMission(director).start.x, currentMission(director).start.y, { cost: 0 });
}

/** The frame-by-frame driver: mission state, objective text and the world marker. */
export function updateMissions(game, dt) {
  const director = game.missions;
  updateDialogue(director, dt);
  director.flash = Math.max(0, director.flash - dt);

  if (director.staged) return;

  if (director.index >= director.missions.length) {
    director.status = 'idle';
    director.marker = null;
    director.objective = 'All six jobs done. The city is yours.';
    return;
  }

  const mission = currentMission(director);

  if (director.status === 'idle') {
    director.marker = missionStartMarker(director);
    director.objective = `Meet ${CONTACTS[mission.contact].name} for "${mission.title}"`;
    if (game.mode === 'play' && distance(game.player.x, game.player.y, mission.start.x, mission.start.y) < 60) {
      startMission(game);
    }
    return;
  }

  if (director.status === 'failed') return;

  if (director.status === 'running') {
    director.timer += 0;
    const result = mission.update(game, director, dt);
    if (result === 'done') {
      completeMission(game);
    } else if (typeof result === 'string' && result.startsWith('failed:')) {
      const reason = result.split(':')[1];
      failMission(game, reason);
    }
  }
}

export function failReasonText(reason) {
  if (reason === 'time') return 'You ran out of time.';
  if (reason === 'area') return 'You left the job behind.';
  if (reason === 'death') return 'You were killed.';
  if (reason === 'busted') return 'You were arrested.';
  return 'The job went south.';
}

/** Side job briefs share the dialogue box with the story. */
export function sayLine(game, who, text) {
  const portrait = Object.keys(CONTACTS).find((key) => CONTACTS[key].name === who) ?? 'marisol';
  beginDialogue(game.missions, [line(who, text)], portrait);
}
