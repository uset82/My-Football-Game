# ⚽ My Football Game

A fun 2D football (soccer) game made for kids learning to code!

![Game Preview](https://img.shields.io/badge/Made%20With-HTML%20%2B%20CSS%20%2B%20JavaScript-blue)
![Difficulty](https://img.shields.io/badge/Difficulty-Beginner-green)
![Age](https://img.shields.io/badge/Age-9%2B-orange)

---

## 🎮 How to Play

### Controls
| Key | Action |
|-----|--------|
| ⬆️ Arrow Up | Move player up |
| ⬇️ Arrow Down | Move player down |
| ⬅️ Arrow Left | Move player left |
| ➡️ Arrow Right | Move player right |
| **SPACE** | Kick the ball! |

### Goal
Score as many goals as possible before the 60-second timer runs out!

---

## 🚀 How to Run the Game

### ▶️ Quick Start (Click to Play!)
**[🎮 Launch Game](http://localhost:8080)** ← Click here if the Python server is running!

### Option 1: Simple (Double-Click)
1. Open the folder containing the game files
2. Double-click on `index.html`
3. The game opens in your web browser!

### Option 2: Using VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

### Option 3: Using Python Server
1. Open a terminal in the game folder
2. Run: `python -m http.server 8080`
3. Open [http://localhost:8080](http://localhost:8080) in your browser

---

## 📁 Project Files

```
📂 My Football Game
├── 📄 index.html      ← Main game page
├── 🎨 style.css       ← Makes everything look nice
├── 🎮 game.js         ← The game code (the fun part!)
├── 📋 README.md       ← This file!
└── 📝 PROJECT_LOG.md  ← Development history
```

---

## ⚽ Game Features

### Your Team (Blue) 🔵
- **You** - Player #10 with captain armband
- **5 Teammates** - #3, #5, #7, #9, #11

### Enemy Team (Red) 🔴
- **Goalkeeper** - #1 in green jersey
- **5 Defenders** - #2, #4, #6, #8, #14

### Gameplay
- ⏱️ 60-second countdown timer
- 🎯 Score counter
- 🤝 Teammates help pass the ball toward the goal
- 🛡️ Enemies try to block your shots
- 🧤 Goalkeeper tries to save your goals

---

## 🛠️ Customize the Game!

Open `game.js` and try changing these:

### Make Player Faster/Slower
```javascript
var playerSpeed = 5;  // Change to 10 for super speed!
```

### Change Game Time
```javascript
var timeLeft = 60;  // Change to 120 for 2 minutes!
```

### Change Field Color
```javascript
pencil.fillStyle = "#2e8b2e";  // Try "#4169E1" for blue!
```

### Make Goal Bigger/Smaller
```javascript
var goalWidth = 150;  // Make bigger for easy mode!
```

---

## 📚 Learning Points

This game teaches:
- ✅ HTML structure (`<canvas>`, `<div>`, `<script>`)
- ✅ CSS styling (colors, fonts, layout)
- ✅ JavaScript basics (variables, functions, loops)
- ✅ Game loops and animation
- ✅ Keyboard input handling
- ✅ Collision detection
- ✅ Canvas drawing

---

## 👨‍💻 Created By

Made with ❤️ for learning to code!

**Date:** December 2024

---

## 📄 License

Free to use, modify, and share for learning purposes!
