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
// WORLD SYSTEM
//////////////////////////////////////////////////////

let world = null;

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
let lastSoundTime = 0;   // cooldown gegen Audio-Overload

//////////////////////////////////////////////////////
// SHARED REVERB (1x aanmaken, niet elke noot)
//////////////////////////////////////////////////////

let sharedReverb = null;

//////////////////////////////////////////////////////
// WORLD COLOR PALETTES
//////////////////////////////////////////////////////

const worldColors = {
  dream:  [[120,80,220],[80,100,240],[160,60,200],[100,140,255],[200,100,255]],
  forest: [[60,180,80],[40,140,100],[100,200,60],[30,160,120],[80,220,140]],
  warm:   [[255,120,40],[240,60,60],[255,180,60],[220,80,100],[255,140,80]],
  glass:  [[180,230,255],[200,200,255],[220,255,250],[255,240,255],[200,240,255]]
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

  //////////////////////////////////
  // FACE DETECT
  //////////////////////////////////

  let faceDetected = predictions.length > 0;

  if (faceDetected && !faceDetectedBefore) {

    createWorld();
    playBrightnessChord();
  }

  faceDetectedBefore = faceDetected;

  //////////////////////////////////
  // MIMIK
  //////////////////////////////////

  // mimik nur alle 3 frames auswerten - spart CPU, reaktion noch schnell genug
  if (predictions.length > 0 && faceIsSharpEnough && world && frameCount % 3 === 0) {

    let face = predictions[0];

    detectMouth(face);
    detectSmile(face);
    detectEyesClosed(face);
    detectHeadTilt(face);
    detectFrown(face);
    detectLookingUp(face);
  }

  //////////////////////////////////
  // COME CLOSER TEXT
  //////////////////////////////////

  let comeCloserActive =
    predictions.length > 0 &&
    !faceIsSharpEnough;

  // sobald come closer verschijnt: auras + tonen weg
  if (comeCloserActive && comeCloserAlpha < 0.05) {

    for (let i = 0; i < auras.length; i++) {
      auras[i].targetAlpha = 0;
    }

    getAudioContext().suspend();
    setTimeout(function() {
      getAudioContext().resume();
    }, 150);
  }

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

  let seed = floor(random(100000));
  randomSeed(seed);

  world = {
    mood:          palette.name,
    seed:          seed,
    scale:         random(brightnessChords),
    oscType:       palette.osc,
    reverbTime:    palette.reverb,
    filterFreq:    palette.filter,
    detune:        random(0.985, 1.015),
    attack:        random(0.3, 1.2),
    release:       random(3, 6),
    harmonicChance: random(0.2, 0.7),
    auraSize:      random(700, 1600)
  };

  // gedeelde reverb aanmaken voor deze world
  if (sharedReverb) {
    try { sharedReverb.disconnect(); } catch(e) {}
  }
  sharedReverb = new p5.Reverb();

  console.log("WORLD:", world.mood, world.seed);
}

//////////////////////////////////////////////////////
// COLOR DETECTION
//////////////////////////////////////////////////////

function detectColorPalette() {

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

  let saturation = max(r, g, b) - min(r, g, b);
  let brightness = (r + g + b) / 3;

  // dominante kleur bepaalt de world
  // lagere drempelwaarden zodat alle worlds bereikbaar zijn

  // DREAM: blauw ook subtiel detecteren
  if (b > r * 1.05 && b > g * 1.02 && saturation > 10)
    return { name: "dream",  osc: "triangle", reverb: 8, filter: 700  };

  // FOREST: groen ook subtiel
  if (g > r * 1.04 && g > b * 1.03 && saturation > 10)
    return { name: "forest", osc: "triangle", reverb: 6, filter: 500  };

  // GLASS: helder/neutraal licht
  if (brightness > 160 && saturation < 30)
    return { name: "glass",  osc: "sine",     reverb: 7, filter: 900  };

  // WARM: rood dominant — strengere eis zodat niet altijd warm
  if (r > g * 1.15 && r > b * 1.18 && saturation > 20)
    return { name: "warm",   osc: "sine",     reverb: 4, filter: 1400 };

  // donker en neutraal → dream als default
  if (brightness < 80)
    return { name: "dream",  osc: "triangle", reverb: 9, filter: 600  };

  return   { name: "glass",  osc: "sine",     reverb: 7, filter: 900  };
}

//////////////////////////////////////////////////////
// PICK AURA COLOR
//////////////////////////////////////////////////////

function pickAuraColor() {

  let palette = worldColors[world ? world.mood : "glass"] || worldColors.glass;
  let base    = random(palette);

  return {
    r: constrain(base[0] + random(-25, 25), 0, 255),
    g: constrain(base[1] + random(-25, 25), 0, 255),
    b: constrain(base[2] + random(-25, 25), 0, 255)
  };
}

//////////////////////////////////////////////////////
// SPAWN AURA
//////////////////////////////////////////////////////

function spawnAura(intensity) {

  if (!world) return;
  if (auras.length >= 5) auras.splice(0, 1);  // oudste verwijderen

  let col     = pickAuraColor();
  let offsets = Array.from({length: 8}, () => random(0.6, 1.4));

  auras.push({
    x:          random(width  * 0.15, width  * 0.85),
    y:          random(height * 0.15, height * 0.85),
    size:       world.auraSize * random(1.4, 2.2),
    r: col.r, g: col.g, b: col.b,
    alpha:       0,
    targetAlpha: 65 + intensity * 40,
    offsets:     offsets,
    blobSeed:    random(1000),
    noiseSeedX:  random(1000),
    noiseSeedY:  random(1000),
    phase:       random(TWO_PI)
  });
}

//////////////////////////////////////////////////////
// PLAY ONE NOTE  (gedeelde reverb, geen nieuwe objecten)
//////////////////////////////////////////////////////

function playNote(freq, intensity, release) {

  if (!world || !sharedReverb) return;

  // min 80ms zwischen noten — verhindert Audio-Overload auf iPad
  let now = millis();
  if (now - lastSoundTime < 80) return;
  lastSoundTime = now;

  let osc    = new p5.Oscillator(world.oscType);
  let filter = new p5.LowPass();

  filter.freq(world.filterFreq + random(-200, 200));
  osc.disconnect();
  osc.connect(filter);
  sharedReverb.process(filter, world.reverbTime * 0.5, 2);

  osc.start();
  osc.freq(freq * random(world.detune, world.detune + 0.015));
  osc.amp(0);
  osc.amp(0.08 * intensity, 0.12);  // längerer attack verhindert knacken
  osc.amp(0, release || 1.5);

  let stopTime = ((release || 1.5) + 1) * 1000;

  setTimeout(function() {
    try {
      osc.stop();
      osc.disconnect();
      filter.disconnect();
    } catch(e) {}
  }, stopTime);
}

//////////////////////////////////////////////////////
// PLAY WORLD CHORD
//////////////////////////////////////////////////////

function playWorldChord(freqs, intensity) {

  if (!world) return;
  intensity = intensity || 1;

  spawnAura(intensity);

  for (let i = 0; i < freqs.length; i++) {

    let freq = freqs[i] * random(world.detune, world.detune + 0.02);

    if (random() < world.harmonicChance) {
      freq *= random([0.5, 1, 1.5, 2]);
    }

    playNote(freq, intensity, world.release);
  }
}

//////////////////////////////////////////////////////
// FIRST CHORD
//////////////////////////////////////////////////////

function playBrightnessChord() {
  playWorldChord(random(brightnessChords), 1);
}

//////////////////////////////////////////////////////
// ARPEGGIO  (max 4 noten om overbelasting te voorkomen)
//////////////////////////////////////////////////////

function playArpeggio(notes, intensity, stepMs) {

  if (!world) return;

  let step    = stepMs || 160;
  let limited = notes.slice(0, 4);  // max 4 noten

  for (let i = 0; i < limited.length; i++) {

    let freq = limited[i];

    (function(f, delay) {
      setTimeout(function() {
        if (!world) return;
        playNote(f, intensity || 1, 1.2);
      }, delay);
    })(freq, i * step);
  }

  spawnAura(intensity);
}

//////////////////////////////////////////////////////
// RISING / FALLING / SCATTER
//////////////////////////////////////////////////////

function playRising(baseNotes, intensity) {

  // strikt aufsteigend sortiert
  let notes = [
    ...baseNotes,
    ...baseNotes.map(n => n * 2)
  ].sort((a, b) => a - b);  // low → high

  playArpeggio(notes, intensity, 110);
}

function playFalling(baseNotes, intensity) {

  // strikt absteigend sortiert
  let notes = [
    ...baseNotes.map(n => n * 2),
    ...baseNotes
  ].sort((a, b) => b - a);  // high → low

  playArpeggio(notes, intensity, 120);
}

//////////////////////////////////////////////////////
// HARMONIC VARIATION (für Kopf rechts)
//////////////////////////////////////////////////////

function playHarmonic(baseNotes, intensity) {

  // Quinten und Terzen — klingt anders als rising/falling
  let notes = baseNotes.map(n => n * random([1, 1.25, 1.5, 0.75]));
  notes = notes.sort(() => random() - 0.5);  // leicht zufällig

  playArpeggio(notes, intensity, 150);
}

function playScatter(baseNotes, intensity) {

  let pool = [
    ...baseNotes,
    ...baseNotes.map(n => n * 2),
    ...baseNotes.map(n => n * 0.5)
  ];

  let picked = [];
  for (let i = 0; i < 4; i++) {
    picked.push(random(pool));
  }

  playArpeggio(picked, intensity, 90);
}

//////////////////////////////////////////////////////
// MOUTH
//////////////////////////////////////////////////////

function detectMouth(face) {

  let upperLip = face.scaledMesh[13];
  let lowerLip = face.scaledMesh[14];

  let d = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
  let mouthOpen = d > 15;

  if (mouthOpen && !mouthWasOpen) {
    playScatter(world.scale, 1.3);
  }

  if (mouthOpen && frameCount % 90 === 0) {
    playNote(random(world.scale) * random([1, 2]), 0.6, 1.0);
  }

  mouthWasOpen = mouthOpen;
}

//////////////////////////////////////////////////////
// SMILE
//////////////////////////////////////////////////////

function detectSmile(face) {

  let left  = face.scaledMesh[61];
  let right = face.scaledMesh[291];

  let w       = dist(left[0], left[1], right[0], right[1]);
  let smiling = w > 80;

  if (smiling && !smileWasActive) {
    playRising(world.scale, 1.1);  // aufsteigendes Arpeggio
  }

  smileWasActive = smiling;
}

//////////////////////////////////////////////////////
// EYES CLOSED
//////////////////////////////////////////////////////

function detectEyesClosed(face) {

  let leftTop     = face.scaledMesh[159];
  let leftBottom  = face.scaledMesh[145];
  let rightTop    = face.scaledMesh[386];
  let rightBottom = face.scaledMesh[374];

  let leftEyeOpen  = dist(leftTop[0],  leftTop[1],  leftBottom[0],  leftBottom[1]);
  let rightEyeOpen = dist(rightTop[0], rightTop[1], rightBottom[0], rightBottom[1]);

  let eyesClosed = leftEyeOpen < 10 && rightEyeOpen < 10;

  if (eyesClosed && !eyesWereClosed) {
    playFalling(world.scale, 1.2);
  }

  eyesWereClosed = eyesClosed;
}

//////////////////////////////////////////////////////
// HEAD TILT
//////////////////////////////////////////////////////

function detectHeadTilt(face) {

  let leftEye  = face.scaledMesh[33];
  let rightEye = face.scaledMesh[263];
  let eyeDiff  = leftEye[1] - rightEye[1];

  let tiltedRight = eyeDiff > 15;
  if (tiltedRight && !headRightActive) {
    playHarmonic(world.scale, 1.0);  // harmonische Variation
    spawnAura(0.8);
  }
  headRightActive = tiltedRight;

  let tiltedLeft = eyeDiff < -15;
  if (tiltedLeft && !headLeftActive) {
    playFalling(world.scale, 1.1);  // absteigendes Arpeggio
    spawnAura(0.8);
  }
  headLeftActive = tiltedLeft;
}

//////////////////////////////////////////////////////
// FROWN
//////////////////////////////////////////////////////

function detectFrown(face) {

  let leftBrow  = face.scaledMesh[107];
  let rightBrow = face.scaledMesh[336];

  let browDistance = dist(leftBrow[0], leftBrow[1], rightBrow[0], rightBrow[1]);
  let frowning     = browDistance < 180;

  if (frowning && !frownActive) {
    playScatter(world.scale.map(n => n * 0.5), 1.2);
  }

  frownActive = frowning;
}

//////////////////////////////////////////////////////
// LOOK UP
//////////////////////////////////////////////////////

function detectLookingUp(face) {

  let nose = face.scaledMesh[1];
  let chin = face.scaledMesh[152];

  let verticalDistance = dist(nose[0], nose[1], chin[0], chin[1]);
  let lookingUp        = verticalDistance < 140;

  if (lookingUp && !lookingUpActive) {
    playRising(world.scale.map(n => n * 1.5), 1.0);
  }

  lookingUpActive = lookingUp;
}

//////////////////////////////////////////////////////
// MIRROR
//////////////////////////////////////////////////////

function drawMirror() {

  if (!mirrorPG || mirrorPG.width !== width || mirrorPG.height !== height) {
    if (mirrorPG) mirrorPG.remove();
    mirrorPG = createGraphics(width, height);
  }

  mirrorPG.clear();
  mirrorPG.push();
  mirrorPG.translate(width, 0);
  mirrorPG.scale(-1, 1);
  mirrorPG.image(video, 0, 0, width, height);
  mirrorPG.pop();

  if (blurAmount > 0.5) {
    mirrorPG.filter(BLUR, floor(blurAmount));
  }

  image(mirrorPG, 0, 0);
}

//////////////////////////////////////////////////////
// BLUR UPDATE
//////////////////////////////////////////////////////

function updateBlur() {

  if (predictions.length === 0) {
    blurAmount = lerp(blurAmount, 20, 0.06);
    faceIsSharpEnough = false;
    return;
  }

  let face     = predictions[0];
  let leftEye  = face.scaledMesh[33];
  let rightEye = face.scaledMesh[263];

  let eyeDistance = dist(leftEye[0], leftEye[1], rightEye[0], rightEye[1]);

  let normalized = constrain(map(eyeDistance, 30, 80, 0, 1), 0, 1);

  let targetBlur = (1 - normalized) * 20;
  blurAmount = lerp(blurAmount, targetBlur, 0.06);

  if (normalized > 0.88) {
    blurAmount        = 0;
    faceIsSharpEnough = true;
  } else {
    faceIsSharpEnough = false;
  }
}

//////////////////////////////////////////////////////
// GLASS TEXT
//////////////////////////////////////////////////////

function drawGlassText(alpha) {

  push();

  let pulse  = sin(frameCount * 0.006);
  let glow   = map(pulse, -1, 1, 40, 120);
  let a      = map(pulse, -1, 1, 45, 150) * alpha;
  let floatY = sin(frameCount * 0.004) * 10;

  noStroke();
  textAlign(CENTER, CENTER);
  textSize(96);
  textStyle(BOLD);
  textFont("Fredoka");

  drawingContext.shadowBlur  = glow * alpha;
  drawingContext.shadowColor = "rgba(255,255,255,0.95)";

  drawingContext.filter = "blur(18px)";
  fill(255, a * 0.3);
  text("COME CLOSER", width / 2, height / 2 + floatY);

  drawingContext.filter = "blur(8px)";
  fill(255, a * 0.6);
  text("COME CLOSER", width / 2, height / 2 + floatY);

  drawingContext.filter = "none";
  fill(255, a);
  text("COME CLOSER", width / 2, height / 2 + floatY);

  fill(180, 220, 255, a * 0.3);
  text("COME CLOSER", width / 2 - 3, height / 2 + floatY);

  fill(255, 180, 220, a * 0.3);
  text("COME CLOSER", width / 2 + 3, height / 2 + floatY);

  drawingContext.filter    = "none";
  drawingContext.shadowBlur = 0;

  pop();
}

//////////////////////////////////////////////////////
// AURAS
//////////////////////////////////////////////////////

function drawAuras() {

  noStroke();

  for (let i = auras.length - 1; i >= 0; i--) {

    let a = auras[i];

    // fade in / out
    if (a.alpha < a.targetAlpha) {
      a.alpha = min(a.targetAlpha, a.alpha + 1.5);
    } else {
      a.alpha       *= 0.988;
      a.targetAlpha *= 0.988;
    }

    // vereenvoudigd: 6 lagen i.p.v. 10, 4 blobs i.p.v. 6
    let layers = 6;

    for (let l = layers; l >= 1; l--) {

      let t          = l / layers;
      let layerSize  = a.size * t;
      let layerAlpha = a.alpha * (1 - t) * 0.26;
      let noiseScale = 0.003;
      let warpAmt    = layerSize * 0.25 * (1 - t * 0.5);
      let numBlobs   = 6;

      for (let b = 0; b < numBlobs; b++) {

        let angle = (TWO_PI / numBlobs) * b + a.phase;

        let nVal = noise(
          cos(angle) * noiseScale * a.size + a.blobSeed,
          sin(angle) * noiseScale * a.size + a.blobSeed + floor(frameCount * 0.0005),
          l * 0.1
        );

        let offset = warpAmt * (nVal - 0.5) * 2;
        let bx     = a.x + cos(angle) * offset;
        let by     = a.y + sin(angle) * offset;

        fill(a.r, a.g, a.b, layerAlpha);

        push();
        translate(bx, by);
        scale(
          a.offsets[b % a.offsets.length],
          a.offsets[(b + 2) % a.offsets.length]
        );
        ellipse(0, 0, layerSize);
        pop();
      }

      // zachte kern
      fill(a.r, a.g, a.b, layerAlpha * 1.4);
      ellipse(a.x, a.y, layerSize * 0.6);
    }

    // drift
    let t      = frameCount * 0.0004;
    let driftX = (noise(a.noiseSeedX, t)       - 0.5) * 1.2;
    let driftY = (noise(a.noiseSeedY, t + 100) - 0.5) * 1.2;

    a.x    += driftX;
    a.y    += driftY;
    a.phase += 0.0015;

    a.x = ((a.x % width)  + width)  % width;
    a.y = ((a.y % height) + height) % height;

    if (a.alpha < 0.8) auras.splice(i, 1);
  }
}

//////////////////////////////////////////////////////
// DEBUG
//////////////////////////////////////////////////////

function drawDebug() {

  fill(255);
  noStroke();
  textSize(18);

  text("FACES: " + predictions.length, 20, 40);
  text("BLUR: "  + floor(blurAmount),  20, 70);

  if (world) {
    text("WORLD: " + world.mood, 20, 100);
    // SEED wird nicht angezeigt
  }
}

//////////////////////////////////////////////////////
// AUDIO START
//////////////////////////////////////////////////////

function mousePressed() {

  if (!audioStarted) {
    userStartAudio();
    audioStarted = true;
    console.log("audio started");
  }
}

//////////////////////////////////////////////////////
// RESIZE
//////////////////////////////////////////////////////

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
