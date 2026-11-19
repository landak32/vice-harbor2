// Boot and the one loop. The world advances in fixed 1/60 s steps whatever the display does, the
// renderer paints one letterboxed 1280x720 frame, and the menu state machine sits on top. With
// ?shot=<name>&seed=<n> the page stages a real scene instead and paints it once for a screenshot.

import { Game } from './game.js';
import { createRenderer } from './render/scene-renderer.js';
import { KeyboardMouse } from './core/keyboard-mouse.js';
import { stageScene } from './shots/staged-scenes.js';
import { retryMission } from './systems/mission-story.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.2;

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261119;

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const game = new Game(seed);
const renderer = createRenderer(canvas);
const input = new KeyboardMouse(canvas);

// A small handle for debugging and for the screenshot harness to wait on.
window.__viceHarbor = { game, renderer, input };

function syncViewport() {
  input.setViewport(renderer.view.scale, renderer.view.offsetX, renderer.view.offsetY);
}

function unlockAudio() {
  game.sound.unlock();
  syncViewport();
}

window.addEventListener('keydown', unlockAudio, { once: true });
window.addEventListener('pointerdown', unlockAudio, { once: true });
window.addEventListener('resize', syncViewport);

function announce(message) {
  if (statusLine) statusLine.textContent = message;
}

if (shotName) {
  stageScene(shotName, game, seed);
  syncViewport();
  let painted = 0;
  window.__shotReady = false;
  function paintShot() {
    renderer.draw(game, null);
    painted += 1;
    if (painted >= 2) window.__shotReady = true;
    requestAnimationFrame(paintShot);
  }
  requestAnimationFrame(paintShot);
} else {
  runGame();
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  let lastMode = 'title';

  function titleMenu() {
    const count = 3;
    if (input.wasPressed('ArrowUp', 'KeyW')) {
      game.menuSelection = (game.menuSelection + count - 1) % count;
      game.sound.blip(true);
    }
    if (input.wasPressed('ArrowDown', 'KeyS')) {
      game.menuSelection = (game.menuSelection + 1) % count;
      game.sound.blip(true);
    }
    if (input.wasPressed('Enter', 'Space', 'Mouse0')) {
      if (game.menuSelection === 0) {
        game.newGame();
        announce('Vice Harbor. Meet Marisol Vega at the garage.');
      } else if (game.menuSelection === 1) {
        if (game.hasSaveFile && game.loadGame()) {
          game.mode = 'play';
          announce('Continuing your saved game.');
        } else {
          game.sound.blip(false);
          announce('No saved game yet.');
        }
      } else {
        game.mode = 'controls';
      }
    }
  }

  function pauseMenu() {
    if (game.pausePanel !== 'main') {
      if (input.wasPressed('Escape', 'Enter', 'Space', 'Mouse0')) game.pausePanel = 'main';
      return;
    }
    const count = 5;
    if (input.wasPressed('ArrowUp', 'KeyW')) {
      game.menuSelection = (game.menuSelection + count - 1) % count;
      game.sound.blip(true);
    }
    if (input.wasPressed('ArrowDown', 'KeyS')) {
      game.menuSelection = (game.menuSelection + 1) % count;
      game.sound.blip(true);
    }
    if (input.wasPressed('Escape', 'KeyP')) {
      game.mode = 'play';
      return;
    }
    if (input.wasPressed('Enter', 'Space', 'Mouse0')) {
      if (game.menuSelection === 0) game.mode = 'play';
      else if (game.menuSelection === 1) game.pausePanel = 'controls';
      else if (game.menuSelection === 2) game.pausePanel = 'stats';
      else if (game.menuSelection === 3) game.saveGame();
      else {
        game.mode = 'title';
        game.menuSelection = 0;
        game.hasSaveFile = game.hasSaveFile;
        game.sound.stopEngine();
      }
    }
  }

  function handleMenus() {
    if (game.mode === 'title') {
      titleMenu();
      return;
    }
    if (game.mode === 'controls') {
      if (input.wasPressed('Escape', 'Enter', 'Space', 'Mouse0')) game.mode = 'title';
      return;
    }
    if (game.mode === 'play') {
      if (input.wasPressed('KeyM')) game.showCityMap = !game.showCityMap;
      if (input.wasPressed('Escape', 'KeyP')) {
        if (game.showCityMap) game.showCityMap = false;
        else {
          game.mode = 'paused';
          game.menuSelection = 0;
          game.pausePanel = 'main';
          game.sound.stopEngine();
          game.sound.setSiren(false);
        }
      }
      return;
    }
    if (game.mode === 'paused') {
      pauseMenu();
      return;
    }
    if (game.mode === 'dead') {
      if (input.wasPressed('Enter', 'Space', 'Mouse0')) {
        game.respawnAfterDeath();
        announce('You woke up at Vidal General.');
      }
      return;
    }
    if (game.mode === 'busted') {
      if (input.wasPressed('Enter', 'Space', 'Mouse0')) {
        game.respawnAfterArrest();
        announce('Released from Harbor PD.');
      }
      return;
    }
    if (game.mode === 'failed') {
      if (input.wasPressed('Enter', 'Space', 'Mouse0')) {
        retryMission(game);
        game.mode = 'play';
      } else if (input.wasPressed('Escape')) {
        game.mode = 'title';
        game.menuSelection = 0;
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;

    handleMenus();

    if (game.mode === 'play') {
      accumulator += elapsed;
      let steps = 0;
      while (accumulator >= STEP && steps < 6 && game.mode === 'play') {
        game.update(STEP, input);
        accumulator -= STEP;
        steps += 1;
      }
      if (game.mode === 'play' && game.missions.status === 'failed') {
        game.mode = 'failed';
        game.sound.stopEngine();
        game.sound.setSiren(false);
      }
    } else {
      accumulator = 0;
      game.update(elapsed, input);
    }

    if (game.mode !== lastMode) {
      lastMode = game.mode;
      if (game.mode === 'title') announce('Vice Harbor. New game, continue or controls.');
      else if (game.mode === 'paused') announce('Paused.');
      else if (game.mode === 'play') announce('Playing.');
    }

    renderer.draw(game, game.mode === 'play' && !game.showCityMap ? input.mouse : null);
    input.endFrame();
  }

  syncViewport();
  announce('Vice Harbor. Press Enter to start.');
  requestAnimationFrame(frame);
}
