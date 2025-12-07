// Simple socket.io relay server for My Football Game multiplayer.
// Usage: node server.js
// Env: PORT (default 3000)

const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;

// Create HTTP server with health check endpoint
const server = http.createServer((req, res) => {
    // Health check endpoint for Render
    if (req.url === "/" || req.url === "/health") {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Football Game Multiplayer Server Running");
    } else {
        res.writeHead(404);
        res.end("Not Found");
    }
});

const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

// Track room roles (p1, p2)
const rooms = new Map();

function getRoom(roomId) {
    if (!rooms.has(roomId)) {
        rooms.set(roomId, { players: new Map() });
    }
    return rooms.get(roomId);
}

function assignRole(room) {
    const used = new Set(room.players.values());
    if (!used.has("p1")) return "p1";
    if (!used.has("p2")) return "p2";
    return "spectator";
}

io.on("connection", (socket) => {
    const roomId = socket.handshake.query.room || "public";
    const room = getRoom(roomId);
    const role = assignRole(room);
    room.players.set(socket.id, role);
    socket.join(roomId);

    socket.emit("joined", { room: roomId, role });
    socket.to(roomId).emit("player-joined", { role, id: socket.id });

    socket.on("start", (payload) => {
        socket.to(roomId).emit("start", payload || {});
    });

    socket.on("input", (payload) => {
        // Relay inputs to the rest of the room
        socket.to(roomId).emit("input", payload);
    });

    socket.on("state", (payload) => {
        // Host can send state snapshots; relay to others
        socket.to(roomId).emit("state", payload);
    });

    socket.on("disconnect", () => {
        const r = getRoom(roomId);
        r.players.delete(socket.id);
        socket.to(roomId).emit("player-left", { role, id: socket.id });
    });
});

server.listen(PORT, () => {
    console.log(`Multiplayer server listening on :${PORT}`);
});

