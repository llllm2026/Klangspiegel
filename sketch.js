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
// CHORDS — 5 Skalen passend zu den Welten
//////////////////////////////////////////////////////

const scales = {

  himmel: [
    [261.63, 329.63, 392.00, 493.88, 523.25],  // C dur hell
    [293.66, 369.99, 440.00, 554.37, 587.33]
  ],

  erde: [
    [65.41,  82.41,  98.00,  110.00, 130.81],   // sehr tief
    [73.42,  92.50,  110.00, 123.47, 146.83]
  ],

  feuer: [
    [220.00, 261.63, 329.63, 415.30, 493.88],   // pentatonisch scharf
    [246.94, 293.66, 369.99, 440.00, 554.37]
  ],

  traum: [
    [130.81, 155.56, 185.00, 220.00, 261.63],   // moll, dunkel
    [110.00, 130.81, 155.56, 196.00, 220.00]
  ],

  wald: [
    [164.81, 196.00, 220.00, 261.63, 293.66],   // dorisch, rund
    [146.83, 174.61, 207.65, 246.94, 293.66]
  ]
};

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
// AURAS — einfache radiale schwaden
//////////////////////////////////////////////////////

let auras = [];

//////////////////////////////////////////////////////
// COME CLOSER
//////////////////////////////////////////////////////

let comeCloserAlpha = 0;

//////////////////////////////////////////////////////
// AUDIO
//////////////////////////////////////////////////////

let audioStarted   = false;
let lastSoundTime  = 0;
let activeOscCount = 0;
let MAX_OSC        = 5;
let sharedReverb   = null;

//////////////////////////////////////////////////////
// WORLD COLOR PALETTES
//////////////////////////////////////////////////////

const worldColors = {
  himmel: [[100,160,255],[80,140,240],[120,180,255],[60,120,220],[140,200,255]],
  erde:   [[120,60,30],[100,40,20],[150,80,40],[80,30,10],[130,70,35]],
  feuer:  [[255,80,20],[240,120,10],[255,60,40],[220,100,30],[255,140,60]],
  traum:  [[80,40,180],[60,20,160],[100,60,200],[40,20,140],[120,80,220]],
  wald:   [[40,120,60],[30,100,50],[60,150,70],[20,80,40],[50,130,65]]
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
  // MIMIK — alle 3 frames
  //////////////////////////////////

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
  // COME CLOSER
  //////////////////////////////////

  let comeCloserActive =
    predictions.length > 0 &&
    !faceIsSharpEnough;

  if (comeCloserActive && comeCloserAlpha < 0.05) {
    for (let i = 0; i < auras.length; i++) {
      auras[i].targetAlpha = 0;
    }
    getAudioContext().suspend();
    setTimeout(function() { getAudioContext().resume(); }, 150);
  }

  if (comeCloserActive) {
    comeCloserAlpha = min(1, comeCloserAlpha + 0.015);
  } else {
    comeCloserAlpha = max(0, comeCloserAlpha - 0.025);
  }

  if (comeCloserAlpha > 0) drawGlassText(comeCloserAlpha);

  drawDebug();
}

//////////////////////////////////////////////////////
// CREATE WORLD
//////////////////////////////////////////////////////

function createWorld() {

  let palette = detectColorPalette();
  let seed    = floor(random(100000));
  randomSeed(seed);

  //////////////////////////////////
  // klangparameter pro welt
  //////////////////////////////////

  let params = {

    himmel: {
      osc:     "triangle",
      attack:  random(0.3, 0.8),
      release: random(3, 5),
      reverb:  5,
      filter:  2000,
      harmonic: 0.3,
      step:    110   // schnell, lebhaft
    },

    erde: {
      osc:     "sine",
      attack:  random(1.5, 3.0),  // sehr langsam
      release: random(6, 10),
      reverb:  6,
      filter:  300,               // sehr tief gefiltert
      harmonic: 0.2,
      step:    320                // langsam
    },

    feuer: {
      osc:     "triangle",        // warm aber lebendig
      attack:  random(0.05, 0.2), // sehr schnell
      release: random(1, 2.5),
      reverb:  2,
      filter:  3000,
      harmonic: 0.15,
      step:    70                 // sehr schnell
    },

    traum: {
      osc:     "sine",
      attack:  random(2.0, 4.0),  // sehr langsam, schwebend
      release: random(8, 14),     // langer nachhall
      reverb:  12,
      filter:  600,
      harmonic: 0.7,              // viele harmonische
      step:    260
    },

    wald: {
      osc:     "triangle",
      attack:  random(0.4, 1.0),
      release: random(3, 6),
      reverb:  7,
      filter:  800,
      harmonic: 0.45,
      step:    180               // tröpfelnd
    }
  };

  let p = params[palette.name] || params.traum;

  world = {
    mood:           palette.name,
    seed:           seed,
    scale:          random(scales[palette.name] || scales.traum),
    oscType:        p.osc,
    reverbTime:     p.reverb,
    filterFreq:     p.filter,
    detune:         random(0.993, 1.007),
    attack:         p.attack,
    release:        p.release,
    harmonicChance: p.harmonic,
    step:           p.step,
    auraSize:       random(800, 1800)
  };

  if (sharedReverb) {
    try { sharedReverb.disconnect(); } catch(e) {}
  }
  sharedReverb = new p5.Reverb();

  console.log("WORLD:", world.mood, world.seed);
}

//////////////////////////////////////////////////////
// COLOR DETECTION — 5 Welten
//////////////////////////////////////////////////////

function detectColorPalette() {

  video.loadPixels();

  let rT = 0, gT = 0, bT = 0, count = 0;

  for (let y = 120; y < 360; y += 12) {
    for (let x = 160; x < 480; x += 12) {
      let idx = (x + y * video.width) * 4;
      rT += video.pixels[idx];
      gT += video.pixels[idx + 1];
      bT += video.pixels[idx + 2];
      count++;
    }
  }

  let r   = rT / count;
  let g   = gT / count;
  let b   = bT / count;
  let br  = (r + g + b) / 3;       // helligkeit
  let sat = max(r,g,b) - min(r,g,b); // sättigung

  // dominante farbe bestimmt die welt
  // helligkeit als zweite dimension

  let rDom = r / (g + b + 1);   // wie stark dominiert rot
  let gDom = g / (r + b + 1);   // wie stark dominiert grün
  let bDom = b / (r + g + 1);   // wie stark dominiert blau

  // WALD: grün klar dominant
  if (gDom > 0.42 && g > r && g > b)
    return { name: "wald" };

  // HIMMEL: blau dominant + hell
  if (bDom > 0.40 && br > 100)
    return { name: "himmel" };

  // TRAUM: blau dominant + dunkel
  if (bDom > 0.38 && br <= 100)
    return { name: "traum" };

  // FEUER: rot dominant + hell
  if (rDom > 0.42 && br > 110)
    return { name: "feuer" };

  // ERDE: rot dominant + dunkel
  if (rDom > 0.40 && br <= 110)
    return { name: "erde" };

  // fallback nach helligkeit
  if (br > 140) return { name: "himmel" };
  if (br > 80)  return { name: "wald" };
  return { name: "traum" };
}

//////////////////////////////////////////////////////
// PICK AURA COLOR
//////////////////////////////////////////////////////

function pickAuraColor() {

  let palette = worldColors[world ? world.mood : "traum"] || worldColors.traum;
  let base    = random(palette);

  return {
    r: constrain(base[0] + random(-20, 20), 0, 255),
    g: constrain(base[1] + random(-20, 20), 0, 255),
    b: constrain(base[2] + random(-20, 20), 0, 255)
  };
}

//////////////////////////////////////////////////////
// SPAWN AURA — radialer schleier von der mitte
//////////////////////////////////////////////////////

function spawnAura(intensity) {

  if (!world) return;
  if (auras.length >= 4) auras.splice(0, 1);

  let col = pickAuraColor();

  auras.push({
    // startet immer in der mitte
    x:          width  * 0.5 + random(-50, 50),
    y:          height * 0.5 + random(-50, 50),
    maxRadius:  world.auraSize * random(0.5, 0.85),
    radius:     0,
    r: col.r, g: col.g, b: col.b,
    alpha:      0,
    targetAlpha: 90 + intensity * 50,
    speed:      random(0.4, 0.9),   // ausbreitungsgeschwindigkeit
    seed:       random(1000)
  });
}

//////////////////////////////////////////////////////
// PLAY NOTE
//////////////////////////////////////////////////////

function playNote(freq, intensity, release) {

  if (!world || !sharedReverb) return;
  if (activeOscCount >= MAX_OSC) return;

  let now = millis();
  if (now - lastSoundTime < 60) return;
  lastSoundTime = now;

  activeOscCount++;

  let osc    = new p5.Oscillator(world.oscType);
  let filter = new p5.LowPass();

  filter.freq(world.filterFreq + random(-150, 150));
  osc.disconnect();
  osc.connect(filter);
  sharedReverb.process(filter, world.reverbTime, 2);

  osc.start();
  osc.freq(freq * random(world.detune, world.detune + 0.01));
  osc.amp(0);
  osc.amp(0.07 * intensity, world.attack);
  osc.amp(0, release || world.release);

  let stopTime = ((release || world.release) + world.attack + 0.5) * 1000;

  setTimeout(function() {
    try {
      osc.stop();
      osc.disconnect();
      filter.disconnect();
    } catch(e) {}
    activeOscCount = max(0, activeOscCount - 1);
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
    let freq = freqs[i];
    if (random() < world.harmonicChance) freq *= random([0.5, 2]);
    playNote(freq, intensity, world.release);
  }
}

//////////////////////////////////////////////////////
// FIRST CHORD
//////////////////////////////////////////////////////

function playBrightnessChord() {
  if (!world) return;
  playWorldChord(world.scale, 1);
}

//////////////////////////////////////////////////////
// ARPEGGIO
//////////////////////////////////////////////////////

function playArpeggio(notes, intensity, stepMs) {

  if (!world) return;

  let step    = stepMs || world.step || 160;
  let limited = notes.slice(0, 4);

  for (let i = 0; i < limited.length; i++) {
    (function(f, delay) {
      setTimeout(function() {
        if (!world) return;
        playNote(f, intensity || 1, world.release * 0.6);
      }, delay);
    })(limited[i], i * step);
  }

  spawnAura(intensity);
}

function playRising(baseNotes, intensity) {
  let notes = [...baseNotes, ...baseNotes.map(n => n * 2)]
    .sort((a, b) => a - b);
  playArpeggio(notes, intensity);
}

function playFalling(baseNotes, intensity) {
  let notes = [...baseNotes.map(n => n * 2), ...baseNotes]
    .sort((a, b) => b - a);
  playArpeggio(notes, intensity);
}

function playHarmonic(baseNotes, intensity) {
  let notes = baseNotes.map(n => n * random([1, 1.25, 1.5, 0.75]));
  playArpeggio(notes, intensity);
}

function playScatter(baseNotes, intensity) {
  let pool   = [...baseNotes, ...baseNotes.map(n => n * 2), ...baseNotes.map(n => n * 0.5)];
  let picked = [];
  for (let i = 0; i < 4; i++) picked.push(random(pool));
  playArpeggio(picked, intensity);
}

//////////////////////////////////////////////////////
// MOUTH
//////////////////////////////////////////////////////

function detectMouth(face) {

  let upperLip = face.scaledMesh[13];
  let lowerLip = face.scaledMesh[14];
  let d        = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
  let mouthOpen = d > 15;

  if (mouthOpen && !mouthWasOpen) playScatter(world.scale, 1.3);
  if (mouthOpen && frameCount % 90 === 0) playNote(random(world.scale) * random([1, 2]), 0.6, world.release * 0.5);

  mouthWasOpen = mouthOpen;
}

//////////////////////////////////////////////////////
// SMILE
//////////////////////////////////////////////////////

function detectSmile(face) {

  let left    = face.scaledMesh[61];
  let right   = face.scaledMesh[291];
  let w       = dist(left[0], left[1], right[0], right[1]);
  let smiling = w > 80;

  if (smiling && !smileWasActive) playRising(world.scale, 1.1);

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

  let leftOpen  = dist(leftTop[0],  leftTop[1],  leftBottom[0],  leftBottom[1]);
  let rightOpen = dist(rightTop[0], rightTop[1], rightBottom[0], rightBottom[1]);
  let closed    = leftOpen < 10 && rightOpen < 10;

  if (closed && !eyesWereClosed) playFalling(world.scale, 1.2);

  eyesWereClosed = closed;
}

//////////////////////////////////////////////////////
// HEAD TILT
//////////////////////////////////////////////////////

function detectHeadTilt(face) {

  let leftEye  = face.scaledMesh[33];
  let rightEye = face.scaledMesh[263];
  let eyeDiff  = leftEye[1] - rightEye[1];

  let tiltedRight = eyeDiff > 15;
  if (tiltedRight && !headRightActive) { playHarmonic(world.scale, 1.0); spawnAura(0.8); }
  headRightActive = tiltedRight;

  let tiltedLeft = eyeDiff < -15;
  if (tiltedLeft && !headLeftActive) { playFalling(world.scale, 1.1); spawnAura(0.8); }
  headLeftActive = tiltedLeft;
}

//////////////////////////////////////////////////////
// FROWN
//////////////////////////////////////////////////////

function detectFrown(face) {

  let leftBrow  = face.scaledMesh[107];
  let rightBrow = face.scaledMesh[336];
  let browDist  = dist(leftBrow[0], leftBrow[1], rightBrow[0], rightBrow[1]);
  let frowning  = browDist < 180;

  if (frowning && !frownActive) playScatter(world.scale.map(n => n * 0.5), 1.2);

  frownActive = frowning;
}

//////////////////////////////////////////////////////
// LOOK UP
//////////////////////////////////////////////////////

function detectLookingUp(face) {

  let nose   = face.scaledMesh[1];
  let chin   = face.scaledMesh[152];
  let vDist  = dist(nose[0], nose[1], chin[0], chin[1]);
  let lookUp = vDist < 140;

  if (lookUp && !lookingUpActive) playRising(world.scale.map(n => n * 1.5), 1.0);

  lookingUpActive = lookUp;
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
  let normalized  = constrain(map(eyeDistance, 30, 80, 0, 1), 0, 1);

  blurAmount = lerp(blurAmount, (1 - normalized) * 20, 0.06);

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
// DRAW AURAS — radiale schwaden von der mitte
//////////////////////////////////////////////////////

function drawAuras() {

  noStroke();

  for (let i = auras.length - 1; i >= 0; i--) {

    let a = auras[i];

    // radius wächst nach außen
    a.radius += a.speed;

    // alpha: einblenden dann ausblenden
    if (a.alpha < a.targetAlpha) {
      a.alpha += 2;
    } else {
      a.alpha       *= 0.985;
      a.targetAlpha *= 0.985;
    }

    // weiche schichten: innen hell, außen transparent
    let rings = 6;
    for (let r = rings; r >= 1; r--) {

      let t         = r / rings;
      let ringR     = a.radius * t;
      // kern hell, rand transparent
      let ringAlpha = a.alpha * (1 - t + 0.1) * 1.2;

      let nVal   = noise(a.seed + r * 0.4 + frameCount * 0.002);
      let wobble = map(nVal, 0, 1, 0.88, 1.12);

      fill(a.r, a.g, a.b, ringAlpha);
      ellipse(a.x, a.y, ringR * 2 * wobble, ringR * 2 / wobble);
    }

    // heller kern
    fill(a.r, a.g, a.b, a.alpha * 0.6);
    ellipse(a.x, a.y, a.radius * 0.3, a.radius * 0.3);

    // remove wenn zu groß oder zu transparent
    if (a.radius > a.maxRadius || a.alpha < 0.5) {
      auras.splice(i, 1);
    }
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
    // seed unsichtbar
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
