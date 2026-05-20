```javascript
//////////////////////////////////////////////////////
// VIDEO / FACEMESH
//////////////////////////////////////////////////////

let video;
let facemesh;
let predictions = [];

//////////////////////////////////////////////////////
// BLUR SYSTEM
//////////////////////////////////////////////////////

let blurAmount        = 20;
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
  himmel: [[160,210,255],[100,180,255],[180,230,255],[120,200,255],[200,240,255]],
  erde:   [[180,120,60],[200,140,80],[160,100,50],[210,160,100],[190,130,70]],
  feuer:  [[255,60,30],[255,100,20],[240,40,10],[255,140,40],[220,50,20]],
  traum:  [[80,60,180],[100,80,200],[60,40,160],[120,90,220],[90,70,190]],
  wald:   [[60,160,60],[40,130,50],[80,200,70],[50,150,80],[100,180,60]]
};

//////////////////////////////////////////////////////
// SETUP
//////////////////////////////////////////////////////

function setup() {

  createCanvas(windowWidth, windowHeight);

  video = createCapture(VIDEO);
  video.size(640, 480);
  video.hide();

  facemesh = ml5.facemesh(video, modelReady);
  facemesh.on("predict", function(results) {
    predictions = results;
  });
}

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

  if (faceDetected && !faceDetectedBefore) {
    createKlangwelt();
    playBrightnessChord();
  }

  faceDetectedBefore = faceDetected;

  if (predictions.length > 0 && faceIsSharpEnough && klangwelt && frameCount % 3 === 0) {

    let face = predictions[0];

    detectMouth(face);
    detectSmile(face);
    detectEyesClosed(face);
    detectHeadTilt(face);
    detectFrown(face);
    detectLookingUp(face);
  }

  let comeCloserActive =
    predictions.length > 0 &&
    !faceIsSharpEnough;

  if (comeCloserActive) {
    comeCloserAlpha = min(1, comeCloserAlpha + 0.015);
  } else {
    comeCloserAlpha = max(0, comeCloserAlpha - 0.025);
  }

  if (comeCloserAlpha > 0) {
    drawGlassText(comeCloserAlpha);
  }

  drawDebug();
}

//////////////////////////////////////////////////////
// CREATE KLANGWELT
//////////////////////////////////////////////////////

function createKlangwelt() {

  let palette = detectKlangfarbe();

  let seed = floor(random(100000));
  randomSeed(seed);

  klangwelt = {
    stimmung:       palette.name,
    seed:           seed,
    scale:          random(brightnessChords),
    oscType:        palette.osc,
    reverbTime:     palette.reverb,
    filterFreq:     palette.filter,
    detune:         random(0.985, 1.015),
    attack:         random(0.3, 1.2),
    release:        palette.release,
    arpeggioStep:   palette.arpeggioStep,
    harmonicChance: random(0.2, 0.7),
    auraSize:       random(700, 1600)
  };

  if (sharedReverb) {
    try { sharedReverb.disconnect(); } catch(e) {}
  }

  sharedReverb = new p5.Reverb();
}

//////////////////////////////////////////////////////
// KLANGFARBE
//////////////////////////////////////////////////////

function detectKlangfarbe() {

  video.loadPixels();

  let rTotal = 0, gTotal = 0, bTotal = 0, count = 0;

  for (let y = 120; y < 360; y += 12) {
    for (let x = 160; x < 480; x += 12) {
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

  if (hell && b > r * 1.05 && b > g * 1.02)
    return { name: "himmel", osc: "triangle", reverb: 7, filter: 1200, release: random(4, 7), arpeggioStep: 100 };

  if (hell && r > g * 1.1 && r > b * 1.1)
    return { name: "feuer", osc: "sawtooth", reverb: 2, filter: 2000, release: random(1, 2.5), arpeggioStep: 60 };

  if (hell && g > r * 1.05 && g > b * 1.05)
    return { name: "wald", osc: "triangle", reverb: 5, filter: 600, release: random(2, 4), arpeggioStep: 180 };

  if (!hell && b > r * 1.03 && b > g * 1.01)
    return { name: "traum", osc: "sine", reverb: 10, filter: 700, release: random(5, 9), arpeggioStep: 200 };

  return { name: "erde", osc: "sine", reverb: 4, filter: 300, release: random(3, 6), arpeggioStep: 250 };
}

function pickAuraColor() {

  let palette = klangweltColors[klangwelt ? klangwelt.stimmung : "traum"] || klangweltColors.traum;
  let base = random(palette);

  return {
    r: constrain(base[0] + random(-20, 20), 0, 255),
    g: constrain(base[1] + random(-20, 20), 0, 255),
    b: constrain(base[2] + random(-20, 20), 0, 255)
  };
}

function spawnAura(intensity) {

  if (!klangwelt) return;

  if (auras.length >= 5) auras.splice(0, 1);

  let col = pickAuraColor();
  let offsets = Array.from({length: 8}, () => random(0.6, 1.4));

  auras.push({
    x: random(width * 0.15, width * 0.85),
    y: random(height * 0.15, height * 0.85),
    size: klangwelt.auraSize * random(1.4, 2.2),
    r: col.r,
    g: col.g,
    b: col.b,
    alpha: 0,
    targetAlpha: 140 + intensity * 60,
    offsets: offsets,
    blobSeed: random(1000),
    noiseSeedX: random(1000),
    noiseSeedY: random(1000),
    phase: random(TWO_PI)
  });
}
```
