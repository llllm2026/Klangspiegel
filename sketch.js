//////////////////////////////////////////////////////
// VIDEO / FACEMESH
//////////////////////////////////////////////////////

let video;
let facemesh;
let predictions = [];

//////////////////////////////////////////////////////
// PERFORMANCE / IPAD FIXES
//////////////////////////////////////////////////////

pixelDensity(1);

//////////////////////////////////////////////////////
// BLUR SYSTEM
//////////////////////////////////////////////////////

let blurAmount        = 20;
let targetBlur        = 20;
let faceIsSharpEnough = false;

//////////////////////////////////////////////////////
// FACE ENTER
//////////////////////////////////////////////////////

let faceDetectedBefore = false;

//////////////////////////////////////////////////////
// KLANGWELT SYSTEM
//////////////////////////////////////////////////////

let klangwelt = null;

//////////////////////////////////////////////////////
// MIRROR GRAPHICS BUFFER
//////////////////////////////////////////////////////

let mirrorPG = null;

//////////////////////////////////////////////////////
// AUDIO LIMITER
//////////////////////////////////////////////////////

let activeOscillators = 0;
let MAX_OSCILLATORS   = 8;

//////////////////////////////////////////////////////
// CHORDS
//////////////////////////////////////////////////////

let brightnessChords = [
  [130.81, 155.56, 196.00],
  [146.83, 174.61, 220.00],
  [164.81, 196.00, 246.94],
  [174.61, 220.00, 261.63],
  [196.00, 246.94, 293.66],
  [220.00, 261.63, 329.63],
  [261.63, 329.63, 392.00]
];

//////////////////////////////////////////////////////
// STATES
//////////////////////////////////////////////////////

let mouthWasOpen    = false;
let mouthWasO       = false;
let smileWasActive  = false;
let eyesWereClosed  = false;
let headLeftActive  = false;
let headRightActive = false;
let frownActive     = false;
let lookingUpActive = false;

//////////////////////////////////////////////////////
// AURAS
//////////////////////////////////////////////////////

let auras = [];

//////////////////////////////////////////////////////
// COME CLOSER FADE
//////////////////////////////////////////////////////

let comeCloserAlpha = 0;

//////////////////////////////////////////////////////
// AUDIO
//////////////////////////////////////////////////////

let audioStarted  = false;
let lastSoundTime = 0;

//////////////////////////////////////////////////////
// SHARED REVERB
//////////////////////////////////////////////////////

let sharedReverb = null;

//////////////////////////////////////////////////////
// KLANGWELT COLOR PALETTES
//////////////////////////////////////////////////////

const klangweltColors = {

  himmel: [
    [180,220,255],
    [120,190,255],
    [200,235,255],
    [150,210,255],
    [170,225,255]
  ],

  erde: [
    [170,110,70],
    [140,90,60],
    [200,140,90],
    [160,100,70],
    [180,130,90]
  ],

  feuer: [
    [255,80,40],
    [255,120,30],
    [255,60,20],
    [255,140,50],
    [240,70,30]
  ],

  traum: [
    [90,70,200],
    [110,90,220],
    [70,50,180],
    [130,100,230],
    [100,80,210]
  ],

  wald: [
    [70,170,80],
    [50,140,70],
    [90,200,90],
    [60,160,80],
    [100,190,90]
  ]
};

//////////////////////////////////////////////////////
// SETUP
//////////////////////////////////////////////////////

function setup() {

  createCanvas(windowWidth, windowHeight);

  video = createCapture({
    video: {
      facingMode: "user"
    },
    audio: false
  });

  video.size(640, 480);
  video.hide();

  facemesh = ml5.facemesh(video, modelReady);

  facemesh.on("predict", function(results) {
    predictions = results;
  });

  noStroke();
}

//////////////////////////////////////////////////////
// MODEL READY
//////////////////////////////////////////////////////

function modelReady() {
  console.log("FaceMesh ready");
}

//////////////////////////////////////////////////////
// DRAW
//////////////////////////////////////////////////////

function draw() {

  background(0);

  updateBlur();
  drawMirror();
  drawAuras();

  let faceDetected = predictions.length > 0;

  //////////////////////////////////////////////////////
  // FACE ENTER
  //////////////////////////////////////////////////////

  if (faceDetected && !faceDetectedBefore) {

    createKlangwelt();
    playBrightnessChord();
  }

  faceDetectedBefore = faceDetected;

  //////////////////////////////////////////////////////
  // MIMIK
  //////////////////////////////////////////////////////

  if (
    predictions.length > 0 &&
    faceIsSharpEnough &&
    klangwelt &&
    frameCount % 4 === 0
  ) {

    let face = predictions[0];

    detectMouth(face);
    detectSmile(face);
    detectEyesClosed(face);
    detectHeadTilt(face);
    detectFrown(face);
    detectLookingUp(face);
  }

  //////////////////////////////////////////////////////
  // COME CLOSER
  //////////////////////////////////////////////////////

  let comeCloserActive =
    predictions.length > 0 &&
    !faceIsSharpEnough;

  if (comeCloserActive) {
    comeCloserAlpha = min(1, comeCloserAlpha + 0.02);
  } else {
    comeCloserAlpha = max(0, comeCloserAlpha - 0.03);
  }

  if (comeCloserAlpha > 0.01) {
    drawGlassText(comeCloserAlpha);
  }

  drawDebug();
}

//////////////////////////////////////////////////////
// CREATE KLANGWELT
//////////////////////////////////////////////////////

function createKlangwelt() {

  let palette = detectKlangfarbe();

  klangwelt = {

    stimmung:       palette.name,
    scale:          random(brightnessChords),

    oscType:        palette.osc,
    reverbTime:     palette.reverb,
    filterFreq:     palette.filter,

    detune:         random(0.99, 1.01),

    release:        palette.release,
    arpeggioStep:   palette.arpeggioStep,

    harmonicChance: random(0.2, 0.6),

    auraSize:       random(600, 1200)
  };

  if (sharedReverb) {
    try {
      sharedReverb.disconnect();
    } catch(e) {}
  }

  sharedReverb = new p5.Reverb();
}

//////////////////////////////////////////////////////
// KLANGFARBE
//////////////////////////////////////////////////////

function detectKlangfarbe() {

  video.loadPixels();

  let rTotal = 0;
  let gTotal = 0;
  let bTotal = 0;
  let count  = 0;

  for (let y = 120; y < 360; y += 14) {

    for (let x = 160; x < 480; x += 14) {

      let index = (x + y * video.width) * 4;

      rTotal += video.pixels[index];
      gTotal += video.pixels[index + 1];
      bTotal += video.pixels[index + 2];

      count++;
    }
  }

  let r = rTotal / count;
  let g = gTotal / count;
  let b = bTotal / count;

  let brightness = (r + g + b) / 3;

  let hell = brightness > 110;

  if (hell && b > r * 1.05 && b > g * 1.02) {
    return {
      name: "himmel",
      osc: "triangle",
      reverb: 5,
      filter: 1200,
      release: random(3, 5),
      arpeggioStep: 100
    };
  }

  if (hell && r > g * 1.1 && r > b * 1.1) {
    return {
      name: "feuer",
      osc: "sawtooth",
      reverb: 2,
      filter: 1800,
      release: random(1, 2),
      arpeggioStep: 60
    };
  }

  if (hell && g > r * 1.05 && g > b * 1.05) {
    return {
      name: "wald",
      osc: "triangle",
      reverb: 4,
      filter: 700,
      release: random(2, 4),
      arpeggioStep: 160
    };
  }

  if (!hell && b > r * 1.03 && b > g * 1.01) {
    return {
      name: "traum",
      osc: "sine",
      reverb: 6,
      filter: 700,
      release: random(4, 7),
      arpeggioStep: 180
    };
  }

  return {
    name: "erde",
    osc: "sine",
    reverb: 3,
    filter: 350,
    release: random(2, 5),
    arpeggioStep: 220
  };
}

//////////////////////////////////////////////////////
// PICK AURA COLOR
//////////////////////////////////////////////////////

function pickAuraColor() {

  let palette =
    klangweltColors[
      klangwelt ? klangwelt.stimmung : "traum"
    ];

  let base = random(palette);

  return {

    r: constrain(base[0] + random(-15, 15), 0, 255),
    g: constrain(base[1] + random(-15, 15), 0, 255),
    b: constrain(base[2] + random(-15, 15), 0, 255)
  };
}

//////////////////////////////////////////////////////
// SPAWN AURA
//////////////////////////////////////////////////////

function spawnAura(intensity = 1) {

  if (!klangwelt) return;

  if (auras.length >= 4) {
    auras.splice(0, 1);
  }

  let col = pickAuraColor();

  let offsets =
    Array.from(
      { length: 8 },
      () => random(0.7, 1.3)
    );

  auras.push({

    x: random(width * 0.2, width * 0.8),
    y: random(height * 0.2, height * 0.8),

    size:
      klangwelt.auraSize *
      random(1.2, 1.8),

    r: col.r,
    g: col.g,
    b: col.b,

    alpha: 0,
    targetAlpha: 160 + intensity * 60,

    offsets: offsets,

    blobSeed: random(1000),

    noiseSeedX: random(1000),
    noiseSeedY: random(1000),

    phase: random(TWO_PI)
  });
}
