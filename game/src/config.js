// Solmar City tuning: every number the game balances on lives here, so a
// designer can retune the whole game without touching the systems.

export const CFG = {
  // City grid: 5 x 5 blocks, roads between them.
  blocks: 5,
  blockSize: 42,
  roadWidth: 14,
  // Derived: distance between neighbouring road centres.
  get pitch() {
    return this.blockSize + this.roadWidth;
  },
  // Derived: half the city's width (road centre of the outer road + half road).
  get half() {
    return ((this.blocks + 1) / 2) * this.pitch - this.roadWidth / 2;
  },
  // Road centre lines, from west to east (and south to north).
  roadCentres() {
    const out = [];
    for (let i = 0; i <= this.blocks; i++) {
      out.push((i - this.blocks / 2) * this.pitch);
    }
    return out;
  },

  // Player on foot.
  walkSpeed: 9,
  runSpeed: 14,
  interactRange: 4.5,

  // Driving (arcade, not simulation).
  carAccel: 26,
  carBrake: 46,
  carReverse: 14,
  carMaxSpeed: 46,
  carMaxReverse: 12,
  carSteer: 1.9,
  carGrip: 6.5,
  carRadius: 2.2,
  trafficSpeed: 11,
  policeSpeed: 40,
  policeRam: 26,

  // Wanted system.
  stealHeat: 1,
  hitPedHeat: 2,
  hitCarHeat: 0.5,
  heatDecaySeconds: 14,
  bustedHoldSeconds: 2.2,

  // Camera.
  camDistance: 13,
  camHeight: 7.5,
  camLookAhead: 6,

  // Screenshot staging: fixed simulation steps before the shot is taken.
  shotTicks: 200,
};

// The four jobs, in story order. Each mission names its anchor points in
// the world (filled in by world.js) and its cash reward.
export const MISSIONS = [
  {
    id: 'hot-wheels',
    name: 'Hot Wheels',
    reward: 1200,
    intro: "Delia: 'A Comet GT is parked at the showroom on Marina Row. Take it. Don't scratch it.'",
    steal: 'Steal the Comet GT from the showroom',
    deliver: "Deliver the Comet GT to Delia's garage",
    done: 'Hot Wheels complete. Delia is impressed.',
  },
  {
    id: 'dockside-drop',
    name: 'Dockside Drop',
    reward: 2500,
    intro: "Delia: 'A package is waiting at the docks. Pick it up and bring it to the warehouse. The harbour cops are jumpy.'",
    pickup: 'Pick up the package at the docks',
    deliver: 'Deliver the package to the warehouse',
    done: 'Dockside Drop complete. The package was never here.',
  },
  {
    id: 'heat-wave',
    name: 'Heat Wave',
    reward: 3000,
    intro: "Delia: 'Three stars, Rex. Lose them, then get to the hideout. No cops on your tail, or no pay.'",
    escape: 'Lose the cops, then reach the hideout',
    done: 'Heat Wave complete. The city forgot your face.',
  },
  {
    id: 'solmar-sprint',
    name: 'Solmar Sprint',
    reward: 5000,
    intro: "Delia: 'Last job. Six checkpoints, one city, 150 seconds. Beat the clock and you're a legend.'",
    race: 'Hit all 6 checkpoints before the clock runs out',
    done: 'SOLMAR SPRINT COMPLETE — you are a City Legend.',
  },
];

// Sun-soaked coastal palette: warm concrete, turquoise water, pastel walls.
export const PALETTE = {
  sky: 0x8ec9ee,
  fog: 0xa8c8e0,
  ground: 0x9aa578,
  sidewalk: 0xb8b0a0,
  asphalt: 0x33363c,
  building: [0xe8dcc8, 0xd8c8b0, 0xc8b8a8, 0xe0c8a0, 0xb8c8d8, 0xd8a898, 0xc8d0c0, 0xe8e0d0],
  glass: 0x2a4a66,
  water: 0x2a7a9a,
  palm: 0x3a7a3a,
  trunk: 0x8a6a4a,
};

// Car paints by kind, so traffic reads at a glance.
export const CAR_COLORS = {
  sedan: [0xc0c8d0, 0x8090a0, 0x405060, 0x905050, 0x507090],
  taxi: [0xf0c020],
  truck: [0x708090, 0x906040, 0x607060],
  sports: [0xe02020, 0xf0a020, 0x20a0e0, 0xc020a0],
  police: [0x20242a],
};
