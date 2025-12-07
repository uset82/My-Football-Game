// ===================================
// MY FOOTBALL GAME - JavaScript Code
// ===================================
// This is the code that makes the game work!
// Read the comments to understand what each part does.

// ===================================
// STEP 1: GET THE CANVAS READY
// ===================================

// This finds our canvas in the HTML page
var canvas = document.getElementById("gameCanvas");

// This is like a "pencil" we use to draw on the canvas
var pencil = canvas.getContext("2d");

// Track the base canvas size so we can scale the display on small screens
var BASE_CANVAS_WIDTH = canvas.width;
var BASE_CANVAS_HEIGHT = canvas.height;

// Resize the displayed canvas so it fits phones/tablets while keeping game logic scale
function resizeCanvasDisplay() {
    var aspectRatio = BASE_CANVAS_HEIGHT / BASE_CANVAS_WIDTH;
    var wrapper = canvas.parentElement;
    var availableWidth = wrapper ? wrapper.clientWidth : window.innerWidth;
    var minComfortWidth = 320;
    var targetWidth = Math.min(availableWidth, 720);
    
    if (availableWidth > minComfortWidth) {
        targetWidth = Math.max(minComfortWidth, targetWidth);
    }
    
    if (targetWidth <= 0 || !isFinite(targetWidth)) {
        targetWidth = BASE_CANVAS_WIDTH;
    }
    
    var targetHeight = targetWidth * aspectRatio;
    var maxHeight = Math.max(320, window.innerHeight * 0.65);
    if (targetHeight > maxHeight) {
        targetHeight = maxHeight;
        targetWidth = targetHeight / aspectRatio;
    }
    
    canvas.style.width = targetWidth + "px";
    canvas.style.height = targetHeight + "px";
}

// Keep the canvas sized on load and whenever the device rotates/resizes
resizeCanvasDisplay();
window.addEventListener("resize", resizeCanvasDisplay);

// ===================================
// SOUND EFFECTS
// ===================================

// Create sound effects using the Web Audio API
var audioContext = null;

// Function to create a beep sound
function playSound(type) {
    // Create audio context if it doesn't exist
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    var oscillator = audioContext.createOscillator();
    var gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Different sounds for different actions
    if (type === "kick") {
        // Short "pop" sound for kick
        oscillator.frequency.value = 300;
        oscillator.type = "square";
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.1);
    } else if (type === "powerKick") {
        // Stronger sound for power kick
        oscillator.frequency.value = 200;
        oscillator.type = "sawtooth";
        gainNode.gain.value = 0.4;
        oscillator.start();
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
        oscillator.stop(audioContext.currentTime + 0.3);
    } else if (type === "goal") {
        // Happy "goal" sound - multiple notes!
        playNote(523, 0, 0.15);   // C
        playNote(659, 0.15, 0.15); // E
        playNote(784, 0.3, 0.3);   // G
        // Add crowd roar!
        playCrowdCheer();
    } else if (type === "enemyGoal") {
        // Sad sound when enemy scores
        oscillator.frequency.value = 200;
        oscillator.type = "sine";
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.frequency.exponentialRampToValueAtTime(100, audioContext.currentTime + 0.5);
        oscillator.stop(audioContext.currentTime + 0.5);
    } else if (type === "bounce") {
        // Soft bounce sound
        oscillator.frequency.value = 400;
        oscillator.type = "sine";
        gainNode.gain.value = 0.1;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.05);
    } else if (type === "whistle") {
        // Referee whistle for game over
        oscillator.frequency.value = 800;
        oscillator.type = "sine";
        gainNode.gain.value = 0.3;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.5);
    } else if (type === "card") {
        // Sound when showing card
        oscillator.frequency.value = 600;
        oscillator.type = "square";
        gainNode.gain.value = 0.2;
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.3);
    }
}

// Helper function to play a musical note
function playNote(frequency, delay, duration) {
    if (!audioContext) return;
    
    var osc = audioContext.createOscillator();
    var gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.value = 0.3;
    osc.start(audioContext.currentTime + delay);
    osc.stop(audioContext.currentTime + delay + duration);
}

// Function to play crowd cheering sound
function playCrowdCheer() {
    if (!audioContext) return;
    
    // Create noise for crowd effect
    var bufferSize = audioContext.sampleRate * 0.8;  // 0.8 seconds
    var buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
    var data = buffer.getChannelData(0);
    
    // Fill with noise (simulates crowd roar)
    for (var i = 0; i < bufferSize; i++) {
        // Create a wave-like crowd sound
        var envelope = Math.sin(i / bufferSize * Math.PI);  // Fade in and out
        data[i] = (Math.random() * 2 - 1) * envelope * 0.3;
    }
    
    var noise = audioContext.createBufferSource();
    noise.buffer = buffer;
    
    // Add a filter to make it sound more like voices
    var filter = audioContext.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800;
    filter.Q.value = 0.5;
    
    var gainNode = audioContext.createGain();
    gainNode.gain.value = 0.4;
    
    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    noise.start();
}

// ===================================
// DIFFICULTY SETTINGS
// ===================================

var difficulty = "medium";  // Default difficulty
var gameStarted = false;    // Has the game started?
var gameMode = "single";    // "single" or "multi" player mode
var timerHandle = null;     // Countdown interval handle

// ===================================
// MULTIPLAYER NETWORK CONFIG (WS_URL)
// ===================================
var netStatusEl = document.getElementById("net-status");
var netRole = "solo"; // "p1", "p2", or "solo"
var roomId = resolveRoomId();
var wsConnection = null;
var resolvedWsUrl = resolveWsUrl();
var stateSyncInterval = null;

function resolveRoomId() {
    var params = new URLSearchParams(window.location.search);
    return params.get("room") || "public";
}

function setNetStatus(message, color) {
    if (!netStatusEl) return;
    netStatusEl.style.display = "block";
    netStatusEl.style.color = color || "#ffffff";
    netStatusEl.textContent = message;
}

function resolveWsUrl() {
    // Priority: query param ?ws=..., then global window.WS_URL, then localStorage
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get("ws");
    var fromGlobal = typeof window !== "undefined" ? window.WS_URL : null;
    var fromStorage = null;
    try {
        fromStorage = localStorage.getItem("WS_URL");
    } catch (e) {
        fromStorage = null;
    }
    var url = fromQuery || fromGlobal || fromStorage || null;
    if (url) {
        try {
            localStorage.setItem("WS_URL", url);
        } catch (e2) {
            // ignore storage errors
        }
    }
    return url;
}

function isHost() {
    return gameMode === "multi" && netRole === "p1";
}

function connectMultiplayerSocket() {
    if (wsConnection || gameMode !== "multi") return;
    if (!resolvedWsUrl) {
        setNetStatus("Online multiplayer server not configured. Set WS_URL or add ?ws=wss://your-server", "#ffd166");
        return;
    }
    if (typeof io === "undefined") {
        setNetStatus("socket.io client missing; cannot connect.", "#ff6347");
        return;
    }
    try {
        setNetStatus("Connecting to " + resolvedWsUrl + "...", "#ffd166");
        wsConnection = io(resolvedWsUrl, {
            transports: ["websocket"],
            query: { room: roomId }
        });
        wsConnection.on("connect", function() {
            setNetStatus("Connected to multiplayer server: " + resolvedWsUrl, "#06d6a0");
        });
        wsConnection.on("disconnect", function() {
            setNetStatus("Disconnected from server. Check WS_URL.", "#ff6347");
            wsConnection = null;
            stopStateSync();
        });
        wsConnection.on("connect_error", function(err) {
            setNetStatus("WebSocket error: " + err.message, "#ff6347");
        });
        wsConnection.on("joined", function(payload) {
            netRole = payload.role || "solo";
            roomId = payload.room || roomId;
            setNetStatus("Room " + roomId + " | You are " + netRole.toUpperCase(), "#06d6a0");
        });
        wsConnection.on("input", function(payload) {
            applyRemoteInput(payload);
        });
        wsConnection.on("state", function(payload) {
            applyRemoteState(payload);
        });
        wsConnection.on("start", function(payload) {
            startGame(payload.difficulty || "medium", { fromNetwork: true, timeLeft: payload.timeLeft });
        });
    } catch (err) {
        setNetStatus("Failed to connect: " + err.message, "#ff6347");
    }
}

function emitInput(role) {
    if (!wsConnection || wsConnection.disconnected || gameMode !== "multi") return;
    if (role === "p1") {
        wsConnection.emit("input", {
            role: "p1",
            room: roomId,
            keys: {
                leftPressed: leftPressed,
                rightPressed: rightPressed,
                upPressed: upPressed,
                downPressed: downPressed,
                isChargingPower: isChargingPower,
                powerLevel: powerLevel
            }
        });
    } else if (role === "p2") {
        wsConnection.emit("input", {
            role: "p2",
            room: roomId,
            keys: {
                leftPressed: p2LeftPressed,
                rightPressed: p2RightPressed,
                upPressed: p2UpPressed,
                downPressed: p2DownPressed,
                isChargingPower: player2ChargingPower,
                powerLevel: player2PowerLevel
            }
        });
    }
}

function applyRemoteInput(payload) {
    if (!payload || !payload.role || payload.role === netRole) return;
    if (payload.role === "p1") {
        leftPressed = !!payload.keys.leftPressed;
        rightPressed = !!payload.keys.rightPressed;
        upPressed = !!payload.keys.upPressed;
        downPressed = !!payload.keys.downPressed;
        isChargingPower = !!payload.keys.isChargingPower;
        powerLevel = payload.keys.powerLevel || 0;
    } else if (payload.role === "p2") {
        p2LeftPressed = !!payload.keys.leftPressed;
        p2RightPressed = !!payload.keys.rightPressed;
        p2UpPressed = !!payload.keys.upPressed;
        p2DownPressed = !!payload.keys.downPressed;
        player2ChargingPower = !!payload.keys.isChargingPower;
        player2PowerLevel = payload.keys.powerLevel || 0;
    }
}

function startStateSync() {
    if (!isHost() || !wsConnection || stateSyncInterval) return;
    stateSyncInterval = setInterval(function() {
        if (!wsConnection || wsConnection.disconnected) return;
        wsConnection.emit("state", {
            room: roomId,
            data: snapshotState()
        });
    }, 120);
}

function stopStateSync() {
    if (stateSyncInterval) {
        clearInterval(stateSyncInterval);
        stateSyncInterval = null;
    }
}

function snapshotState() {
    return {
        playerX: playerX,
        playerY: playerY,
        player2X: player2X,
        player2Y: player2Y,
        ballX: ballX,
        ballY: ballY,
        ballSpeedX: ballSpeedX,
        ballSpeedY: ballSpeedY,
        ballSpin: ballSpin,
        ballRotation: ballRotation,
        ballHeight: ballHeight,
        ballHeightVel: ballHeightVel,
        score: score,
        enemyScore: enemyScore,
        timeLeft: timeLeft,
        gameOver: gameOver,
        weatherType: weatherType,
        windStrength: windStrength
    };
}

function applyRemoteState(payload) {
    if (!payload || isHost()) return; // host is authoritative
    var s = payload.data || payload;
    playerX = s.playerX;
    playerY = s.playerY;
    player2X = s.player2X;
    player2Y = s.player2Y;
    ballX = s.ballX;
    ballY = s.ballY;
    ballSpeedX = s.ballSpeedX;
    ballSpeedY = s.ballSpeedY;
    ballSpin = s.ballSpin;
    ballRotation = s.ballRotation;
    ballHeight = s.ballHeight;
    ballHeightVel = s.ballHeightVel;
    score = s.score;
    enemyScore = s.enemyScore;
    timeLeft = s.timeLeft;
    gameOver = s.gameOver;
    weatherType = s.weatherType || weatherType;
    windStrength = s.windStrength || windStrength;
    
    // Update UI text to match host state
    if (gameMode === "multi") {
        document.getElementById("score-display").textContent = "Blue (P1): " + score;
        document.getElementById("enemy-score-display").textContent = "Red (P2): " + enemyScore;
    }
    document.getElementById("time-display").textContent = "Time: " + timeLeft;
}

// ===================================
// MULTIPLAYER NETWORK CONFIG (WS_URL)
// ===================================
var netStatusEl = document.getElementById("net-status");
var wsConnection = null;
var resolvedWsUrl = resolveWsUrl();

function setNetStatus(message, color) {
    if (!netStatusEl) return;
    netStatusEl.style.display = "block";
    netStatusEl.style.color = color || "#ffffff";
    netStatusEl.textContent = message;
}

function resolveWsUrl() {
    // Priority: query param ?ws=..., then global window.WS_URL, then localStorage
    var params = new URLSearchParams(window.location.search);
    var fromQuery = params.get("ws");
    var fromGlobal = typeof window !== "undefined" ? window.WS_URL : null;
    var fromStorage = null;
    try {
        fromStorage = localStorage.getItem("WS_URL");
    } catch (e) {
        fromStorage = null;
    }
    var url = fromQuery || fromGlobal || fromStorage || null;
    if (url) {
        try {
            localStorage.setItem("WS_URL", url);
        } catch (e2) {
            // ignore storage errors
        }
    }
    return url;
}

function connectMultiplayerSocket() {
    if (wsConnection || gameMode !== "multi") return;
    if (!resolvedWsUrl) {
        setNetStatus("Online multiplayer server not configured. Set WS_URL or add ?ws=wss://your-server", "#ffd166");
        return;
    }
    try {
        setNetStatus("Connecting to " + resolvedWsUrl + "...", "#ffd166");
        wsConnection = new WebSocket(resolvedWsUrl);
        wsConnection.onopen = function() {
            setNetStatus("Connected to multiplayer server: " + resolvedWsUrl, "#06d6a0");
        };
        wsConnection.onclose = function() {
            setNetStatus("Disconnected from server. Check WS_URL.", "#ff6347");
            wsConnection = null;
        };
        wsConnection.onerror = function() {
            setNetStatus("WebSocket error. Verify WS_URL.", "#ff6347");
        };
        // NOTE: Actual gameplay sync not implemented yet.
    } catch (err) {
        setNetStatus("Failed to connect: " + err.message, "#ff6347");
    }
}

// ===================================
// PLAYER 2 VARIABLES (for multiplayer)
// ===================================
var player2X = 230;        // Player 2's position from the left
var player2Y = 120;        // Player 2's position from the top (starts near their goal)
var player2Width = 40;
var player2Height = 40;
var player2Speed = 5;
var player2AnimFrame = 0;
var player2Stamina = 100;
var player2PowerLevel = 0;
var player2ChargingPower = false;
var player2IsRunning = false;

// Player 2 keyboard controls (WASD)
var p2LeftPressed = false;   // A
var p2RightPressed = false;  // D
var p2UpPressed = false;     // W
var p2DownPressed = false;   // S

// Difficulty settings
var difficultySettings = {
    easy: {
        enemySpeed: 1,
        goalkeeperSpeed: 2,
        enemyKickPower: 3,
        playerSpeed: 6,
        timeLimit: 90
    },
    medium: {
        enemySpeed: 1.5,
        goalkeeperSpeed: 3,
        enemyKickPower: 5,
        playerSpeed: 5,
        timeLimit: 60
    },
    hard: {
        enemySpeed: 2.5,
        goalkeeperSpeed: 4,
        enemyKickPower: 7,
        playerSpeed: 5,
        timeLimit: 45
    }
};

// Function to select game mode
function selectMode(mode) {
    gameMode = mode;
    document.getElementById("mode-selector").style.display = "none";
    
    if (mode === "single") {
        // Show difficulty selector for single player
        document.getElementById("difficulty-selector").style.display = "block";
    } else {
        // Start multiplayer game directly (medium difficulty)
        connectMultiplayerSocket();
        startGame("medium");
    }
}

// Make selectMode available globally
window.selectMode = selectMode;

// Function to start the game with chosen difficulty
function startGame(chosenDifficulty, options) {
    var isRemote = options && options.fromNetwork;
    var providedTime = options && typeof options.timeLeft === "number" ? options.timeLeft : null;
    
    difficulty = chosenDifficulty;
    gameStarted = true;
    
    if (gameMode === "multi") {
        connectMultiplayerSocket();
    }
    
    // Initialize weather
    initializeWeather();
    
    // Apply difficulty settings
    var settings = difficultySettings[difficulty];
    playerSpeed = settings.playerSpeed;
    goalkeeperSpeed = settings.goalkeeperSpeed;
    timeLeft = providedTime !== null ? providedTime : settings.timeLimit;
    
    // Update enemy speeds
    for (var i = 0; i < enemies.length; i++) {
        var speedMultiplier = settings.enemySpeed;
        enemies[i].speedX = enemies[i].speedX > 0 ? speedMultiplier : -speedMultiplier;
        enemies[i].speedY = enemies[i].speedY > 0 ? speedMultiplier : -speedMultiplier;
    }
    
    // Hide difficulty selector, show game
    document.getElementById("difficulty-selector").style.display = "none";
    document.getElementById("mode-selector").style.display = "none";
    document.getElementById("game-info").style.display = "block";
    document.getElementById("power-container").style.display = "flex";
    document.getElementById("gameCanvas").style.display = "block";
    document.getElementById("touch-controls").style.display = "flex";
    resizeCanvasDisplay();
    
    // Update labels based on game mode
    if (gameMode === "multi") {
        document.getElementById("score-display").textContent = "Blue (P1): 0";
        document.getElementById("enemy-score-display").textContent = "Red (P2): 0";
        // Set longer time for multiplayer matches unless remote provided time
        if (providedTime === null) {
            timeLeft = 120;  // 2 minutes for multiplayer
        }
    }
    
    // Update time display
    document.getElementById("time-display").textContent = "Time: " + timeLeft;
    
    // Start the timer
    if (!timerHandle) {
        timerHandle = setInterval(countDown, 1000);
    }
    
    // Broadcast start to other player if host
    if (!isRemote && gameMode === "multi" && isHost() && wsConnection && !wsConnection.disconnected) {
        wsConnection.emit("start", { room: roomId, difficulty: difficulty, timeLeft: timeLeft });
    }
    
    // Begin state sync if host
    if (gameMode === "multi" && isHost()) {
        startStateSync();
    }
    
    // Start game loop
    gameLoop();
}

// Make startGame available globally
window.startGame = startGame;

// ===================================
// POWER SHOT VARIABLES
// ===================================

var powerLevel = 0;          // Current power level (0-100)
var isChargingPower = false; // Is the player charging a power shot?
var maxPower = 100;          // Maximum power level

// ===================================
// STEP 2: CREATE THE GAME VARIABLES
// ===================================

// --- Player variables ---
// These control where the player is and how fast it moves
var playerX = 230;       // Player's position from the left
var playerY = 450;       // Player's position from the top
var playerWidth = 40;    // How wide the player is
var playerHeight = 40;   // How tall the player is
var playerSpeed = 5;     // How fast the player moves
var playerAnimFrame = 0; // Animation frame for running
var playerFacing = 0;    // Direction player is facing (radians)
var playerStamina = 100; // Player stamina (0-100)
var staminaRegenRate = 0.3; // How fast stamina regenerates
var isRunning = false;   // Is the player currently moving?

// --- Particle system ---
var particles = [];      // Array to hold particle effects

// --- Weather system ---
var weatherType = "clear"; // clear, rain, or windy
var raindrops = [];       // Array of raindrops
var windStrength = 0;     // Wind affecting ball movement
var weatherTimer = 0;     // Timer to change weather

// --- Camera effects ---
var cameraShakeX = 0;
var cameraShakeY = 0;
var cameraShakeIntensity = 0;

// --- Which player is being controlled? ---
var controlledPlayerIndex = -1;  // -1 means the main player, 0-4 means a teammate

// --- Teammates (your team!) ---
// These are your blue teammates that help you!
var teammates = [
    { x: 100, y: 320, speedX: 1.5, speedY: 1, baseX: 100, baseY: 320 },    // Teammate 0 (left midfielder)
    { x: 350, y: 320, speedX: -1.5, speedY: 1, baseX: 350, baseY: 320 },   // Teammate 1 (right midfielder)
    { x: 230, y: 180, speedX: 1, speedY: -1.5, baseX: 230, baseY: 180 },   // Teammate 2 (striker)
    { x: 80, y: 420, speedX: 1, speedY: 0.5, baseX: 80, baseY: 420 },      // Teammate 3 (left back)
    { x: 380, y: 420, speedX: -1, speedY: 0.5, baseX: 380, baseY: 420 }    // Teammate 4 (right back)
];
var teammateWidth = 36;
var teammateHeight = 36;

// --- Ball variables ---
// These control where the ball is and how it moves
var ballX = 250;         // Ball's position from the left
var ballY = 300;         // Ball's position from the top
var ballRadius = 12;     // How big the ball is (radius = half the width)
var ballSpeedX = 0;      // Ball's speed going left or right
var ballSpeedY = 0;      // Ball's speed going up or down
var ballSpin = 0;        // Ball rotation for visual effect
var ballRotation = 0;    // Current rotation angle
var ballHeight = 0;      // Ball height for 3D effect (0 = on ground)
var ballHeightVel = 0;   // Ball vertical velocity for bouncing
var ballTrail = [];      // Trail positions for fast ball effect
var maxTrailLength = 8;  // Maximum trail length

// --- Goal variables ---
// This is YOUR goal area at the top of the field (where YOU score)
var goalX = 175;         // Goal's position from the left
var goalY = 10;          // Goal's position from the top (adjusted for stadium)
var goalWidth = 150;     // How wide the goal is
var goalHeight = 50;     // How tall the goal is

// This is the ENEMY goal at the bottom (where THEY try to score)
var enemyGoalX = 175;
var enemyGoalY = 540;    // At the bottom of the field (adjusted)
var enemyGoalWidth = 150;
var enemyGoalHeight = 50;

// --- Your Goalkeeper ---
// Your goalkeeper protects the bottom goal!
var myGoalkeeperX = 200;
var myGoalkeeperY = 515;
var myGoalkeeperWidth = 50;
var myGoalkeeperHeight = 30;
var myGoalkeeperSpeed = 2.5;
var myGoalkeeperDirection = 1;

// --- Referee ---
// The referee runs around the field watching the game!
var refereeX = 250;
var refereeY = 300;
var refereeWidth = 30;
var refereeHeight = 30;
var refereeSpeedX = 0;
var refereeSpeedY = 0;
var refereeState = "watching";  // watching, running, whistle, cardYellow, cardRed
var refereeStateTimer = 0;

// --- Audience/Crowd ---
// Create the crowd around the stadium
var crowdLeft = [];   // Fans on the left side
var crowdRight = [];  // Fans on the right side
var crowdExcitement = 0;  // How excited the crowd is (0-100)

// Generate random fans for each side
function generateCrowd() {
    // Left side crowd (about 25 fans)
    for (var i = 0; i < 25; i++) {
        crowdLeft.push({
            x: Math.random() * 30,
            y: 60 + Math.random() * 480,
            color: getRandomFanColor(),
            armUp: false,
            waveOffset: Math.random() * Math.PI * 2
        });
    }
    
    // Right side crowd (about 25 fans)
    for (var j = 0; j < 25; j++) {
        crowdRight.push({
            x: canvas.width - 30 + Math.random() * 30,
            y: 60 + Math.random() * 480,
            color: getRandomFanColor(),
            armUp: false,
            waveOffset: Math.random() * Math.PI * 2
        });
    }
}

// Get a random fan shirt color (mix of blue and red team supporters!)
function getRandomFanColor() {
    var colors = [
        "#3498db", "#2980b9", "#1abc9c",  // Blue team fans
        "#e74c3c", "#c0392b", "#e67e22",  // Red team fans
        "#9b59b6", "#f1c40f", "#ecf0f1",  // Neutral fans
        "#27ae60", "#16a085", "#8e44ad"   // More variety
    ];
    return colors[Math.floor(Math.random() * colors.length)];
}

// Initialize crowd when game loads
generateCrowd();

// --- Initialize weather system ---
function initializeWeather() {
    // Random weather (70% clear, 20% rain, 10% windy)
    var rand = Math.random();
    if (rand < 0.7) {
        weatherType = "clear";
        windStrength = 0;
    } else if (rand < 0.9) {
        weatherType = "rain";
        windStrength = (Math.random() - 0.5) * 0.3;
        // Generate raindrops
        for (var r = 0; r < 100; r++) {
            raindrops.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                speed: 8 + Math.random() * 4,
                length: 10 + Math.random() * 10
            });
        }
    } else {
        weatherType = "windy";
        windStrength = (Math.random() > 0.5 ? 1 : -1) * (0.3 + Math.random() * 0.3);
    }
}

// --- Create particle effect ---
function createParticles(x, y, color, count, speed, type) {
    for (var p = 0; p < count; p++) {
        var angle = Math.random() * Math.PI * 2;
        var velocity = speed * (0.5 + Math.random() * 0.5);
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            life: 1,
            decay: 0.02 + Math.random() * 0.02,
            color: color,
            size: type === "spark" ? 2 + Math.random() * 3 : 4 + Math.random() * 4,
            type: type  // "spark", "grass", "confetti"
        });
    }
}

// --- Update particles ---
function updateParticles() {
    for (var i = particles.length - 1; i >= 0; i--) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.2;  // Gravity
        p.life -= p.decay;
        
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// --- Draw particles ---
function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        pencil.globalAlpha = p.life;
        pencil.fillStyle = p.color;
        
        if (p.type === "confetti") {
            // Confetti - rotating rectangles
            pencil.save();
            pencil.translate(p.x, p.y);
            pencil.rotate(p.life * 10);
            pencil.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
            pencil.restore();
        } else {
            // Sparks or grass - circles
            pencil.beginPath();
            pencil.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            pencil.fill();
        }
    }
    pencil.globalAlpha = 1;
}

// --- Draw weather effects ---
function drawWeather() {
    if (weatherType === "rain") {
        pencil.strokeStyle = "rgba(200, 220, 255, 0.5)";
        pencil.lineWidth = 1;
        
        for (var i = 0; i < raindrops.length; i++) {
            var drop = raindrops[i];
            
            // Draw raindrop
            pencil.beginPath();
            pencil.moveTo(drop.x, drop.y);
            pencil.lineTo(drop.x + windStrength * 10, drop.y + drop.length);
            pencil.stroke();
            
            // Move raindrop
            drop.y += drop.speed;
            drop.x += windStrength * 5;
            
            // Reset if off screen
            if (drop.y > canvas.height) {
                drop.y = -drop.length;
                drop.x = Math.random() * canvas.width;
            }
            if (drop.x < 0) drop.x = canvas.width;
            if (drop.x > canvas.width) drop.x = 0;
        }
        
        // Rain overlay for atmosphere
        pencil.fillStyle = "rgba(100, 130, 180, 0.1)";
        pencil.fillRect(0, 0, canvas.width, canvas.height);
    } else if (weatherType === "windy") {
        // Draw wind streaks
        pencil.strokeStyle = "rgba(255, 255, 255, 0.1)";
        pencil.lineWidth = 1;
        var windDir = windStrength > 0 ? 1 : -1;
        for (var w = 0; w < 10; w++) {
            var wx = (Date.now() / 20 + w * 50) % (canvas.width + 100) - 50;
            var wy = 100 + w * 50;
            pencil.beginPath();
            pencil.moveTo(wx, wy);
            pencil.lineTo(wx + windDir * 30, wy + 5);
            pencil.stroke();
        }
    }
}

// --- Apply camera shake ---
function applyCameraShake() {
    if (cameraShakeIntensity > 0) {
        cameraShakeX = (Math.random() - 0.5) * cameraShakeIntensity;
        cameraShakeY = (Math.random() - 0.5) * cameraShakeIntensity;
        cameraShakeIntensity *= 0.9;
        if (cameraShakeIntensity < 0.5) {
            cameraShakeIntensity = 0;
            cameraShakeX = 0;
            cameraShakeY = 0;
        }
    }
}

// --- Trigger camera shake ---
function triggerCameraShake(intensity) {
    cameraShakeIntensity = intensity;
}

// --- Enemy players (defenders) ---
// These are the red players that try to block you!
var enemies = [
    { x: 120, y: 150, speedX: 2, speedY: 0 },   // Defender 1 (near goal)
    { x: 320, y: 150, speedX: -2, speedY: 0 },  // Defender 2 (near goal)
    { x: 230, y: 280, speedX: 0, speedY: 2 },   // Midfielder 1
    { x: 60, y: 380, speedX: 1.5, speedY: 0 },  // Defender 3 (left side)
    { x: 380, y: 380, speedX: -1.5, speedY: 0 } // Defender 4 (right side)
];
var enemyWidth = 35;     // How wide each enemy is
var enemyHeight = 35;    // How tall each enemy is

// --- Goalkeeper ---
// The goalkeeper tries to stop the ball!
var goalkeeperX = 200;   // Goalkeeper's position from the left
var goalkeeperY = 55;    // Goalkeeper's position from the top
var goalkeeperWidth = 50;
var goalkeeperHeight = 30;
var goalkeeperSpeed = 3; // How fast the goalkeeper moves
var goalkeeperDirection = 1; // 1 = moving right, -1 = moving left

// --- Game variables ---
// These keep track of the score and time
var score = 0;           // How many goals YOU scored
var enemyScore = 0;      // How many goals the ENEMY scored
var timeLeft = 60;       // Seconds left in the game
var gameOver = false;    // Is the game finished?
var showingGoalMessage = false;  // Are we showing "GOAL!" message?
var goalMessageTimer = 0;        // How long to show the message
var goalMessageText = "";        // What message to show

// --- Keyboard variables ---
// These remember which arrow keys are being pressed
var leftPressed = false;
var rightPressed = false;
var upPressed = false;
var downPressed = false;

// ===================================
// STEP 3: LISTEN FOR KEYBOARD BUTTONS
// ===================================

// This function runs when you PRESS a key down
document.addEventListener("keydown", function(event) {
    // ===== PLAYER 1 CONTROLS (Arrow Keys + Space) =====
    // Check which key was pressed
    if (gameMode !== "multi" || netRole !== "p2") {
        if (event.key === "ArrowLeft") {
        leftPressed = true;
    }
        if (event.key === "ArrowRight") {
        rightPressed = true;
    }
        if (event.key === "ArrowUp") {
        upPressed = true;
    }
        if (event.key === "ArrowDown") {
        downPressed = true;
    }
    
        // Check if SHIFT is held (for charging power)
        if (event.key === "Shift") {
            isChargingPower = true;
        }
        
        // Check if SPACE was pressed to kick the ball
        if (event.key === " ") {
            event.preventDefault();  // Prevent page scroll
            if (isChargingPower && powerLevel > 20) {
                // POWER KICK!
                kickBall(true, 1);  // Player 1 kick
                playSound("powerKick");
            } else {
                // Normal kick
                kickBall(false, 1);  // Player 1 kick
                playSound("kick");
            }
            // Reset power after kicking
            powerLevel = 0;
            isChargingPower = false;
            updatePowerBar();
        }
        if (gameMode === "multi") emitInput("p1");
    }
    
    // ===== PLAYER 2 CONTROLS (WASD + E) =====
    if (gameMode === "multi") {
        if (netRole !== "p1" && (event.key === "a" || event.key === "A")) {
            p2LeftPressed = true;
        }
        if (netRole !== "p1" && (event.key === "d" || event.key === "D")) {
            p2RightPressed = true;
        }
        if (netRole !== "p1" && (event.key === "w" || event.key === "W")) {
            p2UpPressed = true;
        }
        if (netRole !== "p1" && (event.key === "s" || event.key === "S")) {
            p2DownPressed = true;
        }
        
        // Q for charging power (Player 2)
        if (netRole !== "p1" && (event.key === "q" || event.key === "Q")) {
            player2ChargingPower = true;
        }
        
        // E for kicking (Player 2)
        if (netRole !== "p1" && (event.key === "e" || event.key === "E")) {
            if (player2ChargingPower && player2PowerLevel > 20) {
                kickBall(true, 2);  // Player 2 power kick
                playSound("powerKick");
            } else {
                kickBall(false, 2);  // Player 2 normal kick
                playSound("kick");
            }
            player2PowerLevel = 0;
            player2ChargingPower = false;
        }
        if (gameMode === "multi") emitInput("p2");
    }
});

// This function runs when you RELEASE a key
document.addEventListener("keyup", function(event) {
    // ===== PLAYER 1 KEY RELEASE =====
    // Check which key was released
    if (gameMode !== "multi" || netRole !== "p2") {
        if (event.key === "ArrowLeft") {
        leftPressed = false;
    }
        if (event.key === "ArrowRight") {
        rightPressed = false;
    }
        if (event.key === "ArrowUp") {
        upPressed = false;
    }
        if (event.key === "ArrowDown") {
        downPressed = false;
    }
    
        // Stop charging power when shift released
        if (event.key === "Shift") {
            isChargingPower = false;
        }
        if (gameMode === "multi") emitInput("p1");
    }
    
    // ===== PLAYER 2 KEY RELEASE =====
    if (gameMode === "multi") {
        if (netRole !== "p1" && (event.key === "a" || event.key === "A")) {
            p2LeftPressed = false;
        }
        if (netRole !== "p1" && (event.key === "d" || event.key === "D")) {
            p2RightPressed = false;
        }
        if (netRole !== "p1" && (event.key === "w" || event.key === "W")) {
            p2UpPressed = false;
        }
        if (netRole !== "p1" && (event.key === "s" || event.key === "S")) {
            p2DownPressed = false;
        }
        if (netRole !== "p1" && (event.key === "q" || event.key === "Q")) {
            player2ChargingPower = false;
        }
        if (gameMode === "multi") emitInput("p2");
    }
});

// Function to update the power bar display
function updatePowerBar() {
    var powerFill = document.getElementById("power-fill");
    var powerText = document.getElementById("power-text");
    if (powerFill && powerText) {
        powerFill.style.width = powerLevel + "%";
        powerText.textContent = Math.round(powerLevel) + "%";
    }
}

// ===================================
// TOUCH CONTROLS FOR MOBILE
// ===================================

// Get touch control buttons
var upBtn = document.getElementById("up-btn");
var downBtn = document.getElementById("down-btn");
var leftBtn = document.getElementById("left-btn");
var rightBtn = document.getElementById("right-btn");
var kickBtn = document.getElementById("kick-btn");
var powerBtn = document.getElementById("power-btn");

// Helper function to add touch events
function addTouchEvents(button, keyName) {
    if (!button) return;
    
    button.addEventListener("touchstart", function(e) {
        e.preventDefault();
        if (keyName === "up") upPressed = true;
        if (keyName === "down") downPressed = true;
        if (keyName === "left") leftPressed = true;
        if (keyName === "right") rightPressed = true;
    });
    
    button.addEventListener("touchend", function(e) {
        e.preventDefault();
        if (keyName === "up") upPressed = false;
        if (keyName === "down") downPressed = false;
        if (keyName === "left") leftPressed = false;
        if (keyName === "right") rightPressed = false;
    });
}

// Add touch events to D-pad buttons
addTouchEvents(upBtn, "up");
addTouchEvents(downBtn, "down");
addTouchEvents(leftBtn, "left");
addTouchEvents(rightBtn, "right");

// Kick button touch events
if (kickBtn) {
    kickBtn.addEventListener("touchstart", function(e) {
        e.preventDefault();
        kickBall(false);
        playSound("kick");
    });
}

// Power button touch events
if (powerBtn) {
    var powerInterval = null;
    
    powerBtn.addEventListener("touchstart", function(e) {
        e.preventDefault();
        isChargingPower = true;
        // Start charging power
        powerInterval = setInterval(function() {
            if (powerLevel < maxPower) {
                powerLevel += 3;
                updatePowerBar();
            }
        }, 50);
    });
    
    powerBtn.addEventListener("touchend", function(e) {
        e.preventDefault();
        clearInterval(powerInterval);
        if (powerLevel > 20) {
            kickBall(true);
            playSound("powerKick");
        }
        powerLevel = 0;
        isChargingPower = false;
        updatePowerBar();
    });
}

// ===================================
// STEP 4: GAME FUNCTIONS
// ===================================

// --- Function to move the player ---
function movePlayer() {
    // First, find which player should be controlled (closest to ball)
    updateControlledPlayer();
    
    // Get the position of the controlled player
    var controlX, controlY;
    
    if (controlledPlayerIndex === -1) {
        // Control main player
        controlX = playerX;
        controlY = playerY;
    } else {
        // Control a teammate
        controlX = teammates[controlledPlayerIndex].x;
        controlY = teammates[controlledPlayerIndex].y;
    }
    
    // Calculate movement based on input
    var moveX = 0;
    var moveY = 0;
    
    // Check if player is running (any key pressed)
    isRunning = leftPressed || rightPressed || upPressed || downPressed;
    
    // Stamina affects speed
    var staminaMultiplier = 0.7 + (playerStamina / 100) * 0.3;
    var currentSpeed = playerSpeed * staminaMultiplier;
    
    if (leftPressed) moveX = -currentSpeed;
    if (rightPressed) moveX = currentSpeed;
    if (upPressed) moveY = -currentSpeed;
    if (downPressed) moveY = currentSpeed;
    
    // Update player facing direction based on movement
    if (moveX !== 0 || moveY !== 0) {
        playerFacing = Math.atan2(moveY, moveX);
        // Update animation frame
        playerAnimFrame += 0.3;
        // Decrease stamina while running
        playerStamina -= 0.15;
        if (playerStamina < 0) playerStamina = 0;
        // Create grass particles when running
        if (Math.random() > 0.8) {
            createParticles(
                controlledPlayerIndex === -1 ? playerX + playerWidth / 2 : teammates[controlledPlayerIndex].x + teammateWidth / 2,
                controlledPlayerIndex === -1 ? playerY + playerHeight : teammates[controlledPlayerIndex].y + teammateHeight,
                "#4a7c23", 1, 2, "grass"
            );
        }
    } else {
        // Regenerate stamina when not moving
        playerStamina += staminaRegenRate;
        if (playerStamina > 100) playerStamina = 100;
    }
    
    // Apply movement to the controlled player
    if (controlledPlayerIndex === -1) {
        // Move main player
        playerX = playerX + moveX;
        playerY = playerY + moveY;
        
        // Keep inside bounds
        if (playerX < 40) playerX = 40;
        if (playerX > canvas.width - playerWidth - 40) playerX = canvas.width - playerWidth - 40;
        if (playerY < 20) playerY = 20;
        if (playerY > canvas.height - playerHeight - 20) playerY = canvas.height - playerHeight - 20;
    } else {
        // Move the controlled teammate
        var teammate = teammates[controlledPlayerIndex];
        teammate.x = teammate.x + moveX;
        teammate.y = teammate.y + moveY;
        
        // Keep inside bounds
        if (teammate.x < 40) teammate.x = 40;
        if (teammate.x > canvas.width - teammateWidth - 40) teammate.x = canvas.width - teammateWidth - 40;
        if (teammate.y < 20) teammate.y = 20;
        if (teammate.y > canvas.height - teammateHeight - 20) teammate.y = canvas.height - teammateHeight - 20;
    }
}

// --- Function to move Player 2 (multiplayer mode) ---
function movePlayer2() {
    if (gameMode !== "multi") return;
    
    // Calculate movement based on input
    var moveX = 0;
    var moveY = 0;
    
    // Check if player 2 is running
    player2IsRunning = p2LeftPressed || p2RightPressed || p2UpPressed || p2DownPressed;
    
    // Stamina affects speed
    var staminaMultiplier = 0.7 + (player2Stamina / 100) * 0.3;
    var currentSpeed = player2Speed * staminaMultiplier;
    
    if (p2LeftPressed) moveX = -currentSpeed;
    if (p2RightPressed) moveX = currentSpeed;
    if (p2UpPressed) moveY = -currentSpeed;
    if (p2DownPressed) moveY = currentSpeed;
    
    // Update player 2 state based on movement
    if (moveX !== 0 || moveY !== 0) {
        player2AnimFrame += 0.3;
        player2Stamina -= 0.15;
        if (player2Stamina < 0) player2Stamina = 0;
        
        // Create grass particles
        if (Math.random() > 0.8) {
            createParticles(player2X + player2Width / 2, player2Y + player2Height, "#4a7c23", 1, 2, "grass");
        }
    } else {
        player2Stamina += staminaRegenRate;
        if (player2Stamina > 100) player2Stamina = 100;
    }
    
    // Apply movement
    player2X = player2X + moveX;
    player2Y = player2Y + moveY;
    
    // Keep inside bounds
    if (player2X < 40) player2X = 40;
    if (player2X > canvas.width - player2Width - 40) player2X = canvas.width - player2Width - 40;
    if (player2Y < 20) player2Y = 20;
    if (player2Y > canvas.height - player2Height - 20) player2Y = canvas.height - player2Height - 20;
    
    // Charge power if Q is held
    if (player2ChargingPower && player2PowerLevel < maxPower) {
        player2PowerLevel += 2;
        if (player2PowerLevel > maxPower) player2PowerLevel = maxPower;
    }
}

// --- Function to find the closest player to the ball ---
function updateControlledPlayer() {
    // In multiplayer mode, player 1 always controls their character directly
    if (gameMode === "multi") {
        controlledPlayerIndex = -1;
        return;
    }
    
    // Calculate distance from main player to ball
    var mainPlayerCenterX = playerX + playerWidth / 2;
    var mainPlayerCenterY = playerY + playerHeight / 2;
    var mainDist = getDistance(mainPlayerCenterX, mainPlayerCenterY, ballX, ballY);
    
    // Start with main player as closest
    var closestIndex = -1;
    var closestDist = mainDist;
    
    // Check each teammate
    for (var i = 0; i < teammates.length; i++) {
        var teammate = teammates[i];
        var teammateCenterX = teammate.x + teammateWidth / 2;
        var teammateCenterY = teammate.y + teammateHeight / 2;
        var dist = getDistance(teammateCenterX, teammateCenterY, ballX, ballY);
        
        if (dist < closestDist) {
            closestDist = dist;
            closestIndex = i;
        }
    }
    
    // Switch control to closest player
    controlledPlayerIndex = closestIndex;
}

// --- Helper function to calculate distance ---
function getDistance(x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// --- Function to move the ball ---
function moveBall() {
    // Store previous position for trail
    var ballSpeed = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
    if (ballSpeed > 3) {
        ballTrail.push({ x: ballX, y: ballY, alpha: 1 });
        if (ballTrail.length > maxTrailLength) {
            ballTrail.shift();
        }
    }
    // Fade trail
    for (var t = 0; t < ballTrail.length; t++) {
        ballTrail[t].alpha -= 0.12;
    }
    ballTrail = ballTrail.filter(function(p) { return p.alpha > 0; });
    
    // Move the ball based on its speed
    ballX = ballX + ballSpeedX;
    ballY = ballY + ballSpeedY;
    
    // Update ball rotation based on speed (realistic spin)
    ballRotation += ballSpin;
    ballSpin *= 0.98;  // Slow down spin
    
    // Ball height physics (for 3D bouncing effect)
    if (ballHeight > 0 || ballHeightVel !== 0) {
        ballHeightVel -= 0.5;  // Gravity
        ballHeight += ballHeightVel;
        if (ballHeight <= 0) {
            ballHeight = 0;
            ballHeightVel = -ballHeightVel * 0.5;  // Bounce with energy loss
            if (Math.abs(ballHeightVel) < 1) {
                ballHeightVel = 0;
            }
        }
    }
    
    // Slow down the ball (realistic grass friction)
    var friction = ballHeight > 0 ? 0.995 : 0.975;  // Less friction in air
    ballSpeedX = ballSpeedX * friction;
    ballSpeedY = ballSpeedY * friction;
    
    // Apply curve from spin
    ballSpeedX += ballSpin * 0.02;
    
    // Apply wind effect
    if (weatherType === "windy" || weatherType === "rain") {
        ballSpeedX += windStrength * 0.05;
    }
    
    // Stop the ball if it's moving very slowly
    if (Math.abs(ballSpeedX) < 0.1) {
        ballSpeedX = 0;
    }
    if (Math.abs(ballSpeedY) < 0.1) {
        ballSpeedY = 0;
    }
    
    // Bounce off the left and right walls
    if (ballX < ballRadius) {
        ballX = ballRadius;
        ballSpeedX = -ballSpeedX;  // Reverse direction
        playSound("bounce");
    }
    if (ballX > canvas.width - ballRadius) {
        ballX = canvas.width - ballRadius;
        ballSpeedX = -ballSpeedX;  // Reverse direction
        playSound("bounce");
    }
    
    // Bounce off the bottom wall (but not inside the enemy goal!)
    if (ballY > canvas.height - ballRadius) {
        // Check if ball is NOT in the enemy goal area
        if (ballX < enemyGoalX || ballX > enemyGoalX + enemyGoalWidth) {
            ballY = canvas.height - ballRadius;
            ballSpeedY = -ballSpeedY;  // Reverse direction
            playSound("bounce");
        }
    }
    
    // Bounce off the top wall (but not inside the goal!)
    if (ballY < ballRadius) {
        // Check if ball is NOT in the goal area
        if (ballX < goalX || ballX > goalX + goalWidth) {
            ballY = ballRadius;
            ballSpeedY = -ballSpeedY;  // Reverse direction
            playSound("bounce");
        }
    }
}

// --- Function to kick the ball ---
function kickBall(isPowerShot, playerNum) {
    // Default to player 1 if not specified
    if (playerNum === undefined) playerNum = 1;
    
    // Only kick if the game is not over
    if (gameOver) {
        return;  // Stop here, don't kick
    }
    
    // Get the position of the kicker based on player number
    var kickerX, kickerY, kickerWidth, kickerHeight;
    var kickPowerLevel = playerNum === 1 ? powerLevel : player2PowerLevel;
    
    if (playerNum === 1) {
        // Player 1 (Blue team)
        if (controlledPlayerIndex === -1) {
            // Kick from main player
            kickerX = playerX;
            kickerY = playerY;
            kickerWidth = playerWidth;
            kickerHeight = playerHeight;
        } else {
            // Kick from controlled teammate
            var teammate = teammates[controlledPlayerIndex];
            kickerX = teammate.x;
            kickerY = teammate.y;
            kickerWidth = teammateWidth;
            kickerHeight = teammateHeight;
        }
    } else {
        // Player 2 (Red team) - only in multiplayer
        kickerX = player2X;
        kickerY = player2Y;
        kickerWidth = player2Width;
        kickerHeight = player2Height;
    }
    
    // Calculate how far the kicker is from the ball
    var kickerCenterX = kickerX + kickerWidth / 2;
    var kickerCenterY = kickerY + kickerHeight / 2;
    var distanceX = ballX - kickerCenterX;
    var distanceY = ballY - kickerCenterY;
    var distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
    
    // Only kick if the player is close to the ball (within 60 pixels)
    if (distance < 60) {
        // Calculate kick power
        var kickPower = isPowerShot ? (0.4 + powerLevel / 150) : 0.3;
        var minSpeed = isPowerShot ? 12 : 8;
        
        // Kick the ball in the direction from player to ball
        ballSpeedX = distanceX * kickPower;
        ballSpeedY = distanceY * kickPower;
        
        // Make sure the ball moves fast enough
        if (Math.abs(ballSpeedX) < 3 && Math.abs(ballSpeedY) < 3) {
            ballSpeedY = isPowerShot ? -minSpeed : -8;  // Kick it towards the goal (up)
        }
        
        // Power shot goes even faster!
        if (isPowerShot) {
            ballSpeedX = ballSpeedX * 1.5;
            ballSpeedY = ballSpeedY * 1.5;
            // Add spin and height for power shots
            ballSpin = (Math.random() - 0.5) * 0.5;  // Random curve
            ballHeightVel = 4 + (powerLevel / 30);  // Ball goes up
            // Camera shake for power shots!
            triggerCameraShake(8);
            // Spark particles
            createParticles(ballX, ballY, "#f1c40f", 15, 5, "spark");
        } else {
            // Normal kick - slight spin
            ballSpin = (Math.random() - 0.5) * 0.2;
            ballHeightVel = 2;  // Small hop
            // Small grass particles
            createParticles(ballX, ballY, "#4a7c23", 5, 3, "grass");
        }
        // Update ball rotation based on kick direction
        ballRotation += Math.abs(ballSpeedX) * 0.1;
    }
}

// --- Function to check if a goal was scored ---
function checkGoal() {
    // Check if the ball is inside YOUR goal area (top - BLUE TEAM SCORES!)
    if (ballY < goalHeight && ballX > goalX && ballX < goalX + goalWidth) {
        // GOAL! Add one to BLUE team score
        score = score + 1;
        
        // Play goal sound!
        playSound("goal");
        
        // Referee blows whistle!
        refereeReactToGoal();
        
        // Update the score display
        if (gameMode === "multi") {
            document.getElementById("score-display").textContent = "Blue (P1): " + score;
        } else {
            document.getElementById("score-display").textContent = "You: " + score;
        }
        
        // Show the goal message
        showingGoalMessage = true;
        goalMessageTimer = 60;
        goalMessageText = gameMode === "multi" ? "BLUE SCORES!" : "GOAL!";
        
        // Confetti celebration!
        for (var c = 0; c < 50; c++) {
            var confettiColors = ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#ffffff"];
            createParticles(
                canvas.width / 2 + (Math.random() - 0.5) * 200,
                canvas.height / 2 - 50,
                confettiColors[Math.floor(Math.random() * confettiColors.length)],
                1, 8, "confetti"
            );
        }
        triggerCameraShake(15);
        
        // Reset the ball and player to starting positions
        resetPositions();
    }
    
    // Check if the ball is inside ENEMY goal area (bottom - RED TEAM SCORES!)
    if (ballY > enemyGoalY && ballX > enemyGoalX && ballX < enemyGoalX + enemyGoalWidth) {
        // RED team scored! Add one to THEIR score
        enemyScore = enemyScore + 1;
        
        // Play sound
        if (gameMode === "multi") {
            playSound("goal");  // Celebration for P2 too!
        } else {
            playSound("enemyGoal");
        }
        
        // Referee blows whistle!
        refereeReactToGoal();
        
        // Update the enemy score display
        if (gameMode === "multi") {
            document.getElementById("enemy-score-display").textContent = "Red (P2): " + enemyScore;
        } else {
            document.getElementById("enemy-score-display").textContent = "Enemy: " + enemyScore;
        }
        
        // Show the message
        showingGoalMessage = true;
        goalMessageTimer = 60;
        goalMessageText = gameMode === "multi" ? "RED SCORES!" : "ENEMY SCORED!";
        
        // Confetti for multiplayer
        if (gameMode === "multi") {
            for (var c2 = 0; c2 < 50; c2++) {
                var confettiColors2 = ["#f1c40f", "#e74c3c", "#3498db", "#2ecc71", "#9b59b6", "#ffffff"];
                createParticles(
                    canvas.width / 2 + (Math.random() - 0.5) * 200,
                    canvas.height / 2 - 50,
                    confettiColors2[Math.floor(Math.random() * confettiColors2.length)],
                    1, 8, "confetti"
                );
            }
            triggerCameraShake(15);
        }
        
        // Reset the ball and player to starting positions
        resetPositions();
    }
}

// --- Function to reset positions after a goal ---
function resetPositions() {
    // Put the ball back in the middle
    ballX = 250;
    ballY = 300;
    ballSpeedX = 0;
    ballSpeedY = 0;
    
    // Put Player 1 back
    playerX = 230;
    playerY = 450;
    
    // Put Player 2 back (multiplayer)
    player2X = 230;
    player2Y = 120;
    
    // Reset control back to main player
    controlledPlayerIndex = -1;
    
    // Reset teammates to starting positions (with base positions for AI)
    teammates[0].x = 100;  teammates[0].y = 320;  teammates[0].baseX = 100;  teammates[0].baseY = 320;
    teammates[1].x = 350;  teammates[1].y = 320;  teammates[1].baseX = 350;  teammates[1].baseY = 320;
    teammates[2].x = 230;  teammates[2].y = 180;  teammates[2].baseX = 230;  teammates[2].baseY = 180;
    teammates[3].x = 80;   teammates[3].y = 420;  teammates[3].baseX = 80;   teammates[3].baseY = 420;
    teammates[4].x = 380;  teammates[4].y = 420;  teammates[4].baseX = 380;  teammates[4].baseY = 420;
}

// --- Function to move the teammates ---
function moveTeammates() {
    // Loop through each teammate and move them (only if not controlled)
    for (var i = 0; i < teammates.length; i++) {
        // Skip this teammate if the user is controlling them
        if (i === controlledPlayerIndex) {
            continue;
        }
        
        var teammate = teammates[i];
        
        // Move the teammate (AI movement)
        teammate.x = teammate.x + teammate.speedX;
        teammate.y = teammate.y + teammate.speedY;
        
        // Bounce off the left and right walls
        if (teammate.x < 40) {
            teammate.x = 40;
            teammate.speedX = -teammate.speedX;
        }
        if (teammate.x > canvas.width - teammateWidth - 40) {
            teammate.x = canvas.width - teammateWidth - 40;
            teammate.speedX = -teammate.speedX;
        }
        
        // Bounce off top and bottom areas
        if (teammate.y < 80) {
            teammate.y = 80;
            teammate.speedY = -teammate.speedY;
        }
        if (teammate.y > canvas.height - teammateHeight - 80) {
            teammate.y = canvas.height - teammateHeight - 80;
            teammate.speedY = -teammate.speedY;
        }
    }
}

// --- Function to check if ball hits a teammate (pass!) ---
function checkTeammatePass() {
    for (var i = 0; i < teammates.length; i++) {
        var teammate = teammates[i];
        
        // Check if ball is touching teammate
        if (ballX > teammate.x - ballRadius &&
            ballX < teammate.x + teammateWidth + ballRadius &&
            ballY > teammate.y - ballRadius &&
            ballY < teammate.y + teammateHeight + ballRadius) {
            
            // Teammate kicks ball towards goal!
            ballSpeedY = -6 - Math.random() * 3;
            ballSpeedX = (Math.random() - 0.5) * 4;
            
            // Move ball outside teammate
            ballY = teammate.y - ballRadius - 5;
        }
    }
}

// --- Function to check if Player 2 touches the ball (multiplayer) ---
function checkPlayer2BallCollision() {
    if (gameMode !== "multi") return;
    
    // Check if ball is touching Player 2
    if (ballX > player2X - ballRadius &&
        ballX < player2X + player2Width + ballRadius &&
        ballY > player2Y - ballRadius &&
        ballY < player2Y + player2Height + ballRadius) {
        
        // Player 2 can dribble the ball - ball follows slightly
        var p2CenterX = player2X + player2Width / 2;
        var p2CenterY = player2Y + player2Height / 2;
        
        // Push ball away from player 2 center
        var pushX = ballX - p2CenterX;
        var pushY = ballY - p2CenterY;
        var pushDist = Math.sqrt(pushX * pushX + pushY * pushY);
        
        if (pushDist > 0) {
            ballX = p2CenterX + (pushX / pushDist) * (player2Width / 2 + ballRadius + 5);
            ballY = p2CenterY + (pushY / pushDist) * (player2Height / 2 + ballRadius + 5);
            
            // Add slight movement in player's direction
            if (player2IsRunning) {
                if (p2LeftPressed) ballSpeedX = -2;
                if (p2RightPressed) ballSpeedX = 2;
                if (p2UpPressed) ballSpeedY = -2;
                if (p2DownPressed) ballSpeedY = 2;
            }
        }
    }
}

// --- Function to move the enemies ---
function moveEnemies() {
    // Loop through each enemy and move them
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        
        // Smart AI: enemies try to move towards the ball
        var enemyCenterX = enemy.x + enemyWidth / 2;
        var enemyCenterY = enemy.y + enemyHeight / 2;
        var distToBallX = ballX - enemyCenterX;
        var distToBallY = ballY - enemyCenterY;
        var distToBall = Math.sqrt(distToBallX * distToBallX + distToBallY * distToBallY);
        
        // Get enemy speed based on difficulty
        var baseSpeed = difficultySettings[difficulty].enemySpeed;
        
        // If ball is close, chase it more aggressively
        if (distToBall < 200) {
            // Chase the ball!
            var chaseSpeed = baseSpeed * 0.8;
            enemy.speedX = (distToBallX / distToBall) * chaseSpeed;
            enemy.speedY = (distToBallY / distToBall) * chaseSpeed;
        } else {
            // Patrol movement - gradually return to base patrol
            enemy.speedX = enemy.speedX * 0.98;
            enemy.speedY = enemy.speedY * 0.98;
            
            // Add some random movement
            if (Math.random() < 0.02) {
                enemy.speedX = (Math.random() - 0.5) * baseSpeed * 2;
                enemy.speedY = (Math.random() - 0.5) * baseSpeed * 2;
            }
        }
        
        // Move the enemy
        enemy.x = enemy.x + enemy.speedX;
        enemy.y = enemy.y + enemy.speedY;
        
        // Bounce off the left and right walls
        if (enemy.x < 10) {
            enemy.x = 10;
            enemy.speedX = -enemy.speedX; // Reverse direction
        }
        if (enemy.x > canvas.width - enemyWidth - 10) {
            enemy.x = canvas.width - enemyWidth - 10;
            enemy.speedX = -enemy.speedX; // Reverse direction
        }
        
        // Bounce off the top and bottom areas
        if (enemy.y < 80) {
            enemy.y = 80;
            enemy.speedY = -enemy.speedY; // Reverse direction
        }
        if (enemy.y > canvas.height - enemyHeight - 60) {
            enemy.y = canvas.height - enemyHeight - 60;
            enemy.speedY = -enemy.speedY; // Reverse direction
        }
    }
}

// --- Function to move the goalkeeper ---
function moveGoalkeeper() {
    // Smart goalkeeper: track the ball position
    var targetX = ballX - goalkeeperWidth / 2;
    var distToBall = targetX - goalkeeperX;
    
    // Move towards ball position, but stay in goal area
    if (Math.abs(distToBall) > 5) {
        goalkeeperX += Math.sign(distToBall) * Math.min(goalkeeperSpeed, Math.abs(distToBall) * 0.1);
    }
    
    // Add slight anticipation - move towards where ball is going
    if (ballSpeedY < -3 && ballY < canvas.height / 2) {
        // Ball coming towards goal - anticipate!
        var predictedX = ballX + ballSpeedX * 10;
        var anticipateDist = predictedX - goalkeeperWidth / 2 - goalkeeperX;
        goalkeeperX += anticipateDist * 0.05;
    }
    
    // Keep within goal bounds
    if (goalkeeperX < goalX + 5) {
        goalkeeperX = goalX + 5;
    }
    if (goalkeeperX > goalX + goalWidth - goalkeeperWidth - 5) {
        goalkeeperX = goalX + goalWidth - goalkeeperWidth - 5;
    }
}

// --- Function to move YOUR goalkeeper (at the bottom) ---
function moveMyGoalkeeper() {
    // Smart goalkeeper: track the ball position
    var targetX = ballX - myGoalkeeperWidth / 2;
    var distToBall = targetX - myGoalkeeperX;
    
    // Move towards ball position, but stay in goal area
    if (Math.abs(distToBall) > 5) {
        myGoalkeeperX += Math.sign(distToBall) * Math.min(myGoalkeeperSpeed, Math.abs(distToBall) * 0.1);
    }
    
    // Add slight anticipation - move towards where ball is going
    if (ballSpeedY > 3 && ballY > canvas.height / 2) {
        // Ball coming towards your goal - anticipate!
        var predictedX = ballX + ballSpeedX * 10;
        var anticipateDist = predictedX - myGoalkeeperWidth / 2 - myGoalkeeperX;
        myGoalkeeperX += anticipateDist * 0.05;
    }
    
    // Keep within goal bounds
    if (myGoalkeeperX < enemyGoalX + 5) {
        myGoalkeeperX = enemyGoalX + 5;
    }
    if (myGoalkeeperX > enemyGoalX + enemyGoalWidth - myGoalkeeperWidth - 5) {
        myGoalkeeperX = enemyGoalX + enemyGoalWidth - myGoalkeeperWidth - 5;
    }
}

// --- Function to move the referee ---
function moveReferee() {
    // The referee follows the ball but keeps some distance
    var targetX = ballX - refereeWidth / 2;
    var targetY = ballY + 80;  // Stay behind the ball
    
    // Keep referee in bounds
    if (targetX < 30) targetX = 30;
    if (targetX > canvas.width - refereeWidth - 30) targetX = canvas.width - refereeWidth - 30;
    if (targetY < 100) targetY = 100;
    if (targetY > canvas.height - refereeHeight - 100) targetY = canvas.height - refereeHeight - 100;
    
    // Calculate distance to target
    var distX = targetX - refereeX;
    var distY = targetY - refereeY;
    var distance = Math.sqrt(distX * distX + distY * distY);
    
    // Move towards target if far enough
    if (distance > 50) {
        refereeSpeedX = distX * 0.03;
        refereeSpeedY = distY * 0.03;
        refereeState = "running";
    } else {
        refereeSpeedX = refereeSpeedX * 0.9;
        refereeSpeedY = refereeSpeedY * 0.9;
        if (Math.abs(refereeSpeedX) < 0.1 && Math.abs(refereeSpeedY) < 0.1) {
            refereeState = "watching";
        }
    }
    
    // Apply movement
    refereeX = refereeX + refereeSpeedX;
    refereeY = refereeY + refereeSpeedY;
    
    // Handle special states (whistle, cards)
    if (refereeStateTimer > 0) {
        refereeStateTimer = refereeStateTimer - 1;
        if (refereeStateTimer <= 0) {
            refereeState = "watching";
        }
    }
}

// --- Function to make referee react to goal ---
function refereeReactToGoal() {
    refereeState = "whistle";
    refereeStateTimer = 60;
}

// --- Function to make referee show yellow card (for hard collisions) ---
function refereeShowCard(isRed) {
    if (isRed) {
        refereeState = "cardRed";
    } else {
        refereeState = "cardYellow";
    }
    refereeStateTimer = 90;
}

// --- Function to check if player touches an enemy ---
function checkEnemyCollision() {
    // Check each enemy
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        
        // Check if player rectangle overlaps enemy rectangle
        if (playerX < enemy.x + enemyWidth &&
            playerX + playerWidth > enemy.x &&
            playerY < enemy.y + enemyHeight &&
            playerY + playerHeight > enemy.y) {
            
            // Calculate collision force
            var pushForce = Math.abs(playerSpeed);
            
            // Push the player back a little
            if (playerX < enemy.x) {
                playerX = enemy.x - playerWidth - 5;
            } else {
                playerX = enemy.x + enemyWidth + 5;
            }
            
            // Sometimes referee shows a card for hard collisions!
            if (pushForce > 4 && Math.random() < 0.15) {
                // 15% chance of yellow card on hard collision
                refereeShowCard(false);
                playSound("whistle");
            }
        }
    }
}

// --- Function to check if ball hits an enemy or goalkeeper ---
function checkBallEnemyCollision() {
    // Get enemy kick power based on difficulty
    var enemyKickPower = difficultySettings[difficulty].enemyKickPower;
    
    // Check each enemy
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        
        // Check if ball is inside enemy rectangle
        if (ballX > enemy.x - ballRadius &&
            ballX < enemy.x + enemyWidth + ballRadius &&
            ballY > enemy.y - ballRadius &&
            ballY < enemy.y + enemyHeight + ballRadius) {
            
            // Enemy kicks ball TOWARDS YOUR GOAL (bottom)!
            ballSpeedY = enemyKickPower + Math.random() * 3;  // Kick downward
            ballSpeedX = (Math.random() - 0.5) * 4;  // Random angle
            
            // Move ball outside the enemy
            ballY = enemy.y + enemyHeight + ballRadius + 5;
            
            playSound("kick");
        }
    }
    
    // Check enemy goalkeeper (top)
    if (ballX > goalkeeperX - ballRadius &&
        ballX < goalkeeperX + goalkeeperWidth + ballRadius &&
        ballY > goalkeeperY - ballRadius &&
        ballY < goalkeeperY + goalkeeperHeight + ballRadius) {
        
        // Goalkeeper saves the ball! Bounce it back
        ballSpeedY = Math.abs(ballSpeedY) + 2; // Push ball down
        ballSpeedX = (ballX - (goalkeeperX + goalkeeperWidth / 2)) * 0.3;
        ballY = goalkeeperY + goalkeeperHeight + ballRadius + 5;
        
        playSound("bounce");
    }
    
    // Check YOUR goalkeeper (bottom)
    if (ballX > myGoalkeeperX - ballRadius &&
        ballX < myGoalkeeperX + myGoalkeeperWidth + ballRadius &&
        ballY > myGoalkeeperY - ballRadius &&
        ballY < myGoalkeeperY + myGoalkeeperHeight + ballRadius) {
        
        // Your goalkeeper saves the ball! Kick it back up!
        ballSpeedY = -Math.abs(ballSpeedY) - 3; // Push ball up
        ballSpeedX = (ballX - (myGoalkeeperX + myGoalkeeperWidth / 2)) * 0.3;
        ballY = myGoalkeeperY - ballRadius - 5;
        
        playSound("bounce");
    }
}

// ===================================
// STEP 5: DRAWING FUNCTIONS
// ===================================

// --- Function to draw the field ---
function drawField() {
    // First draw the stadium/stands background
    drawStadium();
    
    // Draw the green grass with stripe pattern (like real football fields!)
    var stripeWidth = 30;
    for (var stripe = 0; stripe < canvas.height / stripeWidth; stripe++) {
        if (stripe % 2 === 0) {
            pencil.fillStyle = "#2e8b2e";  // Dark green
        } else {
            pencil.fillStyle = "#32a032";  // Light green
        }
        pencil.fillRect(35, 10 + stripe * stripeWidth, canvas.width - 70, stripeWidth);
    }
    
    // Add subtle grass texture
    pencil.strokeStyle = "rgba(0, 100, 0, 0.1)";
    pencil.lineWidth = 1;
    for (var gx = 40; gx < canvas.width - 40; gx += 8) {
        for (var gy = 15; gy < canvas.height - 15; gy += 12) {
            if (Math.random() > 0.7) {
                pencil.beginPath();
                pencil.moveTo(gx, gy);
                pencil.lineTo(gx + Math.random() * 3 - 1.5, gy - 4);
                pencil.stroke();
            }
        }
    }
    
    // Draw the white field lines
    pencil.strokeStyle = "white";
    pencil.lineWidth = 3;
    
    // Draw the outline of the field
    pencil.strokeRect(45, 20, canvas.width - 90, canvas.height - 40);
    
    // Draw the center line
    pencil.beginPath();
    pencil.moveTo(45, canvas.height / 2);
    pencil.lineTo(canvas.width - 45, canvas.height / 2);
    pencil.stroke();
    
    // Draw the center circle
    pencil.beginPath();
    pencil.arc(canvas.width / 2, canvas.height / 2, 50, 0, Math.PI * 2);
    pencil.stroke();
    
    // Draw center spot
    pencil.beginPath();
    pencil.arc(canvas.width / 2, canvas.height / 2, 5, 0, Math.PI * 2);
    pencil.fillStyle = "white";
    pencil.fill();
    
    // Draw penalty areas (top)
    pencil.strokeRect(goalX - 30, 20, goalWidth + 60, 80);
    pencil.strokeRect(goalX - 60, 20, goalWidth + 120, 120);
    
    // Draw penalty areas (bottom)
    pencil.strokeRect(enemyGoalX - 30, canvas.height - 100, enemyGoalWidth + 60, 80);
    pencil.strokeRect(enemyGoalX - 60, canvas.height - 140, enemyGoalWidth + 120, 120);
    
    // Draw penalty spots
    pencil.beginPath();
    pencil.arc(canvas.width / 2, 100, 4, 0, Math.PI * 2);
    pencil.arc(canvas.width / 2, canvas.height - 100, 4, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw the crowd on the sides
    drawCrowd();
}

// --- Function to draw the stadium stands ---
function drawStadium() {
    // Left stand (dark gray concrete)
    pencil.fillStyle = "#2c3e50";
    pencil.fillRect(0, 0, 35, canvas.height);
    
    // Right stand
    pencil.fillStyle = "#2c3e50";
    pencil.fillRect(canvas.width - 35, 0, 35, canvas.height);
    
    // Add some stadium texture (horizontal lines for rows)
    pencil.strokeStyle = "#1a252f";
    pencil.lineWidth = 1;
    for (var row = 0; row < canvas.height; row += 20) {
        // Left side rows
        pencil.beginPath();
        pencil.moveTo(0, row);
        pencil.lineTo(35, row);
        pencil.stroke();
        
        // Right side rows
        pencil.beginPath();
        pencil.moveTo(canvas.width - 35, row);
        pencil.lineTo(canvas.width, row);
        pencil.stroke();
    }
}

// --- Function to draw the crowd/audience ---
function drawCrowd() {
    var time = Date.now() / 200;  // For animation
    
    // Update crowd excitement based on ball speed and goals
    var ballSpeed = Math.sqrt(ballSpeedX * ballSpeedX + ballSpeedY * ballSpeedY);
    var targetExcitement = Math.min(ballSpeed * 8, 100);
    if (showingGoalMessage) targetExcitement = 100;
    crowdExcitement = crowdExcitement + (targetExcitement - crowdExcitement) * 0.1;
    
    // Draw left side fans
    for (var i = 0; i < crowdLeft.length; i++) {
        drawFan(crowdLeft[i], time);
    }
    
    // Draw right side fans
    for (var j = 0; j < crowdRight.length; j++) {
        drawFan(crowdRight[j], time);
    }
}

// --- Function to draw a single fan ---
function drawFan(fan, time) {
    var x = fan.x;
    var y = fan.y;
    
    // Calculate if this fan should have arm up (wave effect)
    var wavePhase = Math.sin(time + fan.waveOffset);
    var shouldWave = wavePhase > 0.3 && crowdExcitement > 30;
    
    // Slight bobbing animation when excited
    var bounce = 0;
    if (crowdExcitement > 50) {
        bounce = Math.sin(time * 2 + fan.waveOffset) * 2;
    }
    
    // Draw the fan (simple but cute!)
    // Head
    pencil.fillStyle = "#f5cba7";  // Skin color
    pencil.beginPath();
    pencil.arc(x + 8, y - 8 + bounce, 6, 0, Math.PI * 2);
    pencil.fill();
    
    // Hair (random dark colors)
    pencil.fillStyle = "#2c1810";
    pencil.beginPath();
    pencil.arc(x + 8, y - 10 + bounce, 6, Math.PI, Math.PI * 2);
    pencil.fill();
    
    // Body (team shirt)
    pencil.fillStyle = fan.color;
    pencil.fillRect(x + 3, y - 2 + bounce, 10, 12);
    
    // Arms
    if (shouldWave) {
        // Arms up cheering!
        pencil.fillStyle = fan.color;
        pencil.fillRect(x, y - 8 + bounce, 4, 8);      // Left arm up
        pencil.fillRect(x + 12, y - 8 + bounce, 4, 8); // Right arm up
        
        // Hands
        pencil.fillStyle = "#f5cba7";
        pencil.beginPath();
        pencil.arc(x + 2, y - 10 + bounce, 3, 0, Math.PI * 2);
        pencil.arc(x + 14, y - 10 + bounce, 3, 0, Math.PI * 2);
        pencil.fill();
    } else {
        // Arms down
        pencil.fillStyle = fan.color;
        pencil.fillRect(x, y + bounce, 4, 8);       // Left arm
        pencil.fillRect(x + 12, y + bounce, 4, 8);  // Right arm
    }
    
    // Sometimes show scarf or flag for extra excited fans
    if (crowdExcitement > 70 && Math.sin(time * 3 + fan.waveOffset) > 0.5) {
        // Waving scarf/banner
        pencil.fillStyle = fan.color === "#3498db" ? "#e74c3c" : "#3498db";
        pencil.beginPath();
        pencil.moveTo(x + 8, y - 15 + bounce);
        pencil.lineTo(x + 20 + Math.sin(time * 4) * 5, y - 20 + bounce);
        pencil.lineTo(x + 22 + Math.sin(time * 4) * 5, y - 15 + bounce);
        pencil.lineTo(x + 8, y - 10 + bounce);
        pencil.fill();
    }
}

// --- Function to draw the goal ---
function drawGoal() {
    // Draw YOUR goal (top) as a white rectangle
    pencil.fillStyle = "white";
    pencil.fillRect(goalX, goalY, goalWidth, goalHeight);
    
    // Draw the goal net pattern (top goal)
    pencil.strokeStyle = "#cccccc";
    pencil.lineWidth = 1;
    
    // Draw vertical lines for the net
    for (var i = goalX + 10; i < goalX + goalWidth; i += 15) {
        pencil.beginPath();
        pencil.moveTo(i, goalY);
        pencil.lineTo(i, goalY + goalHeight);
        pencil.stroke();
    }
    
    // Draw horizontal lines for the net
    for (var j = goalY + 10; j < goalY + goalHeight; j += 15) {
        pencil.beginPath();
        pencil.moveTo(goalX, j);
        pencil.lineTo(goalX + goalWidth, j);
        pencil.stroke();
    }
    
    // Draw goal posts (red)
    pencil.fillStyle = "#e74c3c";
    pencil.fillRect(goalX - 5, goalY, 8, goalHeight + 5);  // Left post
    pencil.fillRect(goalX + goalWidth - 3, goalY, 8, goalHeight + 5);  // Right post
    pencil.fillRect(goalX - 5, goalY, goalWidth + 13, 5);  // Crossbar
    
    // Draw ENEMY goal (bottom) as a white rectangle
    pencil.fillStyle = "white";
    pencil.fillRect(enemyGoalX, enemyGoalY, enemyGoalWidth, enemyGoalHeight);
    
    // Draw the goal net pattern (bottom goal)
    pencil.strokeStyle = "#cccccc";
    pencil.lineWidth = 1;
    
    // Draw vertical lines for the net
    for (var i2 = enemyGoalX + 10; i2 < enemyGoalX + enemyGoalWidth; i2 += 15) {
        pencil.beginPath();
        pencil.moveTo(i2, enemyGoalY);
        pencil.lineTo(i2, enemyGoalY + enemyGoalHeight);
        pencil.stroke();
    }
    
    // Draw horizontal lines for the net
    for (var j2 = enemyGoalY + 10; j2 < enemyGoalY + enemyGoalHeight; j2 += 15) {
        pencil.beginPath();
        pencil.moveTo(enemyGoalX, j2);
        pencil.lineTo(enemyGoalX + enemyGoalWidth, j2);
        pencil.stroke();
    }
    
    // Draw goal posts (blue for your goal to defend)
    pencil.fillStyle = "#3498db";
    pencil.fillRect(enemyGoalX - 5, enemyGoalY - 5, 8, enemyGoalHeight + 5);  // Left post
    pencil.fillRect(enemyGoalX + enemyGoalWidth - 3, enemyGoalY - 5, 8, enemyGoalHeight + 5);  // Right post
    pencil.fillRect(enemyGoalX - 5, enemyGoalY + enemyGoalHeight - 5, enemyGoalWidth + 13, 5);  // Crossbar
}

// --- Function to draw the player ---
function drawPlayer() {
    // Draw highlight circle if this player is being controlled
    if (controlledPlayerIndex === -1) {
        drawControlIndicator(playerX + playerWidth / 2, playerY + playerHeight + 5);
    }
    
    // Draw YOU as a realistic player (blue team, captain!)
    drawPerson(playerX, playerY, "#3498db", "#2980b9", "10", true, isRunning, playerAnimFrame);
}

// --- Function to draw Player 2 (multiplayer) ---
function drawPlayer2() {
    if (gameMode !== "multi") return;
    
    // Draw control indicator for Player 2 (red color)
    drawControlIndicator2(player2X + player2Width / 2, player2Y + player2Height + 5);
    
    // Draw Player 2 as a red team player
    drawPerson(player2X, player2Y, "#e74c3c", "#c0392b", "7", true, player2IsRunning, player2AnimFrame);
    
    // Draw power indicator if charging
    if (player2ChargingPower && player2PowerLevel > 0) {
        drawPowerIndicator2();
    }
}

// --- Function to draw control indicator for Player 2 (red glow) ---
function drawControlIndicator2(x, y) {
    var pulse = Math.sin(Date.now() / 150) * 3 + 10;
    
    // Outer glow (red for P2)
    pencil.beginPath();
    pencil.arc(x, y - 5, pulse + 5, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(231, 76, 60, 0.3)";
    pencil.fill();
    
    // Inner circle
    pencil.beginPath();
    pencil.arc(x, y - 5, pulse, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(231, 76, 60, 0.6)";
    pencil.fill();
    
    // Arrow pointing down at player
    pencil.fillStyle = "#e74c3c";
    pencil.beginPath();
    pencil.moveTo(x, y - 25);
    pencil.lineTo(x - 8, y - 35);
    pencil.lineTo(x - 3, y - 35);
    pencil.lineTo(x - 3, y - 45);
    pencil.lineTo(x + 3, y - 45);
    pencil.lineTo(x + 3, y - 35);
    pencil.lineTo(x + 8, y - 35);
    pencil.closePath();
    pencil.fill();
}

// --- Function to draw power indicator for Player 2 ---
function drawPowerIndicator2() {
    var barWidth = 50;
    var barHeight = 8;
    var barX = player2X + player2Width / 2 - barWidth / 2;
    var barY = player2Y - 15;
    
    // Draw background
    pencil.fillStyle = "#333";
    pencil.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw power fill with color gradient
    var fillWidth = (player2PowerLevel / maxPower) * barWidth;
    if (player2PowerLevel < 30) {
        pencil.fillStyle = "#2ecc71";
    } else if (player2PowerLevel < 70) {
        pencil.fillStyle = "#f1c40f";
    } else {
        pencil.fillStyle = "#e74c3c";
    }
    pencil.fillRect(barX, barY, fillWidth, barHeight);
    
    // Draw border
    pencil.strokeStyle = "white";
    pencil.lineWidth = 2;
    pencil.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw lightning bolt
    pencil.fillStyle = "#e74c3c";
    pencil.font = "bold 14px Arial";
    pencil.textAlign = "center";
    pencil.fillText("⚡", player2X + player2Width / 2, barY - 3);
}

// --- Function to draw control indicator (arrow pointing down) ---
function drawControlIndicator(x, y) {
    // Draw a pulsing circle under the controlled player
    var pulse = Math.sin(Date.now() / 150) * 3 + 10;
    
    // Outer glow
    pencil.beginPath();
    pencil.arc(x, y - 5, pulse + 5, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(241, 196, 15, 0.3)";
    pencil.fill();
    
    // Inner circle
    pencil.beginPath();
    pencil.arc(x, y - 5, pulse, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(241, 196, 15, 0.6)";
    pencil.fill();
    
    // Arrow pointing down at player
    pencil.fillStyle = "#f1c40f";
    pencil.beginPath();
    pencil.moveTo(x, y - 25);
    pencil.lineTo(x - 8, y - 35);
    pencil.lineTo(x - 3, y - 35);
    pencil.lineTo(x - 3, y - 45);
    pencil.lineTo(x + 3, y - 45);
    pencil.lineTo(x + 3, y - 35);
    pencil.lineTo(x + 8, y - 35);
    pencil.closePath();
    pencil.fill();
}

// --- Function to draw a person (realistic player) ---
// x, y = position, shirtColor = team color, darkColor = shadow color
// number = jersey number, isCaptain = show captain armband
// personRunning, personAnimFrame = animation parameters
function drawPerson(x, y, shirtColor, darkColor, number, isCaptain, personRunning, personAnimFrame) {
    var centerX = x + 20;
    var centerY = y + 20;
    
    // Calculate running animation offset
    var legOffset = 0;
    var armOffset = 0;
    if (personRunning) {
        legOffset = Math.sin(personAnimFrame || 0) * 4;
        armOffset = Math.sin(personAnimFrame || 0) * 3;
    }
    
    // Draw shadow under the player (moves slightly when running)
    pencil.beginPath();
    pencil.ellipse(centerX, y + 42, 14 + Math.abs(legOffset) * 0.3, 5, 0, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(0, 0, 0, 0.3)";
    pencil.fill();
    
    // Draw the legs with running animation
    pencil.fillStyle = "white";  // White shorts/socks
    pencil.fillRect(centerX - 8, y + 28 + legOffset, 6, 14);  // Left leg
    pencil.fillRect(centerX + 2, y + 28 - legOffset, 6, 14);  // Right leg
    
    // Draw the feet (black boots) with running animation
    pencil.fillStyle = "#1a1a1a";
    pencil.fillRect(centerX - 9, y + 38 + legOffset, 8, 5);   // Left foot
    pencil.fillRect(centerX + 1, y + 38 - legOffset, 8, 5);   // Right foot
    
    // Draw the body (shirt)
    pencil.fillStyle = shirtColor;
    pencil.beginPath();
    pencil.moveTo(centerX - 12, y + 12);
    pencil.lineTo(centerX + 12, y + 12);
    pencil.lineTo(centerX + 10, y + 30);
    pencil.lineTo(centerX - 10, y + 30);
    pencil.closePath();
    pencil.fill();
    
    // Draw shirt border
    pencil.strokeStyle = darkColor;
    pencil.lineWidth = 2;
    pencil.stroke();
    
    // Draw the arms with running animation
    pencil.fillStyle = shirtColor;
    pencil.fillRect(centerX - 18, y + 12 - armOffset, 8, 12);  // Left arm
    pencil.fillRect(centerX + 10, y + 12 + armOffset, 8, 12);  // Right arm
    
    // Draw the hands (skin color)
    pencil.fillStyle = "#f5cba7";
    pencil.beginPath();
    pencil.arc(centerX - 14, y + 26 - armOffset, 4, 0, Math.PI * 2);
    pencil.fill();
    pencil.beginPath();
    pencil.arc(centerX + 14, y + 26 + armOffset, 4, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw the head (circle)
    pencil.fillStyle = "#f5cba7";  // Skin color
    pencil.beginPath();
    pencil.arc(centerX, y + 6, 10, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw the hair
    pencil.fillStyle = "#2c1810";  // Dark hair
    pencil.beginPath();
    pencil.arc(centerX, y + 3, 10, Math.PI, Math.PI * 2);
    pencil.fill();
    
    // Draw the eyes
    pencil.fillStyle = "black";
    pencil.beginPath();
    pencil.arc(centerX - 4, y + 5, 2, 0, Math.PI * 2);
    pencil.arc(centerX + 4, y + 5, 2, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw the jersey number on the back
    pencil.fillStyle = "white";
    pencil.font = "bold 10px Arial";
    pencil.textAlign = "center";
    pencil.fillText(number, centerX, y + 25);
    
    // Draw captain armband if this is the captain
    if (isCaptain) {
        pencil.fillStyle = "#f1c40f";  // Yellow armband
        pencil.fillRect(centerX - 18, y + 14, 8, 4);
    }
}

// --- Function to draw the teammates ---
function drawTeammates() {
    var jerseyNumbers = ["7", "9", "11", "3", "5"];
    
    for (var i = 0; i < teammates.length; i++) {
        var teammate = teammates[i];
        
        // Draw control indicator if this teammate is being controlled
        if (i === controlledPlayerIndex) {
            drawControlIndicator(teammate.x + teammateWidth / 2, teammate.y + teammateHeight + 5);
        }
        
        // Draw teammate as a blue person
        drawPerson(teammate.x, teammate.y, "#3498db", "#2980b9", jerseyNumbers[i], false, false, 0);
    }
}

// --- Function to draw the ball ---
function drawBall() {
    // Draw ball trail for fast movement
    for (var t = 0; t < ballTrail.length; t++) {
        var trail = ballTrail[t];
        pencil.beginPath();
        pencil.arc(trail.x, trail.y, ballRadius * trail.alpha * 0.8, 0, Math.PI * 2);
        pencil.fillStyle = "rgba(255, 255, 255, " + (trail.alpha * 0.4) + ")";
        pencil.fill();
    }
    
    // Draw ball shadow (offset based on height)
    var shadowOffset = ballHeight * 0.3;
    var shadowScale = 1 - (ballHeight / 50) * 0.3;  // Shadow gets smaller when ball is higher
    pencil.beginPath();
    pencil.ellipse(ballX + shadowOffset, ballY + ballRadius + 3 + shadowOffset, 
                   ballRadius * shadowScale, ballRadius * 0.3 * shadowScale, 0, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(0, 0, 0, " + (0.4 - ballHeight * 0.008) + ")";
    pencil.fill();
    
    // Calculate ball visual position (higher when in air)
    var visualBallY = ballY - ballHeight;
    var visualBallRadius = ballRadius + (ballHeight * 0.05);  // Ball appears slightly bigger when closer (in air)
    
    // Draw the ball with gradient for 3D effect
    var gradient = pencil.createRadialGradient(
        ballX - visualBallRadius * 0.3, visualBallY - visualBallRadius * 0.3, visualBallRadius * 0.1,
        ballX, visualBallY, visualBallRadius
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(0.7, "#e0e0e0");
    gradient.addColorStop(1, "#b0b0b0");
    
    pencil.beginPath();
    pencil.arc(ballX, visualBallY, visualBallRadius, 0, Math.PI * 2);
    pencil.fillStyle = gradient;
    pencil.fill();
    
    // Draw rotating pentagon pattern (like a real football)
    pencil.save();
    pencil.translate(ballX, visualBallY);
    pencil.rotate(ballRotation);
    
    // Draw black pentagons
    pencil.fillStyle = "#1a1a1a";
    drawPentagon(0, 0, visualBallRadius * 0.45);
    
    // Draw smaller pentagons around the edge
    for (var p = 0; p < 5; p++) {
        var angle = (p / 5) * Math.PI * 2 - Math.PI / 2;
        var px = Math.cos(angle) * visualBallRadius * 0.55;
        var py = Math.sin(angle) * visualBallRadius * 0.55;
        drawPentagon(px, py, visualBallRadius * 0.25);
    }
    
    pencil.restore();
    
    // Draw shiny highlight
    pencil.beginPath();
    pencil.arc(ballX - visualBallRadius * 0.3, visualBallY - visualBallRadius * 0.3, 
               visualBallRadius * 0.2, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(255, 255, 255, 0.6)";
    pencil.fill();
}

// Helper function to draw a pentagon
function drawPentagon(cx, cy, size) {
    pencil.beginPath();
    for (var i = 0; i < 5; i++) {
        var angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
        var x = cx + Math.cos(angle) * size;
        var y = cy + Math.sin(angle) * size;
        if (i === 0) {
            pencil.moveTo(x, y);
        } else {
            pencil.lineTo(x, y);
        }
    }
    pencil.closePath();
    pencil.fill();
}

// --- Function to draw the enemy players ---
function drawEnemies() {
    var jerseyNumbers = ["2", "4", "6", "8", "14"];
    
    // Loop through each enemy and draw them as red people
    for (var i = 0; i < enemies.length; i++) {
        var enemy = enemies[i];
        // Draw enemy as a red person
        drawPerson(enemy.x, enemy.y, "#e74c3c", "#c0392b", jerseyNumbers[i], false, false, 0);
    }
}

// --- Function to draw the goalkeeper ---
function drawGoalkeeper() {
    var centerX = goalkeeperX + goalkeeperWidth / 2;
    var centerY = goalkeeperY + goalkeeperHeight / 2;
    
    // Draw shadow
    pencil.beginPath();
    pencil.ellipse(centerX, goalkeeperY + goalkeeperHeight + 2, 16, 4, 0, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(0, 0, 0, 0.3)";
    pencil.fill();
    
    // Draw legs
    pencil.fillStyle = "#1a1a1a";
    pencil.fillRect(centerX - 8, goalkeeperY + 18, 6, 12);
    pencil.fillRect(centerX + 2, goalkeeperY + 18, 6, 12);
    
    // Draw body (goalkeeper jersey - bright yellow/green)
    pencil.fillStyle = "#2ecc71";  // Green goalkeeper jersey
    pencil.beginPath();
    pencil.moveTo(centerX - 14, goalkeeperY + 2);
    pencil.lineTo(centerX + 14, goalkeeperY + 2);
    pencil.lineTo(centerX + 12, goalkeeperY + 20);
    pencil.lineTo(centerX - 12, goalkeeperY + 20);
    pencil.closePath();
    pencil.fill();
    
    // Draw arms stretched out (goalkeeper ready pose!)
    pencil.fillStyle = "#2ecc71";
    pencil.fillRect(centerX - 24, goalkeeperY + 4, 12, 8);  // Left arm
    pencil.fillRect(centerX + 12, goalkeeperY + 4, 12, 8);  // Right arm
    
    // Draw gloves (goalkeeper gloves!)
    pencil.fillStyle = "#f39c12";  // Orange gloves
    pencil.beginPath();
    pencil.arc(centerX - 26, goalkeeperY + 8, 5, 0, Math.PI * 2);
    pencil.arc(centerX + 26, goalkeeperY + 8, 5, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw head
    pencil.fillStyle = "#f5cba7";
    pencil.beginPath();
    pencil.arc(centerX, goalkeeperY - 2, 8, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw goalkeeper cap
    pencil.fillStyle = "#2ecc71";
    pencil.beginPath();
    pencil.arc(centerX, goalkeeperY - 5, 8, Math.PI, Math.PI * 2);
    pencil.fill();
    pencil.fillRect(centerX - 10, goalkeeperY - 5, 20, 4);
    
    // Draw "1" on the shirt
    pencil.fillStyle = "white";
    pencil.font = "bold 10px Arial";
    pencil.textAlign = "center";
    pencil.fillText("1", centerX, goalkeeperY + 14);
}

// --- Function to draw YOUR goalkeeper (at bottom, blue team) ---
function drawMyGoalkeeper() {
    var centerX = myGoalkeeperX + myGoalkeeperWidth / 2;
    var centerY = myGoalkeeperY;
    
    // Draw shadow
    pencil.beginPath();
    pencil.ellipse(centerX, myGoalkeeperY + myGoalkeeperHeight + 2, 16, 4, 0, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(0, 0, 0, 0.3)";
    pencil.fill();
    
    // Draw legs
    pencil.fillStyle = "#1a1a1a";
    pencil.fillRect(centerX - 8, myGoalkeeperY + 18, 6, 12);
    pencil.fillRect(centerX + 2, myGoalkeeperY + 18, 6, 12);
    
    // Draw body (YOUR goalkeeper jersey - bright blue)
    pencil.fillStyle = "#00bfff";  // Light blue goalkeeper jersey
    pencil.beginPath();
    pencil.moveTo(centerX - 14, myGoalkeeperY + 2);
    pencil.lineTo(centerX + 14, myGoalkeeperY + 2);
    pencil.lineTo(centerX + 12, myGoalkeeperY + 20);
    pencil.lineTo(centerX - 12, myGoalkeeperY + 20);
    pencil.closePath();
    pencil.fill();
    
    // Draw arms stretched out
    pencil.fillStyle = "#00bfff";
    pencil.fillRect(centerX - 24, myGoalkeeperY + 4, 12, 8);  // Left arm
    pencil.fillRect(centerX + 12, myGoalkeeperY + 4, 12, 8);  // Right arm
    
    // Draw gloves (blue gloves for your team!)
    pencil.fillStyle = "#3498db";  // Blue gloves
    pencil.beginPath();
    pencil.arc(centerX - 26, myGoalkeeperY + 8, 5, 0, Math.PI * 2);
    pencil.arc(centerX + 26, myGoalkeeperY + 8, 5, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw head
    pencil.fillStyle = "#f5cba7";
    pencil.beginPath();
    pencil.arc(centerX, myGoalkeeperY - 2, 8, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw goalkeeper cap
    pencil.fillStyle = "#00bfff";
    pencil.beginPath();
    pencil.arc(centerX, myGoalkeeperY - 5, 8, Math.PI, Math.PI * 2);
    pencil.fill();
    pencil.fillRect(centerX - 10, myGoalkeeperY - 5, 20, 4);
    
    // Draw "1" on the shirt
    pencil.fillStyle = "white";
    pencil.font = "bold 10px Arial";
    pencil.textAlign = "center";
    pencil.fillText("1", centerX, myGoalkeeperY + 14);
}

// --- Function to draw the referee ---
function drawReferee() {
    var centerX = refereeX + refereeWidth / 2;
    var centerY = refereeY + refereeHeight / 2;
    
    // Draw shadow
    pencil.beginPath();
    pencil.ellipse(centerX, refereeY + refereeHeight + 5, 12, 4, 0, 0, Math.PI * 2);
    pencil.fillStyle = "rgba(0, 0, 0, 0.3)";
    pencil.fill();
    
    // Draw legs (black shorts)
    pencil.fillStyle = "#1a1a1a";
    pencil.fillRect(centerX - 6, refereeY + 20, 5, 12);
    pencil.fillRect(centerX + 1, refereeY + 20, 5, 12);
    
    // Draw feet
    pencil.fillStyle = "#1a1a1a";
    pencil.fillRect(centerX - 7, refereeY + 30, 6, 4);
    pencil.fillRect(centerX + 1, refereeY + 30, 6, 4);
    
    // Draw body (black and white striped referee shirt)
    // First draw black base
    pencil.fillStyle = "#1a1a1a";
    pencil.beginPath();
    pencil.moveTo(centerX - 10, refereeY + 6);
    pencil.lineTo(centerX + 10, refereeY + 6);
    pencil.lineTo(centerX + 8, refereeY + 22);
    pencil.lineTo(centerX - 8, refereeY + 22);
    pencil.closePath();
    pencil.fill();
    
    // Draw white stripes
    pencil.fillStyle = "white";
    pencil.fillRect(centerX - 6, refereeY + 8, 3, 12);
    pencil.fillRect(centerX - 1, refereeY + 8, 3, 12);
    pencil.fillRect(centerX + 4, refereeY + 8, 3, 12);
    
    // Draw arms
    pencil.fillStyle = "#1a1a1a";
    pencil.fillRect(centerX - 16, refereeY + 8, 8, 6);
    pencil.fillRect(centerX + 8, refereeY + 8, 8, 6);
    
    // Draw hands
    pencil.fillStyle = "#f5cba7";
    pencil.beginPath();
    pencil.arc(centerX - 17, refereeY + 11, 3, 0, Math.PI * 2);
    pencil.arc(centerX + 17, refereeY + 11, 3, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw head
    pencil.fillStyle = "#f5cba7";
    pencil.beginPath();
    pencil.arc(centerX, refereeY + 2, 8, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw hair (short black hair)
    pencil.fillStyle = "#1a1a1a";
    pencil.beginPath();
    pencil.arc(centerX, refereeY - 1, 8, Math.PI, Math.PI * 2);
    pencil.fill();
    
    // Draw eyes
    pencil.fillStyle = "black";
    pencil.beginPath();
    pencil.arc(centerX - 3, refereeY + 1, 1.5, 0, Math.PI * 2);
    pencil.arc(centerX + 3, refereeY + 1, 1.5, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw whistle around neck
    pencil.fillStyle = "#c0c0c0";  // Silver whistle
    pencil.beginPath();
    pencil.arc(centerX, refereeY + 8, 3, 0, Math.PI * 2);
    pencil.fill();
    
    // Draw special states
    if (refereeState === "whistle") {
        // Show whistle being blown (whistle near mouth)
        pencil.fillStyle = "#c0c0c0";
        pencil.beginPath();
        pencil.arc(centerX + 10, refereeY + 3, 4, 0, Math.PI * 2);
        pencil.fill();
        
        // Sound waves from whistle
        pencil.strokeStyle = "#ffd700";
        pencil.lineWidth = 2;
        for (var i = 1; i <= 3; i++) {
            pencil.beginPath();
            pencil.arc(centerX + 10, refereeY + 3, 5 + i * 4, -0.5, 0.5);
            pencil.stroke();
        }
        
        // Arm pointing up
        pencil.fillStyle = "#1a1a1a";
        pencil.save();
        pencil.translate(centerX + 12, refereeY + 8);
        pencil.rotate(-Math.PI / 4);
        pencil.fillRect(0, -3, 12, 6);
        pencil.restore();
        
    } else if (refereeState === "cardYellow") {
        // Show yellow card
        pencil.fillStyle = "#f1c40f";
        pencil.fillRect(centerX + 12, refereeY - 10, 15, 22);
        pencil.strokeStyle = "#000";
        pencil.lineWidth = 1;
        pencil.strokeRect(centerX + 12, refereeY - 10, 15, 22);
        
        // Arm holding card up
        pencil.fillStyle = "#1a1a1a";
        pencil.fillRect(centerX + 8, refereeY - 5, 8, 15);
        
    } else if (refereeState === "cardRed") {
        // Show red card
        pencil.fillStyle = "#e74c3c";
        pencil.fillRect(centerX + 12, refereeY - 10, 15, 22);
        pencil.strokeStyle = "#000";
        pencil.lineWidth = 1;
        pencil.strokeRect(centerX + 12, refereeY - 10, 15, 22);
        
        // Arm holding card up
        pencil.fillStyle = "#1a1a1a";
        pencil.fillRect(centerX + 8, refereeY - 5, 8, 15);
        
    } else if (refereeState === "running") {
        // Show running animation (arms moving)
        var armAngle = Math.sin(Date.now() / 100) * 0.3;
        pencil.save();
        pencil.translate(centerX, refereeY + 10);
        pencil.rotate(armAngle);
        pencil.fillStyle = "#1a1a1a";
        pencil.fillRect(-18, -3, 8, 6);
        pencil.restore();
    }
}

// --- Function to draw "GOAL!" message ---
function drawGoalMessage() {
    if (showingGoalMessage) {
        // Choose color based on who scored
        if (goalMessageText === "GOAL!") {
            pencil.fillStyle = "#ffd700";  // Gold color for YOUR goal
        } else {
            pencil.fillStyle = "#ff6347";  // Red color for enemy goal
        }
        
        // Draw the message text
        pencil.font = "bold 50px Arial";
        pencil.textAlign = "center";
        pencil.fillText(goalMessageText, canvas.width / 2, canvas.height / 2);
        
        // Draw a smaller text below
        pencil.font = "bold 20px Arial";
        if (goalMessageText === "GOAL!") {
            pencil.fillStyle = "#00ff00";
            pencil.fillText("YOU SCORED!", canvas.width / 2, canvas.height / 2 + 35);
        } else {
            pencil.fillStyle = "#ff6347";
            pencil.fillText("DEFEND BETTER!", canvas.width / 2, canvas.height / 2 + 35);
        }
        
        // Count down the timer
        goalMessageTimer = goalMessageTimer - 1;
        if (goalMessageTimer <= 0) {
            showingGoalMessage = false;
        }
    }
}

// --- Function to draw "GAME OVER" screen ---
function drawGameOver() {
    // Draw a dark overlay
    pencil.fillStyle = "rgba(0, 0, 0, 0.7)";
    pencil.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw "GAME OVER" text
    pencil.fillStyle = "#ff6347";  // Red color
    pencil.font = "bold 48px Arial";
    pencil.textAlign = "center";
    pencil.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 60);
    
    // Draw the final score based on game mode
    if (gameMode === "multi") {
        // Multiplayer mode
        pencil.fillStyle = "#3498db";  // Blue for P1
        pencil.font = "bold 28px Arial";
        pencil.fillText("🔵 Blue (P1): " + score + " goals", canvas.width / 2, canvas.height / 2 - 15);
        
        pencil.fillStyle = "#e74c3c";  // Red for P2
        pencil.fillText("🔴 Red (P2): " + enemyScore + " goals", canvas.width / 2, canvas.height / 2 + 20);
        
        // Show who won!
        pencil.font = "bold 36px Arial";
        if (score > enemyScore) {
            pencil.fillStyle = "#3498db";  // Blue
            pencil.fillText("🏆 PLAYER 1 WINS! 🏆", canvas.width / 2, canvas.height / 2 + 70);
        } else if (enemyScore > score) {
            pencil.fillStyle = "#e74c3c";  // Red
            pencil.fillText("🏆 PLAYER 2 WINS! 🏆", canvas.width / 2, canvas.height / 2 + 70);
        } else {
            pencil.fillStyle = "#f1c40f";  // Yellow
            pencil.fillText("IT'S A TIE!", canvas.width / 2, canvas.height / 2 + 70);
        }
    } else {
        // Single player mode
        pencil.fillStyle = "#00ff00";  // Green for your score
        pencil.font = "bold 28px Arial";
        pencil.fillText("You: " + score + " goals", canvas.width / 2, canvas.height / 2 - 15);
        
        pencil.fillStyle = "#ff6347";  // Red for enemy score
        pencil.fillText("Enemy: " + enemyScore + " goals", canvas.width / 2, canvas.height / 2 + 20);
        
        // Show who won!
        pencil.font = "bold 36px Arial";
        if (score > enemyScore) {
            pencil.fillStyle = "#ffd700";  // Gold
            pencil.fillText("🏆 YOU WIN! 🏆", canvas.width / 2, canvas.height / 2 + 70);
        } else if (enemyScore > score) {
            pencil.fillStyle = "#ff6347";  // Red
            pencil.fillText("YOU LOSE!", canvas.width / 2, canvas.height / 2 + 70);
        } else {
            pencil.fillStyle = "#87ceeb";  // Light blue
            pencil.fillText("IT'S A TIE!", canvas.width / 2, canvas.height / 2 + 70);
        }
    }
    
    // Draw restart instructions
    pencil.fillStyle = "white";
    pencil.font = "18px Arial";
    pencil.fillText("Refresh the page to play again!", canvas.width / 2, canvas.height / 2 + 110);
}

// --- Function to draw power indicator above player ---
function drawPowerIndicator() {
    var barWidth = 50;
    var barHeight = 8;
    var barX = playerX + playerWidth / 2 - barWidth / 2;
    var barY = playerY - 15;
    
    // Draw background
    pencil.fillStyle = "#333";
    pencil.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw power fill with color gradient
    var fillWidth = (powerLevel / maxPower) * barWidth;
    if (powerLevel < 30) {
        pencil.fillStyle = "#2ecc71";  // Green
    } else if (powerLevel < 70) {
        pencil.fillStyle = "#f1c40f";  // Yellow
    } else {
        pencil.fillStyle = "#e74c3c";  // Red
    }
    pencil.fillRect(barX, barY, fillWidth, barHeight);
    
    // Draw border
    pencil.strokeStyle = "white";
    pencil.lineWidth = 2;
    pencil.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw lightning bolt
    pencil.fillStyle = "#f1c40f";
    pencil.font = "bold 14px Arial";
    pencil.textAlign = "center";
    pencil.fillText("⚡", playerX + playerWidth / 2, barY - 3);
}

// --- Function to draw stamina bar ---
function drawStaminaBar() {
    var barWidth = 80;
    var barHeight = 10;
    var barX = 10;
    var barY = 10;
    
    // Draw Player 1 stamina bar (bottom left)
    // Draw background
    pencil.fillStyle = "rgba(0, 0, 0, 0.5)";
    pencil.fillRect(barX - 2, barY - 2, barWidth + 4, barHeight + 4);
    
    // Draw stamina background
    pencil.fillStyle = "#333";
    pencil.fillRect(barX, barY, barWidth, barHeight);
    
    // Draw stamina fill
    var fillWidth = (playerStamina / 100) * barWidth;
    if (playerStamina > 60) {
        pencil.fillStyle = "#2ecc71";  // Green - good stamina
    } else if (playerStamina > 30) {
        pencil.fillStyle = "#f1c40f";  // Yellow - medium stamina
    } else {
        pencil.fillStyle = "#e74c3c";  // Red - low stamina
    }
    pencil.fillRect(barX, barY, fillWidth, barHeight);
    
    // Draw border
    pencil.strokeStyle = "white";
    pencil.lineWidth = 1;
    pencil.strokeRect(barX, barY, barWidth, barHeight);
    
    // Draw label
    pencil.fillStyle = "white";
    pencil.font = "bold 10px Arial";
    pencil.textAlign = "left";
    pencil.fillText(gameMode === "multi" ? "P1 STAMINA" : "STAMINA", barX, barY + barHeight + 12);
    
    // Draw weather indicator
    var weatherIcon = weatherType === "rain" ? "🌧️" : weatherType === "windy" ? "💨" : "☀️";
    pencil.font = "16px Arial";
    pencil.fillText(weatherIcon, barX + barWidth + 10, barY + barHeight);
    
    // Draw Player 2 stamina bar in multiplayer (top right)
    if (gameMode === "multi") {
        var bar2X = canvas.width - barWidth - 10;
        var bar2Y = 10;
        
        // Draw background
        pencil.fillStyle = "rgba(0, 0, 0, 0.5)";
        pencil.fillRect(bar2X - 2, bar2Y - 2, barWidth + 4, barHeight + 4);
        
        // Draw stamina background
        pencil.fillStyle = "#333";
        pencil.fillRect(bar2X, bar2Y, barWidth, barHeight);
        
        // Draw stamina fill
        var fill2Width = (player2Stamina / 100) * barWidth;
        if (player2Stamina > 60) {
            pencil.fillStyle = "#2ecc71";
        } else if (player2Stamina > 30) {
            pencil.fillStyle = "#f1c40f";
        } else {
            pencil.fillStyle = "#e74c3c";
        }
        pencil.fillRect(bar2X, bar2Y, fill2Width, barHeight);
        
        // Draw border
        pencil.strokeStyle = "white";
        pencil.lineWidth = 1;
        pencil.strokeRect(bar2X, bar2Y, barWidth, barHeight);
        
        // Draw label
        pencil.fillStyle = "white";
        pencil.font = "bold 10px Arial";
        pencil.textAlign = "right";
        pencil.fillText("P2 STAMINA", bar2X + barWidth, bar2Y + barHeight + 12);
    }
}

// ===================================
// STEP 6: THE MAIN GAME LOOP
// ===================================

// This function runs over and over to make the game work
function gameLoop() {
    // Apply camera shake
    applyCameraShake();
    
    // Apply camera transform
    pencil.save();
    pencil.translate(cameraShakeX, cameraShakeY);
    
    var hostSimulates = !(gameMode === "multi" && !isHost());
    // Only update the game if it's not over
    if (!gameOver && hostSimulates) {
        // Move everything
        movePlayer();
        movePlayer2();  // Player 2 movement (multiplayer only)
        moveBall();
        
        // In single player, move AI enemies; in multiplayer, skip AI
        if (gameMode === "single") {
            moveEnemies();
        }
        
        moveGoalkeeper();
        moveMyGoalkeeper();
        moveTeammates();
        moveReferee();
        
        // Update particles
        updateParticles();
        
        // Check for collisions
        if (gameMode === "single") {
            checkEnemyCollision();
            checkBallEnemyCollision();
        }
        checkTeammatePass();
        checkPlayer2BallCollision();  // Player 2 ball interaction
        
        // Check if the ball went into the goal
        checkGoal();
        
        // Charge power if holding shift
        if (isChargingPower && powerLevel < maxPower) {
            powerLevel += 2;
            if (powerLevel > maxPower) powerLevel = maxPower;
            updatePowerBar();
        }
    }
    
    // Draw everything on the screen
    drawField();
    drawGoal();
    drawGoalkeeper();
    drawMyGoalkeeper();
    drawReferee();
    
    // Draw enemies only in single player mode
    if (gameMode === "single") {
        drawEnemies();
    }
    
    drawTeammates();
    drawPlayer();
    drawPlayer2();  // Draw Player 2 (multiplayer only)
    drawBall();
    
    // Draw particles
    drawParticles();
    
    // Draw weather effects
    drawWeather();
    
    // Draw stamina bar
    drawStaminaBar();
    
    // Draw power indicator on player if charging
    if (isChargingPower && powerLevel > 0) {
        drawPowerIndicator();
    }
    
    // Draw goal message if we just scored
    drawGoalMessage();
    
    // Draw game over screen if time is up
    if (gameOver) {
        drawGameOver();
    }
    
    // Restore camera transform
    pencil.restore();
    
    // Run this function again in a moment (about 60 times per second)
    requestAnimationFrame(gameLoop);
}

// ===================================
// STEP 7: THE TIMER
// ===================================

// This function runs every second to count down the time
function countDown() {
    // Only count down if the game is not over
    if (!gameOver && gameStarted) {
        if (gameMode === "multi" && !isHost()) {
            return; // host controls the clock
        }
        // Subtract one second
        timeLeft = timeLeft - 1;
        
        // Update the time display
        document.getElementById("time-display").textContent = "Time: " + timeLeft;
        
        // Check if time ran out
        if (timeLeft <= 0) {
            gameOver = true;
            playSound("whistle");
        }
    }
}

// ===================================
// STEP 8: START THE GAME!
// ===================================

// The game will start when player clicks a difficulty button
// (see startGame function at the top)

// Show a message in the console
console.log("⚽ Football Game Ready! Choose a difficulty to start!");
