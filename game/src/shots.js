// Deterministic screenshot staging: ?shot=start|play|end (with seed=1)
// places the game in a composed, lively state and advances the simulation
// a fixed number of steps, so the same URL always renders the same frame.
// The game object comes from main.js; this file only stages it.

import { CFG, MISSIONS } from './config.js';

// Runs the simulation a fixed number of 1/60s steps, then renders once
// and raises the flag the screenshot runner waits for.
function finishStage(game, ticks) {
  for (let i = 0; i < ticks; i++) {
    game.step(1 / 60);
  }
  game.render();
  window.__shotReady = true;
}

export function applyShot(game, shot) {
  const anchors = game.world.anchors;

  if (shot === 'start') {
    // Title screen: Rex on foot beside the Comet GT at the showroom, the
    // city behind him, the start panel on top. The world sim runs so the
    // traffic and pedestrians are alive behind the panel.
    game.started = true;
    game.teleportPlayer(anchors.showroom.x, anchors.showroom.z + 7, Math.PI);
    const gt = game.targetCar;
    gt.x = anchors.showroom.x;
    gt.z = anchors.showroom.z;
    gt.heading = Math.PI / 2;
    gt.speed = 0;
    gt.mesh.position.set(gt.x, 0, gt.z);
    gt.mesh.rotation.y = gt.heading;
    game.setCameraFixed(
      { x: 52, y: 26, z: -38 },
      { x: 134, y: 2, z: -80 }
    );
    game.hud.showStart(MISSIONS);
    finishStage(game, 90);
    return;
  }

  if (shot === 'play') {
    // Mid-chase: Rex in the Comet GT with the package job running, two
    // stars on him, two police cars closing in from behind. The chase
    // develops over a fixed 200 ticks before the shot.
    game.started = true;
    game.hud.hideOverlay();
    game.missions.index = 1;
    game.missions.phase = 'deliver';
    game.missions.objective = MISSIONS[1].deliver;
    game.missions.marker = anchors.warehouse;
    game.missions.cash = 1200;
    // Drop the mission-0 intro the constructor queued: this shot is job 2.
    game.missions.events.length = 0;
    game.setWanted(2);
    const gt = game.targetCar;
    // East along road z=28 (heading PI/2 faces +X): the car stays on the
    // road instead of driving across it into the block.
    gt.x = 0;
    gt.z = 28;
    gt.heading = Math.PI / 2;
    gt.speed = 26;
    gt.mesh.position.set(gt.x, 0, gt.z);
    gt.mesh.rotation.y = gt.heading;
    game.enterCarForced(gt);
    game.player.x = 0;
    game.player.z = 28;
    game.player.heading = Math.PI / 2;
    // Two police cars trailing close on the same road, behind the player.
    game.spawnPoliceAt(-8, 28, Math.PI / 2);
    game.spawnPoliceAt(-15, 28, Math.PI / 2);
    // Drive for the player during staging (no keyboard in a screenshot)
    // and use the front chase camera so the pursuit stays in frame.
    game.autoDrive = true;
    game.camFront = true;
    finishStage(game, CFG.shotTicks);
    return;
  }

  if (shot === 'end') {
    // The win: the sprint is complete, the sun is low over the marina,
    // Rex stands by the Comet GT on the pier with the City Legend panel.
    game.started = true;
    game.missions.index = 3;
    game.missions.completeMission();
    game.teleportPlayer(anchors.docks.x - 6, 4, Math.PI / 2);
    const gt = game.targetCar;
    gt.x = anchors.docks.x - 6;
    gt.z = -3;
    gt.heading = Math.PI / 2;
    gt.speed = 0;
    gt.mesh.position.set(gt.x, 0, gt.z);
    gt.mesh.rotation.y = gt.heading;
    // Low camera off the pier's corner: the Comet GT and Rex left of
    // frame with the water and the dock containers behind them.
    game.setCameraFixed(
      { x: anchors.docks.x - 44, y: 7, z: -22 },
      { x: anchors.docks.x + 6, y: 2, z: 40 }
    );
    // Golden hour: drop the sun lower and warmer for the closing shot.
    game.world.sun.position.set(260, 40, 50);
    finishStage(game, 90);
    return;
  }

  // Unknown ?shot value: just render the live scene.
  game.started = true;
  game.hud.hideOverlay();
  finishStage(game, 30);
}
