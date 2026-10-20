
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
const message = document.getElementById("race-message");

// Track geometry: an oval with two straights and two corners
const track = {
  left: 240,
  right: 660,
  top: 275,
  bottom: 275,
  radius: 145
};

const straightLength = track.right - track.left;
const cornerLength = Math.PI * track.radius;
const totalLength = 2 * straightLength + 2 * cornerLength;

let player = {
  name: "",
  color: "#ff3030",
  distance: 0,
  speed: 0,
  battery: 80,
  aero: "LOW DRAG",
  lap: 1,
  time: 0,
  running: false
};

let controls = {
  accelerate: false,
  brake: false,
  boost: false
};

let lastFrame = 0;
let animationId = null;

// Find the car's position and direction on the track
function trackPosition(distance) {
  let d = ((distance % totalLength) + totalLength) % totalLength;

  if (d < straightLength) {
    return {
      x: track.left + d,
      y: track.top - track.radius,
      angle: 0,
      corner: false
    };
  }

  d -= straightLength;

  if (d < cornerLength) {
    const a = -Math.PI / 2 + d / track.radius;
    return {
      x: track.right + track.radius * Math.cos(a),
      y: track.top + track.radius * Math.sin(a),
      angle: a + Math.PI / 2,
      corner: true
    };
  }

  d -= cornerLength;

  if (d < straightLength) {
    return {
      x: track.right - d,
      y: track.bottom + track.radius,
      angle: Math.PI,
      corner: false
    };
  }

  d -= straightLength;

  const a = Math.PI / 2 + d / track.radius;
  return {
    x: track.left + track.radius * Math.cos(a),
    y: track.bottom + track.radius * Math.sin(a),
    angle: a + Math.PI / 2,
    corner: true
  };
}

// Draw a simple circuit that fits the canvas
function drawTrack() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#244b35";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.beginPath();
  for (let i = 0; i <= 300; i++) {
    const p = trackPosition(totalLength * i / 300);
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }

  ctx.closePath();
  ctx.strokeStyle = "#44484f";
  ctx.lineWidth = 65;
  ctx.lineJoin = "round";
  ctx.stroke();

  ctx.setLineDash([12, 14]);
  ctx.strokeStyle = "#dddddd";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.setLineDash([]);

  // Start / finish line
  const start = trackPosition(0);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(start.x - 3, start.y - 32, 6, 64);
}

// Draw player's car
function drawCar() {
  const p = trackPosition(player.distance);

  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);

  ctx.fillStyle = player.color;
  ctx.fillRect(-17, -8, 34, 16);

  ctx.fillStyle = "#111111";
  ctx.fillRect(-10, -12, 9, 5);
  ctx.fillRect(-10, 7, 9, 5);
  ctx.fillRect(8, -12, 9, 5);
  ctx.fillRect(8, 7, 9, 5);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(3, -4, 7, 8);

  ctx.restore();
}

// Simplified arcade physics, not a real F1 simulation
function update(dt) {
  const p = trackPosition(player.distance);
  const corner = p.corner;

  let acceleration = 0;

  if (controls.accelerate) {
    acceleration += 18;
  }

  // Aerodynamic drag increases with speed squared
  const dragFactor = player.aero === "LOW DRAG" ? 0.00011 : 0.00020;
  acceleration -= dragFactor * player.speed * player.speed;

  if (controls.brake) {
    acceleration -= 65;

    // MGU-K recovers energy under braking
    if (player.speed > 30) {
      player.battery = Math.min(100, player.battery + 13 * dt);
    }
  }

  if (controls.boost && player.battery > 0 && !controls.brake) {
    acceleration += 12;
    player.battery = Math.max(0, player.battery - 22 * dt);
  }

  player.speed = Math.max(
    0,
    Math.min(340, player.speed + acceleration * dt)
  );

  // Downforce improves allowable cornering speed
  const cornerLimit = player.aero === "HIGH DOWNFORCE" ? 205 : 145;

  if (corner && player.speed > cornerLimit) {
    player.speed = Math.max(
      cornerLimit,
      player.speed - 120 * dt
    );

    message.textContent =
      "GRIP LOST! Too fast for this corner. Use high downforce and brake earlier.";
    message.style.color = "#ff5555";
  } else if (corner) {
    message.textContent = "CORNER: High downforce gives you more grip.";
    message.style.color = "#ffffff";
  } else {
    message.textContent = "STRAIGHT: Low drag improves speed. Use MGU-K boost!";
    message.style.color = "#ffffff";
  }

  // Convert km/h to metres per second
  player.distance += (player.speed / 3.6) * dt;
  player.time += dt;

  if (player.distance >= totalLength * 3) {
    finishRace();
    return;
  }

  player.lap = Math.floor(player.distance / totalLength) + 1;

  speedDisplay.textContent = Math.round(player.speed);
  batteryDisplay.textContent = Math.round(player.battery);
  lapDisplay.textContent = player.lap + " / 3";
  timerDisplay.textContent = player.time.toFixed(2);
}

function gameLoop(timestamp) {
  if (!player.running) return;

  if (!lastFrame) lastFrame = timestamp;
  const dt = Math.min((timestamp - lastFrame) / 1000, 0.05);
  lastFrame = timestamp;

  update(dt);
  drawTrack();
  drawCar();

  if (player.running) {
    animationId = requestAnimationFrame(gameLoop);
  }
}

function finishRace() {
  player.running = false;
  controls.accelerate = false;
  controls.brake = false;
  controls.boost = false;

  gameScreen.hidden = true;
  resultsScreen.hidden = false;

  document.getElementById("final-time").textContent =
    player.name + " — " + player.time.toFixed(2) + " seconds";

  const key = "f1-best-time";
  const previous = Number(localStorage.getItem(key));

  if (!previous || player.time < previous) {
    localStorage.setItem(key, player.time.toFixed(2));
  }
}

function startRace() {
  player.name =
    document.getElementById("player-name").value.trim() || "Driver";

  player.color = document.getElementById("car-color").value;
  player.distance = 0;
  player.speed = 0;
  player.battery = 80;
  player.aero = "LOW DRAG";
  player.lap = 1;
  player.time = 0;
  player.running = true;

  startScreen.hidden = true;
  resultsScreen.hidden = true;
  gameScreen.hidden = false;

  lastFrame = 0;
  requestAnimationFrame(gameLoop);
}

function holdButton(button, control) {
  button.addEventListener("pointerdown", (event) => {
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

aeroBtn.addEventListener("click", () => {
  player.aero =
    player.aero === "LOW DRAG" ? "HIGH DOWNFORCE" : "LOW DRAG";

  aeroBtn.textContent = player.aero;
});

// Keyboard controls for desktop testing
const keyMap = {
  ArrowUp: "accelerate",
  ArrowDown: "brake",
  " ": "boost"
};

document.addEventListener("keydown", (event) => {
  if (!player.running) return;

  if (keyMap[event.key]) {
    event.preventDefault();
    controls[keyMap[event.key]] = true;
  }

  if (event.key.toLowerCase() === "a" && !event.repeat) {
    aeroBtn.click();
  }
});

document.addEventListener("keyup", (event) => {
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
