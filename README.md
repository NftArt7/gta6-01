# Solmar City — Open-World Heist

[![gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/NftArt7/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/NftArt7/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original open-world crime game for the make.fun **gta6-01** bounty — a
complete rendition of the genre, built from scratch in the browser with
[three.js](https://threejs.org/) (vendored under `game/vendor/`).

## The game

You are a newcomer in **Solmar City**, a sun-baked coastal town of tower
blocks, palm avenues, a beach and a working dock. Steal a car, dodge the
Solmar police, and run four story jobs to own the city:

1. **Hot Wheels** — steal a car and deliver it to the Paint Shop.
2. **Dockside Drop** — grab a package at the Solmar Docks on foot and deliver it uptown.
3. **Heat Wave** — lose a 2-star wanted level by staying out of sight.
4. **Solmar Sprint** — a timed getaway through five green gates.

After the last job the city is yours, and free roam continues.

### Systems

- **A procedural city** — a seeded road grid of textured towers, a park with a fountain, palms, a beach and ocean, wooden docks, a paint shop, street lights and a day sky.
- **On foot and by car** — walk, sprint and punch on foot; enter and exit cars, steal traffic, arcade driving with handbrake and building collision.
- **Traffic and pedestrians** — cars loop the avenues and slow for you; pedestrians stroll the sidewalks and flee when attacked.
- **Wanted system and police** — stealing cars and punching pedestrians raise your stars; cruisers chase and ram you with flashing light bars and sirens. Hide and the heat dies down.
- **Missions and story** — four jobs with world beacons, minimap blips, objectives and cash rewards.
- **HUD and minimap** — money, health, wanted stars, objective, speed, in-game clock and a live 2D minimap.
- **Start and save** — a title screen, pause, game-over and mission-complete screens; progress (money, mission, health) saves to `localStorage`.
- **Synthesized sound** — engine hum, two-tone sirens, pickups and impacts, all generated with WebAudio. No audio files.
- **Deterministic screenshots** — `?shot=start|play|end` set up the title, a mid-chase and the end screen for reproducible captures (see `shots.json`).

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Drive / walk |
| E | Enter, exit, or steal a car (near one) |
| F | Punch (on foot) |
| Space | Handbrake |
| Shift | Sprint |
| Mouse | Orbit the camera (click to lock) |
| P | Pause |
| M | Mute |

## Play it

Serve `game/` with any static server and open it in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

No network requests are made at runtime; the game runs fully offline.

## Hand in

`main.ts` (Node 22, standard library only) copies `game/` and
`screenshots/` to `/output` and writes `/output/dossier.json` with the
vendored `buildDossier` from `vendor/makefun-game.ts`:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## License

MIT — see [LICENSE](LICENSE). Solmar City, its characters, vehicles, names
and story are original inventions for this game; nothing here is from
Rockstar Games.
