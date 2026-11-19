# Vice Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/landak32/vice-harbor2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/landak32/vice-harbor2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Vice Harbor is a top-down open-world crime game that runs entirely in a desktop browser tab. You walk a
city of five districts, take cars off the street, and work your way through six jobs for a crew that
runs the harbor. There is traffic on the avenues, crowds on the pavements, a police force that answers
every crime you commit, and a five-star wanted level that only cools once you break line of sight.

Everything is drawn procedurally on a 2D canvas: the road grid, the lane paint and zebra crossings, the
buildings with their roofs, air-conditioning units and awnings, the palms and lamp posts, the cars, the
people, the portraits in the dialogue boxes and the minimap. Every sound is synthesised with WebAudio —
engines, gunfire, sirens, horns, and a bass-and-percussion soundtrack that hardens as the wanted level
climbs. The entry ships no images, no audio files and no fonts.

It is plain ES modules under `game/src/`, one job per file, with no build step, no bundler, no library
and no network request of any kind. `game/index.html` opens and plays from any static file server. The
simulation runs on a fixed 1/60 s step with a seeded random number generator, so a given seed always
produces the same city and the same frame — which is how the four screenshots in `screenshots/` were
staged from the real game with an autopilot.

## What's in it

- **A city of five districts** — Kessler Heights' downtown towers, the Pier Nine docks with containers
  and warehouses, the Marisol Strip beachfront, Vidal Green park, and Larkspur Row's houses — on a road
  grid with lane markings, kerbs, crosswalks, working traffic lights, a shoreline, piers and props.
- **On foot** — walk, sprint and stop with real acceleration and friction, eight-direction facing, a
  footstep bob, fists, pistol and SMG, health, armour and a red vignette as it runs out.
- **Six vehicle classes** — a sports car, a sedan, a van, a taxi, a police cruiser and a flatbed truck,
  each with its own top speed, grip, mass and brakes, arcade steering and drift, tyre marks, collision
  damage and a smoking engine once wrecked.
- **Traffic and crowds** — AI drivers that keep to the right-hand lane, stop at red lights and for
  whatever is in front of them, honk when they have waited too long and swerve when shots are fired;
  pedestrians that walk the pavement loops, cross at the corners, panic and go down.
- **A 1–5 star wanted level** — heat from every crime, cruisers spawning off-screen, officers bailing
  out with pistols at two stars, and a level that decays only after the police lose sight of you.
- **Six story missions and two side jobs** — a delivery, a chase, a shootout, a heist, an escape and a
  last stand, each with a world marker, an objective line, dialogue and portraits, a fail state and a
  retry, plus repeatable taxi fares and courier runs that pay.
- **Progression and a save** — money, weapon unlocks, mission progress and a career stats screen, saved
  to `localStorage` and loaded from the Continue entry on the title screen.
- **A HUD and a minimap** — a minimap drawn from the real city data with the player arrow, police blips
  and job markers, health and armour bars, money, weapon and ammo, flashing wanted stars, toasts and the
  dialogue box, over a day/night cycle with headlights, neon and camera shake.

## The four screenshots

`1-chase.jpg` is the cover: a stolen sports car downtown at night with three cruisers on its tail and
three stars lit. `2-foot.jpg` is the player on a crowded pavement, pistol drawn, with a job marker up the
street. `3-drive.jpg` cruises the coast road at sunset with the beach and the sea on one side.
`4-mission.jpg` is the dockside shootout mid-job, dialogue open and health nearly gone.

## Run it

```sh
node serve.ts
```

Then open <http://localhost:8080>. Add `?shot=chase&seed=7` (or `foot`, `drive`, `mission`) to stage one
of the screenshot scenes.

## Controls

- **WASD** or the **arrow keys** to move and to steer
- **E** to enter or leave a vehicle
- **Space** to sprint on foot, and as the handbrake in a car
- **Left click** or **J** to fire
- **Esc** to pause

Also: **1 2 3** switch between fists, pistol and SMG, **T** starts a taxi fare while driving a cab,
**C** starts a courier run at the freight depot, and **M** opens the city map.

## Handing it in

`main.ts` is the entrypoint: it copies `game/` and `screenshots/` to `$MAKEFUN_OUTPUT_DIR` (or `/output`),
writes `dossier.json` with the vendored make.fun library, then prints how many files and bytes of `game/`
were shipped so a run can be read at a glance.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Built for [make.fun's "Make GTA 6" bounty](https://make.fun/bounty/gta6-01?ref=ab07whaf).
