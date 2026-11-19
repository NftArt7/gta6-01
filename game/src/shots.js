// Solmar City — deterministic screenshot setups. The screenshots in
// screenshots/ are taken by loading the game with one of these queries:
//   ?shot=start — title screen over the city at golden hour
//   ?shot=play  — mid-chase: driving with a 2-star wanted level, cops behind
//   ?shot=end   — the "Solmar is yours" end screen after all four missions
// A fixed seed keeps the city identical in every setup.
export function applyShot(G, shot) {
  const city = G.city;
  if (shot === 'start') {
    G.state = 'menu';
    G.onFoot.setPose(city.spawn.x, city.spawn.z, Math.PI);
    G.car.setPose(city.spawn.x + 4, city.spawn.z + 2, Math.PI / 2);
    G.car.active = true;
    G.car.mesh.group.visible = true;
    G.money = 0;
    G.health = 100;
    G.setWanted(0);
    G.missions.index = 0;
    G.hud.setMoney(0);
    G.hud.setHealth(100);
    G.hud.setObjective('Steal a car, run the jobs, own Solmar City.');
    G.hud.showScreen('menu', { hasSave: false });
    // cinematic camera: low over the avenue, park and towers behind
    G.camMode = 'cinematic';
    G.camYaw = Math.PI * 0.92;
    G.camPitch = 0.32;
    G.camDist = 26;
    G.camera.position.set(city.spawn.x - 14, 9, city.spawn.z + 22);
    G.camera.lookAt(city.spawn.x, 6, city.spawn.z - 60);
  } else if (shot === 'play') {
    G.state = 'playing';
    G.money = 1250;
    G.health = 82;
    G.hud.setMoney(1250);
    G.hud.setHealth(82);
    G.hud.showScreen(null);
    // player mid-chase in a car on the main avenue, cops on the tail.
    // Start far up the avenue so the car is still in the city, moving fast,
    // when the screenshot is taken, and hold the accelerator down.
    G.car.setPose(0, -116, 0);
    G.car.speed = 14;
    G.autoDrive = true;
    G.car.active = true;
    G.car.mesh.group.visible = true;
    G.driving = true;
    G.onFoot.mesh.group.visible = false;
    G.setWanted(2);
    G.missions.index = 2;
    G.missions.phase = 'evade';
    G.missions.objective = 'Mission 3 — Heat Wave: you have 2 stars! Lose the cops.';
    G.hud.setObjective(G.missions.objective);
    G.missions.setMarker(city.paintShop.x, city.paintShop.z + 14);
    G.camMode = 'chase';
    G.camYaw = 0;
    G.camPitch = 0.3;
    G.camDist = 13;
  } else if (shot === 'end') {
    G.state = 'complete';
    G.money = 3750;
    G.health = 100;
    G.hud.setMoney(3750);
    G.hud.setHealth(100);
    G.setWanted(0);
    G.missions.done = true;
    G.missions.hideMarker();
    G.onFoot.setPose(city.spawn.x, city.spawn.z, Math.PI);
    G.car.setPose(city.spawn.x + 4, city.spawn.z + 2, Math.PI / 2);
    G.car.active = true;
    G.car.mesh.group.visible = true;
    G.hud.setObjective('All missions complete — Solmar City is yours.');
    G.hud.showScreen('complete', { money: 3750, time: '24:36' });
    G.camMode = 'cinematic';
    G.camera.position.set(city.spawn.x - 12, 8, city.spawn.z + 20);
    G.camera.lookAt(city.spawn.x, 5, city.spawn.z - 40);
  }
}
