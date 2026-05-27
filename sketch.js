//////////////////////////////////////////////////////
// VIDEO / FACEMESH
//////////////////////////////////////////////////////

let video;
let facemesh;
let predictions = [];

//////////////////////////////////////////////////////
// BLUR SYSTEM
//////////////////////////////////////////////////////

let blurAmount = 20;
let faceIsSharpEnough = false;

//////////////////////////////////////////////////////
// FACE ENTER
//////////////////////////////////////////////////////

let faceDetectedBefore = false;

//////////////////////////////////////////////////////
// WORLD SYSTEM
//////////////////////////////////////////////////////

let world = null;
let worldTimer = 0;

//////////////////////////////////////////////////////
// MIRROR GRAPHICS BUFFER
//////////////////////////////////////////////////////

let mirrorPG = null;

//////////////////////////////////////////////////////
// AMBIENT SYSTEM
//////////////////////////////////////////////////////

let ambientTimer = 0;
let ambientVoices = [];

//////////////////////////////////////////////////////
// AURAS
//////////////////////////////////////////////////////

let auras = [];

//////////////////////////////////////////////////////
// AUDIO
//////////////////////////////////////////////////////

let audioStarted = false;
let sharedReverb = null;

//////////////////////////////////////////////////////
// DEBUG
//////////////////////////////////////////////////////

let measuredR = 0;
let measuredG = 0;
let measuredB = 0;
let measuredBrightness = 0;

//////////////////////////////////////////////////////
// COME CLOSER
//////////////////////////////////////////////////////

let comeCloserAlpha = 0;

//////////////////////////////////////////////////////
// STATES
//////////////////////////////////////////////////////

let mouthWasOpen = false;
let smileWasActive = false;
let eyesWereClosed = false;
let headLeftActive = false;
let headRightActive = false;
let frownActive = false;
let lookingUpActive = false;

//////////////////////////////////////////////////////
// WORLD COLORS
//////////////////////////////////////////////////////

const worldColors = {

  himmel: [
    [120,180,255],
    [160,210,255],
    [100,160,255]
  ],

  erde: [
    [120,70,40],
    [160,100,60],
    [100,50,30]
  ],

  feuer: [
    [255,100,40],
    [255,70,20],
    [255,150,60]
  ],

  traum: [
    [110,80,220],
    [80,50,200],
    [140,100,255]
  ],

  wald: [
    [50,140,80],
    [70,170,90],
    [30,100,60]
  ]
};

//////////////////////////////////////////////////////
// SCALES
//////////////////////////////////////////////////////

const scales = {

  himmel: [
    [130.81,261.63,329.63,392.00,523.25],
    [146.83,293.66,369.99,440.00,587.33]
  ],

  erde: [
    [65.41,82.41,98.00,130.81,196.00],
    [73.42,92.50,110.00,146.83,220.00]
  ],

  feuer: [
    [220.00,261.63,329.63,415.30,659.25],
    [246.94,293.66,369.99,440.00,698.46]
  ],

  traum: [
    [110.00,130.81,155.56,220.00,311.13],
    [98.00,123.47,146.83,196.00,293.66]
  ],

  wald: [
    [164.81,196.00,220.00,261.63,329.63],
    [146.83,174.61,207.65,246.94,311.13]
  ]
};

//////////////////////////////////////////////////////
// SETUP
//////////////////////////////////////////////////////

function setup() {

  createCanvas(windowWidth, windowHeight);

  pixelDensity(1);

  video = createCapture(VIDEO);
  video.size(640,480);
  video.hide();

  facemesh = ml5.facemesh(video, modelReady);

  facemesh.on("predict", function(results) {
    predictions = results;
  });
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
  // WORLD CREATE
  //////////////////////////////////////////////////////

  if (faceDetected && !faceDetectedBefore) {

    createWorld();
    startAmbient();
  }

  faceDetectedBefore = faceDetected;

  //////////////////////////////////////////////////////
  // WORLD UPDATE ALLE 10 SEKUNDEN
  //////////////////////////////////////////////////////

  if (
    world &&
    millis() - worldTimer > 10000
  ) {

    updateWorld();
  }

  //////////////////////////////////////////////////////
  // TRACKING
  //////////////////////////////////////////////////////

  if (
    predictions.length > 0 &&
    faceIsSharpEnough &&
    world &&
    frameCount % 3 === 0
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
// CREATE WORLD
//////////////////////////////////////////////////////

function createWorld() {

  let palette = detectColorPalette();

  world = {

    mood: palette.name,

    scale: random(scales[palette.name]),

    detune: random(0.995, 1.005),

    attack:
      palette.name === "traum" ? 1.4 :
      palette.name === "himmel" ? 1.1 :
      palette.name === "wald" ? 0.9 :
      palette.name === "erde" ? 0.7 :
      0.4,

    release:
      palette.name === "traum" ? 5.5 :
      palette.name === "himmel" ? 4.8 :
      palette.name === "wald" ? 4.0 :
      palette.name === "erde" ? 3.2 :
      2.5,

    filter:
      palette.name === "feuer" ? 2400 :
      palette.name === "himmel" ? 1700 :
      palette.name === "wald" ? 1200 :
      palette.name === "erde" ? 700 :
      900,

    osc:
      palette.name === "feuer" ? "triangle" :
      palette.name === "wald" ? "triangle" :
      "sine",

    auraSize:
      palette.name === "traum" ? 450 :
      palette.name === "himmel" ? 380 :
      300
  };

  worldTimer = millis();

  if (sharedReverb) {
    try { sharedReverb.disconnect(); } catch(e) {}
  }

  sharedReverb = new p5.Reverb();
}

//////////////////////////////////////////////////////
// UPDATE WORLD
//////////////////////////////////////////////////////

function updateWorld() {

  let oldMood = world.mood;

  createWorld();

  if (oldMood !== world.mood) {
    startAmbient();
  }
}

//////////////////////////////////////////////////////
// COLOR DETECTION
//////////////////////////////////////////////////////

function detectColorPalette() {

  video.loadPixels();

  let rT = 0;
  let gT = 0;
  let bT = 0;
  let count = 0;

  for (let y = 240; y < 480; y += 12) {

    for (let x = 120; x < 520; x += 12) {

      let idx = (x + y * video.width) * 4;

      rT += video.pixels[idx];
      gT += video.pixels[idx + 1];
      bT += video.pixels[idx + 2];

      count++;
    }
  }

  measuredR = floor(rT / count);
  measuredG = floor(gT / count);
  measuredB = floor(bT / count);

  measuredBrightness =
    floor((measuredR + measuredG + measuredB) / 3);

  if (
    measuredB > measuredR * 1.15 &&
    measuredB > measuredG * 1.1
  ) {
    return { name: "himmel" };
  }

  if (
    measuredG > measuredR * 1.12 &&
    measuredG > measuredB * 1.08
  ) {
    return { name: "wald" };
  }

  if (
    measuredR > measuredG * 1.15 &&
    measuredR > measuredB * 1.1
  ) {
    return { name: "feuer" };
  }

  if (measuredBrightness < 85) {
    return { name: "traum" };
  }

  return { name: "erde" };
}

//////////////////////////////////////////////////////
// AMBIENT
//////////////////////////////////////////////////////

function startAmbient() {

  stopAmbient();

  if (!world) return;

  for (let i = 0; i < 3; i++) {

    let osc = new p5.Oscillator(world.osc);
    let filter = new p5.LowPass();

    osc.disconnect();
    osc.connect(filter);

    filter.freq(world.filter);

    sharedReverb.process(filter, 8, 2);

    osc.start();

    let freq =
      random(world.scale) *
      random([0.5, 1, 1.5]);

    osc.freq(freq);

    osc.amp(0);

    osc.amp(0.02, world.attack + random(1,2));

    ambientVoices.push({
      osc: osc,
      filter: filter
    });
  }
}

//////////////////////////////////////////////////////
// STOP AMBIENT
//////////////////////////////////////////////////////

function stopAmbient() {

  for (let v of ambientVoices) {

    try {
      v.osc.stop();
      v.osc.disconnect();
      v.filter.disconnect();
    } catch(e) {}
  }

  ambientVoices = [];
}

//////////////////////////////////////////////////////
// PLAY NOTE
//////////////////////////////////////////////////////

function playNote(freq, intensity, release) {

  if (!world || !sharedReverb) return;

  let osc = new p5.Oscillator(world.osc);
  let filter = new p5.LowPass();

  filter.freq(
    world.filter + random(-300,300)
  );

  osc.disconnect();
  osc.connect(filter);

  sharedReverb.process(filter, 6, 2);

  osc.start();

  osc.freq(
    freq * random(world.detune, world.detune + 0.003)
  );

  osc.amp(0);

  osc.amp(
    0.04 * intensity,
    world.attack * 0.3
  );

  osc.amp(
    0,
    release || world.release
  );

  setTimeout(function() {

    try {
      osc.stop();
      osc.disconnect();
      filter.disconnect();
    } catch(e) {}

  }, ((release || world.release) + 0.5) * 1000);
}

//////////////////////////////////////////////////////
// PLAY MELODY
//////////////////////////////////////////////////////

function playMelody(notes, intensity, speed) {

  let seq = shuffle([...notes]).slice(0,5);

  for (let i = 0; i < seq.length; i++) {

    setTimeout(function() {

      playNote(
        seq[i],
        intensity,
        world.release * 0.45
      );

    }, i * speed);
  }

  spawnAura(intensity);
}

//////////////////////////////////////////////////////
// SPAWN AURA
//////////////////////////////////////////////////////

function spawnAura(intensity) {

  if (!world) return;

  if (auras.length > 5) {
    auras.splice(0,1);
  }

  let palette = worldColors[world.mood];
  let base = random(palette);

  auras.push({

    x: width / 2 + random(-120,120),
    y: height / 2 + random(-90,90),

    size:
      world.auraSize *
      random(0.8,1.2),

    r: base[0],
    g: base[1],
    b: base[2],

    alpha: 0,
    targetAlpha:
      10 + intensity * 8,

    noiseSeed:
      random(1000),

    driftX:
      random(-0.12,0.12),

    driftY:
      random(-0.08,0.08),

    phase:
      random(TWO_PI)
  });
}

//////////////////////////////////////////////////////
// DRAW AURAS
//////////////////////////////////////////////////////

function drawAuras() {

  blendMode(SCREEN);
  noStroke();

  for (let i = auras.length - 1; i >= 0; i--) {

    let a = auras[i];

    a.alpha = lerp(a.alpha, a.targetAlpha, 0.04);

    a.targetAlpha *= 0.985;

    a.x += a.driftX;
    a.y += a.driftY;

    //////////////////////////////////////////////////////
    // WEICHE SCHWADEN
    //////////////////////////////////////////////////////

    for (let l = 0; l < 4; l++) {

      let layerSize =
        a.size * (1 + l * 0.22);

      let layerAlpha =
        a.alpha / (3.2 + l);

      drawingContext.filter =
        `blur(${layerSize * 0.06}px)`;

      //////////////////////////////////////////////////////
      // RADIALER GRADIENT
      //////////////////////////////////////////////////////

      let grad =
        drawingContext.createRadialGradient(
          a.x,
          a.y,
          layerSize * 0.05,
          a.x,
          a.y,
          layerSize * 0.5
        );

      grad.addColorStop(
        0,
        `rgba(${a.r},${a.g},${a.b},${layerAlpha * 0.012})`
      );

      grad.addColorStop(
        0.5,
        `rgba(${a.r},${a.g},${a.b},${layerAlpha * 0.007})`
      );

      grad.addColorStop(
        1,
        `rgba(${a.r},${a.g},${a.b},0)`
      );

      drawingContext.fillStyle = grad;

      beginShape();

      for (let angle = 0; angle < TWO_PI; angle += 0.35) {

        let n = noise(
          cos(angle) * 0.8 +
          a.noiseSeed,

          sin(angle) * 0.8 +
          a.noiseSeed,

          frameCount * 0.003
        );

        let radius =
          layerSize *
          (0.7 + n * 0.3);

        let x =
          a.x +
          cos(angle + a.phase) * radius;

        let y =
          a.y +
          sin(angle + a.phase) * radius;

        vertex(x,y);
      }

      endShape(CLOSE);
    }

    drawingContext.filter = "none";

    a.phase += 0.002;

    if (a.targetAlpha < 0.2) {
      auras.splice(i,1);
    }
  }

  blendMode(BLEND);
}

//////////////////////////////////////////////////////
// MOUTH
//////////////////////////////////////////////////////

function detectMouth(face) {

  let d = dist(
    face.scaledMesh[13][0],
    face.scaledMesh[13][1],
    face.scaledMesh[14][0],
    face.scaledMesh[14][1]
  );

  let open = d > 16;

  if (open && !mouthWasOpen) {

    let notes =
      world.scale.map(n =>
        n * random([1,2])
      );

    playMelody(notes,1.1,110);
  }

  mouthWasOpen = open;
}

//////////////////////////////////////////////////////
// SMILE
//////////////////////////////////////////////////////

function detectSmile(face) {

  let w = dist(
    face.scaledMesh[61][0],
    face.scaledMesh[61][1],
    face.scaledMesh[291][0],
    face.scaledMesh[291][1]
  );

  let smiling = w > 82;

  if (smiling && !smileWasActive) {

    let notes =
      [...world.scale].sort((a,b)=>a-b);

    playMelody(notes,1.0,120);
  }

  smileWasActive = smiling;
}

//////////////////////////////////////////////////////
// EYES CLOSED
//////////////////////////////////////////////////////

function detectEyesClosed(face) {

  let l = dist(
    face.scaledMesh[159][0],
    face.scaledMesh[159][1],
    face.scaledMesh[145][0],
    face.scaledMesh[145][1]
  );

  let r = dist(
    face.scaledMesh[386][0],
    face.scaledMesh[386][1],
    face.scaledMesh[374][0],
    face.scaledMesh[374][1]
  );

  let closed = l < 12 && r < 12;

  if (closed && !eyesWereClosed) {

    let notes =
      [...world.scale].reverse();

    playMelody(notes,0.9,160);
  }

  eyesWereClosed = closed;
}

//////////////////////////////////////////////////////
// HEAD TILT
//////////////////////////////////////////////////////

function detectHeadTilt(face) {

  let eyeDiff =
    face.scaledMesh[33][1] -
    face.scaledMesh[263][1];

  let right = eyeDiff > 14;
  let left = eyeDiff < -14;

  if (right && !headRightActive) {

    playMelody(
      world.scale.map(n => n * 2),
      1.0,
      80
    );
  }

  if (left && !headLeftActive) {

    playMelody(
      world.scale.map(n => n * 0.5),
      1.0,
      170
    );
  }

  headRightActive = right;
  headLeftActive = left;
}

//////////////////////////////////////////////////////
// FROWN
//////////////////////////////////////////////////////

function detectFrown(face) {

  let d = dist(
    face.scaledMesh[107][0],
    face.scaledMesh[107][1],
    face.scaledMesh[336][0],
    face.scaledMesh[336][1]
  );

  let frown = d < 175;

  if (frown && !frownActive) {

    playMelody(
      world.scale.map(n => n * 0.5),
      1.1,
      220
    );
  }

  frownActive = frown;
}

//////////////////////////////////////////////////////
// LOOK UP
//////////////////////////////////////////////////////

function detectLookingUp(face) {

  let d = dist(
    face.scaledMesh[1][0],
    face.scaledMesh[1][1],
    face.scaledMesh[152][0],
    face.scaledMesh[152][1]
  );

  let up = d < 145;

  if (up && !lookingUpActive) {

    playMelody(
      world.scale.map(n => n * 1.5),
      1.0,
      110
    );
  }

  lookingUpActive = up;
}

//////////////////////////////////////////////////////
// MIRROR
//////////////////////////////////////////////////////

function drawMirror() {

  if (
    !mirrorPG ||
    mirrorPG.width !== width ||
    mirrorPG.height !== height
  ) {

    if (mirrorPG) mirrorPG.remove();

    mirrorPG = createGraphics(width,height);
  }

  mirrorPG.push();

  mirrorPG.translate(width,0);
  mirrorPG.scale(-1,1);

  mirrorPG.image(video,0,0,width,height);

  mirrorPG.pop();

  if (blurAmount > 0.5) {
    mirrorPG.filter(BLUR,floor(blurAmount));
  }

  image(mirrorPG,0,0);
}

//////////////////////////////////////////////////////
// UPDATE BLUR
//////////////////////////////////////////////////////

function updateBlur() {

  if (predictions.length === 0) {

    blurAmount = lerp(blurAmount,20,0.06);
    faceIsSharpEnough = false;

    return;
  }

  let face = predictions[0];

  let leftEye = face.scaledMesh[33];
  let rightEye = face.scaledMesh[263];

  let eyeDistance = dist(
    leftEye[0], leftEye[1],
    rightEye[0], rightEye[1]
  );

  let normalized = constrain(
    map(eyeDistance,30,80,0,1),
    0,
    1
  );

  blurAmount = lerp(
    blurAmount,
    (1 - normalized) * 20,
    0.06
  );

  faceIsSharpEnough = normalized > 0.88;

  if (faceIsSharpEnough) {
    blurAmount = 0;
  }
}

//////////////////////////////////////////////////////
// GLASS TEXT
//////////////////////////////////////////////////////

function drawGlassText(alpha) {

  push();

  textAlign(CENTER,CENTER);
  textSize(96);
  textStyle(BOLD);
  textFont("Fredoka");

  let floatY =
    sin(frameCount * 0.01) * 8;

  drawingContext.shadowBlur = 60;
  drawingContext.shadowColor =
    "rgba(255,255,255,0.95)";

  drawingContext.filter = "blur(10px)";

  fill(255,80 * alpha);

  text(
    "COME CLOSER",
    width / 2,
    height / 2 + floatY
  );

  drawingContext.filter = "none";

  fill(255,180 * alpha);

  text(
    "COME CLOSER",
    width / 2,
    height / 2 + floatY
  );

  pop();
}

//////////////////////////////////////////////////////
// DEBUG
//////////////////////////////////////////////////////

function drawDebug() {

  fill(255);
  noStroke();
  textSize(18);

  text(
    "FACES: " + predictions.length,
    20,
    40
  );

  text(
    "BLUR: " + floor(blurAmount),
    20,
    70
  );

  text(
    "RGB: " +
    measuredR + " / " +
    measuredG + " / " +
    measuredB,
    20,
    100
  );

  text(
    "HELLIGKEIT: " +
    measuredBrightness,
    20,
    130
  );

  if (world) {

    text(
      "WELT: " + world.mood,
      20,
      160
    );
  }
}

//////////////////////////////////////////////////////
// AUDIO START
//////////////////////////////////////////////////////

function mousePressed() {

  if (!audioStarted) {

    userStartAudio();

    audioStarted = true;
  }
}

//////////////////////////////////////////////////////
// RESIZE
//////////////////////////////////////////////////////

function windowResized() {

  resizeCanvas(windowWidth,windowHeight);
}
