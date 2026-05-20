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
    createKlangwelt();
    playBrightnessChord();
  }

  faceDetectedBefore = faceDetected;

  //////////////////////////////////
  // MIMIK
  //////////////////////////////////

  if (predictions.length > 0 && faceIsSharpEnough && klangwelt && frameCount % 3 === 0) {

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
  // Nur anzeigen wenn Gesicht sichtbar aber noch nicht nah genug
  // Verschwindet wenn kein Gesicht oder wenn nah genug
  //////////////////////////////////

  let comeCloserActive =
    predictions.length > 0 &&
    !faceIsSharpEnough;

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
    // Fade out sowohl wenn kein Gesicht als auch wenn nah genug
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

  console.log("KLANGWELT:", klangwelt.stimmung, klangwelt.seed);
}

//////////////////////////////////////////////////////
// KLANGFARBE DETECTION
// 5 Klangwelten basierend auf Helligkeit und Farbdominanz
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
  let hell       = brightness > 110;

  // Klangwelt Himmel: Hell + Blau dominant
  // Töne hell, fröhlich, langer Klang, lebendige Melodien
  if (hell && b > r * 1.05 && b > g * 1.02)
    return { name: "himmel", osc: "triangle", reverb: 7, filter: 1200, release: random(4, 7), arpeggioStep: 100 };

  // Klangwelt Feuer: Hell + Rot dominant
  // Töne scharf, schnelle Abfolge, blechend
  if (hell && r > g * 1.1 && r > b * 1.1)
    return { name: "feuer",  osc: "sawtooth", reverb: 2, filter: 2000, release: random(1, 2.5), arpeggioStep: 60  };

  // Klangwelt Wald: Hell + Grün dominant
  // Töne dunkler, tröpfelnd, harmonisch
  if (hell && g > r * 1.05 && g > b * 1.05)
    return { name: "wald",   osc: "triangle", reverb: 5, filter: 600,  release: random(2, 4),   arpeggioStep: 180 };

  // Klangwelt Traum: Dunkel + Blau dominant
  // Töne verträumt, sehr harmonisch, langer Nachhall
  if (!hell && b > r * 1.03 && b > g * 1.01)
    return { name: "traum",  osc: "sine",     reverb: 10, filter: 700, release: random(5, 9),   arpeggioStep: 200 };

  // Klangwelt Erde: Dunkel + Rot dominant (oder dunkel neutral)
  // Töne tief, brummend, langsame Abfolge
  return   { name: "erde",   osc: "sine",     reverb: 4, filter: 300,  release: random(3, 6),   arpeggioStep: 250 };
}

//////////////////////////////////////////////////////
// PICK AURA COLOR
//////////////////////////////////////////////////////

function pickAuraColor() {

  let palette = klangweltColors[klangwelt ? klangwelt.stimmung : "traum"] || klangweltColors.traum;
  let base    = random(palette);

  return {
    r: constrain(base[0] + random(-20, 20), 0, 255),
    g: constrain(base[1] + random(-20, 20), 0, 255),
    b: constrain(base[2] + random(-20, 20), 0, 255)
  };
}

//////////////////////////////////////////////////////
// SPAWN AURA
//////////////////////////////////////////////////////

function spawnAura(intensity) {

  if (!klangwelt) return;
  if (auras.length >= 5) auras.splice(0, 1);

  let col     = pickAuraColor();
  let offsets = Array.from({length: 8}, () => random(0.6, 1.4));

  auras.push({
    x:          random(width  * 0.15, width  * 0.85),
    y:          random(height * 0.15, height * 0.85),
    size:       klangwelt.auraSize * random(1.4, 2.2),
    r: col.r, g: col.g, b: col.b,
    alpha:       0,
    targetAlpha: 55 + intensity * 30,   // etwas gedämpfter als vorher
    offsets:     offsets,
    blobSeed:    random(1000),
    noiseSeedX:  random(1000),
    noiseSeedY:  random(1000),
    phase:       random(TWO_PI)
  });
}

//////////////////////////////////////////////////////
// PLAY ONE NOTE
//////////////////////////////////////////////////////

function playNote(freq, intensity, release) {

  if (!klangwelt || !sharedReverb) return;

  let now = millis();
  if (now - lastSoundTime < 80) return;
  lastSoundTime = now;

  let osc    = new p5.Oscillator(klangwelt.oscType);
  let filter = new p5.LowPass();

  filter.freq(klangwelt.filterFreq + random(-200, 200));
  osc.disconnect();
  osc.connect(filter);
  sharedReverb.process(filter, klangwelt.reverbTime * 0.5, 2);

  osc.start();
  osc.freq(freq * random(klangwelt.detune, klangwelt.detune + 0.015));
  osc.amp(0);
  osc.amp(0.08 * intensity, 0.12);
  osc.amp(0, release || klangwelt.release);

  let stopTime = ((release || klangwelt.release) + 1) * 1000;

  setTimeout(function() {
    try {
      osc.stop();
      osc.disconnect();
      filter.disconnect();
    } catch(e) {}
  }, stopTime);
}

//////////////////////////////////////////////////////
// PLAY KLANGWELT CHORD
//////////////////////////////////////////////////////

function playKlangweltChord(freqs, intensity) {

  if (!klangwelt) return;
  intensity = intensity || 1;

  spawnAura(intensity);

  for (let i = 0; i < freqs.length; i++) {

    let freq = freqs[i] * random(klangwelt.detune, klangwelt.detune + 0.02);

    if (random() < klangwelt.harmonicChance) {
      freq *= random([0.5, 1, 1.5, 2]);
    }

    playNote(freq, intensity, klangwelt.release);
  }
}

//////////////////////////////////////////////////////
// FIRST CHORD
//////////////////////////////////////////////////////

function playBrightnessChord() {
  playKlangweltChord(random(brightnessChords), 1);
}

//////////////////////////////////////////////////////
// ARPEGGIO
//////////////////////////////////////////////////////

function playArpeggio(notes, intensity, stepMs) {

  if (!klangwelt) return;

  // Klangwelt-spezifischer Step wenn keiner übergeben
  let step    = stepMs || klangwelt.arpeggioStep;
  let limited = notes.slice(0, 4);

  for (let i = 0; i < limited.length; i++) {

    let freq = limited[i];

    (function(f, delay) {
      setTimeout(function() {
        if (!klangwelt) return;
        playNote(f, intensity || 1, klangwelt.release * 0.7);
      }, delay);
    })(freq, i * step);
  }

  spawnAura(intensity);
}

//////////////////////////////////////////////////////
// RISING / FALLING / SCATTER / HARMONIC
//////////////////////////////////////////////////////

function playRising(baseNotes, intensity) {

  let notes = [
    ...baseNotes,
    ...baseNotes.map(n => n * 2)
  ].sort((a, b) => a - b);

  playArpeggio(notes, intensity);
}

function playFalling(baseNotes, intensity) {

  let notes = [
    ...baseNotes.map(n => n * 2),
    ...baseNotes
  ].sort((a, b) => b - a);

  playArpeggio(notes, intensity);
}

function playHarmonic(baseNotes, intensity) {

  let notes = baseNotes.map(n => n * random([1, 1.25, 1.5, 0.75]));
  notes = notes.sort(() => random() - 0.5);

  playArpeggio(notes, intensity);
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

  playArpeggio(picked, intensity);
}

//////////////////////////////////////////////////////
// O-MUND SEQUENZ (neue Akkordsequenz)
//////////////////////////////////////////////////////

function playOSequenz(baseNotes, intensity) {

  // Runde, volle Akkorde — passend zu O-Form
  let notes = [
    baseNotes[0],
    baseNotes[0] * 1.5,
    baseNotes[1] || baseNotes[0] * 2,
    (baseNotes[1] || baseNotes[0] * 2) * 1.5
  ];

  playArpeggio(notes, intensity);
}

//////////////////////////////////////////////////////
// MOUTH (Mund offen = O-Form oder weit offen)
//////////////////////////////////////////////////////

function detectMouth(face) {

  let upperLip  = face.scaledMesh[13];
  let lowerLip  = face.scaledMesh[14];
  let leftMouth = face.scaledMesh[61];
  let rightMouth= face.scaledMesh[291];

  let openDist  = dist(upperLip[0], upperLip[1], lowerLip[0], lowerLip[1]);
  let mouthWidth= dist(leftMouth[0], leftMouth[1], rightMouth[0], rightMouth[1]);

  // O-Form: mund offen aber schmal (Breite/Höhe-Verhältnis)
  let isO       = openDist > 12 && mouthWidth < openDist * 2.2;
  // Weit offen: sehr großes Öffnen
  let mouthOpen = openDist > 20;

  if (isO && !mouthWasO) {
    playOSequenz(klangwelt.scale, 1.2);
  }

  if (mouthOpen && !mouthWasOpen && !isO) {
    playScatter(klangwelt.scale, 1.3);
  }

  if (mouthOpen && frameCount % 90 === 0) {
    playNote(random(klangwelt.scale) * random([1, 2]), 0.6, 1.0);
  }

  mouthWasO    = isO;
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
    playRising(klangwelt.scale, 1.1);
  }

  smileWasActive = smiling;
}

//////////////////////////////////////////////////////
// EYES CLOSED — sensitiver: kleinere Schwelle
//////////////////////////////////////////////////////

function detectEyesClosed(face) {

  let leftTop     = face.scaledMesh[159];
  let leftBottom  = face.scaledMesh[145];
  let rightTop    = face.scaledMesh[386];
  let rightBottom = face.scaledMesh[374];

  let leftEyeOpen  = dist(leftTop[0],  leftTop[1],  leftBottom[0],  leftBottom[1]);
  let rightEyeOpen = dist(rightTop[0], rightTop[1], rightBottom[0], rightBottom[1]);

  // Schwelle von 10 auf 14 erhöht → sensitiver
  let eyesClosed = leftEyeOpen < 14 && rightEyeOpen < 14;

  if (eyesClosed && !eyesWereClosed) {
    playFalling(klangwelt.scale, 1.2);
  }

  eyesWereClosed = eyesClosed;
}

//////////////////////////////////////////////////////
// HEAD TILT — Links und Rechts mit eigenen Sequenzen
//////////////////////////////////////////////////////

function detectHeadTilt(face) {

  let leftEye  = face.scaledMesh[33];
  let rightEye = face.scaledMesh[263];
  let eyeDiff  = leftEye[1] - rightEye[1];

  // Kopf nach rechts geneigt
  let tiltedRight = eyeDiff > 15;
  if (tiltedRight && !headRightActive) {
    playHarmonic(klangwelt.scale, 1.0);
    spawnAura(0.8);
  }
  headRightActive = tiltedRight;

  // Kopf nach links geneigt
  let tiltedLeft = eyeDiff < -15;
  if (tiltedLeft && !headLeftActive) {
    playRising(klangwelt.scale, 1.1);
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
    playScatter(klangwelt.scale.map(n => n * 0.5), 1.2);
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
    playRising(klangwelt.scale.map(n => n * 1.5), 1.0);
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
// AURAS — schnelleres Verschwinden
//////////////////////////////////////////////////////

function drawAuras() {

  noStroke();

  for (let i = auras.length - 1; i >= 0; i--) {

    let a = auras[i];

    // Fade in / out — schneller als vorher (0.975 statt 0.988)
    if (a.alpha < a.targetAlpha) {
      a.alpha = min(a.targetAlpha, a.alpha + 1.5);
    } else {
      a.alpha       *= 0.975;
      a.targetAlpha *= 0.975;
    }

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

      fill(a.r, a.g, a.b, layerAlpha * 1.4);
      ellipse(a.x, a.y, layerSize * 0.6);
    }

    let t      = frameCount * 0.0004;
    let driftX = (noise(a.noiseSeedX, t)       - 0.5) * 1.2;
    let driftY = (noise(a.noiseSeedY, t + 100) - 0.5) * 1.2;

    a.x    += driftX;
    a.y    += driftY;
    a.phase += 0.0015;

    a.x = ((a.x % width)  + width)  % width;
    a.y = ((a.y % height) + height) % height;

    // Schneller entfernen: Schwelle von 0.8 auf 2
    if (a.alpha < 2) auras.splice(i, 1);
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

  if (klangwelt) {
    text("KLANGWELT: " + klangwelt.stimmung, 20, 100);
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
