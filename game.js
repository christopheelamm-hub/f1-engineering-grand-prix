
const canvas = document.getElementById("track");
const ctx = canvas.getContext("2d");

const startScreen = document.getElementById("start-screen");
const gameScreen = document.getElementById("game-screen");
const resultsScreen = document.getElementById("results-screen");

const startBtn = document.getElementById("start-btn");
const accelerateBtn = document.getElementById("accelerate");
const brakeBtn = document.getElementById("brake");
const boostBtn = document.getElementById("boost");
const aeroBtn = document.getElementById("aero");

const speedDisplay = document.getElementById("speed");
const batteryDisplay = document.getElementById("battery");
const lapDisplay = document.getElementById("lap");
const timerDisplay = document.getElementById("timer");
const bestLapDisplay = document.getElementById("best-lap");
const boostStatus = document.getElementById("boost-status");
const message = document.getElementById("race-message");
const lapList = document.getElementById("lap-list");

// Continuous oval circuit
const track = {
  left: 245,
  right: 655,
  centerY: 275,
  radius: 145
};

const straightLength = track.right - track.left;
const cornerLength = Math.PI * track.radius;
const totalLength = 2 * straightLength + 2 * cornerLength;

const player = {
  name: "",
  color: "#ff3030",
  distance: 0,
  speed: 0,
  battery: 80,
  aero: "LOW DRAG",
  lap: 1,
  lapStartTime: 0,
  time: 0,
  lapTimes: [],
  bestLap: Infinity,
  running: false
};

const controls = {
  accelerate: false,
  brake: false,
  boost: false
};

let lastFrame = null;
let boostActive = false;

// Format seconds as minutes:seconds.milliseconds
function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return "--:--.---";

  const ms = Math.floor(seconds * 1000 + 0.00001);
  const minutes = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  const millis = ms % 1000;

  return minutes + ":" +
    String(secs).padStart(2, "0") + "." +
    String(millis).padStart(3, "0");
}

// Position of car on circuit
function trackPosition(distance) {
  let d = ((distance % totalLength) + totalLength)
    % totalLength;

  if (d < straightLength) {
    return {
      x: track.left + d,
      y: track.centerY - track.radius,
      angle: 0,
      corner: false
    };
  }

  d -= straightLength;

  if (d < cornerLength) {
    const a = -Math.PI / 2 + d / track.radius;
    return {
      x: track.right + track.radius * Math.cos(a),
      y: track.centerY + track.radius * Math.sin(a),
      angle: a + Math.PI / 2,
      corner: true
    };
  }

  d -= cornerLength;

  if (d < straightLength) {
    return {
      x: track.right - d,
      y: track.centerY + track.radius,
      angle: Math.PI,
      corner: false
    };
  }

  d -= straightLength;

  const a = Math.PI / 2 + d / track.radius;

  return {
    x: track.left + track.radius * Math.cos(a),
    y: track.centerY + track.radius * Math.sin(a),
    angle: a + Math.PI / 2,
    corner: true
  };
}

// Draw the circuit
function drawTrack() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#244b35";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();

  for (let i = 0; i <= 400; i++) {
    const p = trackPosition(totalLength * i / 400);

    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }

  ctx.closePath();

  ctx.lineWidth = 76;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#34383e";
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#dddddd";
  ctx.setLineDash([12, 15]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Finish line
  const start = trackPosition(0);

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      ctx.fillStyle =
        (i + j) % 2 === 0 ? "#ffffff" : "#111111";

      ctx.fillRect(
        start.x - 8 + j * 8,
        start.y - 38 + i * 9.5,
        8,
        9.5
      );
    }
  }

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 20px Arial";
  ctx.fillText("F1 ENGINEERING GP", 340, 275);

  ctx.font = "15px Arial";
  ctx.fillText("LOW DRAG ON STRAIGHTS", 350, 305);
}

// Draw car
function drawCar() {
  const p = trackPosition(player.distance);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  if (boostActive) {
    ctx.fillStyle = "#00aaff";
    ctx.beginPath();
    ctx.moveTo(-17, -5);
    ctx.lineTo(-42, 0);
    ctx.lineTo(-17, 5);
    ctx.fill();
  }

  ctx.fillStyle = player.color;
  ctx.fillRect(-18, -8, 36, 16);

  ctx.fillStyle = "#111111";
  ctx.fillRect(-12, -13, 10, 6);
  ctx.fillRect(-12, 7, 10, 6);
  ctx.fillRect(8, -13, 10, 6);
  ctx.fillRect(8, 7, 10, 6);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(4, -4, 8, 8);

  ctx.restore();
}

// Refresh lap history
function updateLapHistory() {
  lapList.innerHTML = "";

  player.lapTimes.forEach((time, index) => {
    const row = document.createElement("div");
    row.className = "lap-row";

    if (Math.abs(time - player.bestLap) < 0.000001) {
      row.classList.add("fastest");
    }

    const label = document.createElement("span");
    label.textContent = "LAP " + (index + 1);

    const value = document.createElement("strong");
    value.textContent = formatTime(time);

    row.append(label, value);
    lapList.appendChild(row);
  });
}

// Arcade engineering physics
function update(dt) {
  const position = trackPosition(player.distance);
  const corner = position.corner;

  let acceleration = 0;

  // Engine acceleration
  if (controls.accelerate) {
    acceleration += 35;
  }

  // Aerodynamic drag grows with speed squared
  const dragCoefficient =
    player.aero === "LOW DRAG" ? 0.00012 : 0.00026;

  acceleration -=
    dragCoefficient * player.speed * player.speed;

  // Braking + MGU-K recovery
  if (controls.brake) {
    acceleration -= 95;

    if (player.speed > 20) {
      player.battery = Math.min(
        100,
        player.battery + 28 * dt
      );
    }
  }

  // Electric boost: strong, noticeable acceleration
  boostActive =
    controls.boost &&
    controls.accelerate &&
    !controls.brake &&
    player.battery > 0;

  if (boostActive) {
    acceleration += 55;

    player.battery = Math.max(
      0,
      player.battery - 32 * dt
    );
  }

  player.speed = Math.max(
    0,
    Math.min(340, player.speed + acceleration * dt)
  );

  // Higher downforce gives more cornering grip
  const cornerLimit =
    player.aero === "HIGH DOWNFORCE" ? 220 : 145;

  if (corner && player.speed > cornerLimit) {
    player.speed = Math.max(
      cornerLimit,
      player.speed - 180 * dt
    );

    message.textContent =
      "GRIP LOST! Brake earlier or use HIGH DOWNFORCE.";
    message.style.color = "#ff5555";
  } else if (corner) {
    message.textContent =
      "CORNER: High downforce allows faster cornering.";
    message.style.color = "#ffffff";
  } else if (boostActive) {
    message.textContent =
      "MGU-K DEPLOYED! Electric power increases acceleration.";
    message.style.color = "#00aaff";
  } else {
    message.textContent =
      "STRAIGHT: Low drag reduces resistance.";
    message.style.color = "#ffffff";
  }

  const oldDistance = player.distance;

  // Convert speed from km/h to m/s
  player.distance += (player.speed / 3.6) * dt;
  player.time += dt;

  // Record exact lap crossing, including within a frame
  const previousLaps = Math.floor(
    oldDistance / totalLength
  );

  const completedLaps = Math.min(
    3,
    Math.floor(player.distance / totalLength)
  );

  if (completedLaps > previousLaps) {
    const crossingDistance =
      (previousLaps + 1) * totalLength;

    const fraction = Math.max(
      0,
      Math.min(
        1,
        (crossingDistance - oldDistance) /
        (player.distance - oldDistance)
      )
    );

    const crossingTime =
      player.time - dt + fraction * dt;

    const lapTime =
      crossingTime - player.lapStartTime;

    player.lapTimes.push(lapTime);
    player.lapStartTime = crossingTime;

    if (lapTime < player.bestLap) {
      player.bestLap = lapTime;
      bestLapDisplay.textContent = formatTime(lapTime);
    }

    updateLapHistory();

    if (completedLaps >= 3) {
      finishRace();
      return;
    }
  }

  player.lap = completedLaps + 1;

  speedDisplay.textContent = Math.round(player.speed);
  batteryDisplay.textContent = Math.round(player.battery);
  lapDisplay.textContent = player.lap + " / 3";

  timerDisplay.textContent =
    formatTime(player.time - player.lapStartTime);

  boostStatus.textContent =
    boostActive ? "ACTIVE" :
    player.battery > 0 ? "READY" : "EMPTY";

  boostBtn.classList.toggle("active", boostActive);
}

// Animation
function gameLoop(timestamp) {
  if (!player.running) return;

  if (lastFrame === null) lastFrame = timestamp;

  const dt = Math.min(
    (timestamp - lastFrame) / 1000,
    0.05
  );

  lastFrame = timestamp;

  update(dt);
  drawTrack();
  drawCar();

  if (player.running) {
    requestAnimationFrame(gameLoop);
  }
}

// Finish and display results
function finishRace() {
  player.running = false;
  boostActive = false;

  controls.accelerate = false;
  controls.brake = false;
  controls.boost = false;

  gameScreen.hidden = true;
  resultsScreen.hidden = false;

  document.getElementById("driver-result").textContent =
    player.name + " completed three laps!";

  document.getElementById("final-time").textContent =
    formatTime(player.bestLap);

  const finalLaps = document.getElementById("final-laps");
  finalLaps.innerHTML = "";

  player.lapTimes.forEach((time, index) => {
    const row = document.createElement("div");
    row.className = "lap-row";

    if (Math.abs(time - player.bestLap) < 0.000001) {
      row.classList.add("fastest");
    }

    const label = document.createElement("span");
    label.textContent = "Lap " + (index + 1);

    const value = document.createElement("strong");
    value.textContent = formatTime(time);

    row.append(label, value);
    finalLaps.appendChild(row);
  });

  // Save personal record on this browser
  const key = "f1-best-lap";
  const previous = Number(localStorage.getItem(key));

  if (!previous || player.bestLap < previous) {
    localStorage.setItem(key, String(player.bestLap));

    document.getElementById("personal-record").textContent =
      "NEW PERSONAL BEST!";
  } else {
    document.getElementById("personal-record").textContent =
      "Personal record: " + formatTime(previous);
  }
}

// Start a fresh race
function startRace() {
  player.name =
    document.getElementById("player-name").value.trim()
    || "Driver";

  player.color =
    document.getElementById("car-color").value;

  player.distance = 0;
  player.speed = 0;
  player.battery = 80;
  player.aero = "LOW DRAG";
  player.lap = 1;
  player.time = 0;
  player.lapStartTime = 0;
  player.lapTimes = [];
  player.bestLap = Infinity;
  player.running = true;

  controls.accelerate = false;
  controls.brake = false;
  controls.boost = false;

  aeroBtn.textContent = "LOW DRAG";
  bestLapDisplay.textContent = "--:--.---";
  timerDisplay.textContent = "0:00.000";
  lapDisplay.textContent = "1 / 3";
  batteryDisplay.textContent = "80";
  speedDisplay.textContent = "0";
  boostStatus.textContent = "READY";
  lapList.innerHTML =
    "<p>Complete your first lap to see your times.</p>";

  startScreen.hidden = true;
  resultsScreen.hidden = true;
  gameScreen.hidden = false;

  lastFrame = null;
  requestAnimationFrame(gameLoop);
}

// Touch and mouse controls
function holdButton(button, control) {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    controls[control] = true;
  });

  const release = () => {
    controls[control] = false;
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", release);
}

holdButton(accelerateBtn, "accelerate");
holdButton(brakeBtn, "brake");
holdButton(boostBtn, "boost");

// Aerodynamic mode toggle
aeroBtn.addEventListener("click", () => {
  if (!player.running) return;

  player.aero =
    player.aero === "LOW DRAG"
      ? "HIGH DOWNFORCE"
      : "LOW DRAG";

  aeroBtn.textContent = player.aero;
});

// Keyboard controls
const keyMap = {
  ArrowUp: "accelerate",
  ArrowDown: "brake",
  " ": "boost"
};

document.addEventListener("keydown", event => {
  if (!player.running) return;

  if (keyMap[event.key]) {
    event.preventDefault();
    controls[keyMap[event.key]] = true;
  }

  if (event.key.toLowerCase() === "a" && !event.repeat) {
    aeroBtn.click();
  }
});

document.addEventListener("keyup", event => {
  if (keyMap[event.key]) {
    controls[keyMap[event.key]] = false;
  }
});

window.addEventListener("blur", () => {
  controls.accelerate = false;
  controls.brake = false;
  controls.boost = false;
});

startBtn.addEventListener("click", startRace);

drawTrack();
