const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const watchPartyLive = require("./live");

const app = express();

// Middleware
app.use(cors({ origin: "*" }));
app.use(helmet());
app.use(express.json());
app.use(morgan("dev"));

// Health check endpoint
app.get("/", (_req, res, _next) => {
  res.json({
    status: "ok",
    name: "StreamGo Party Server",
    version: "1.0.0"
  });
});

// Start HTTP server
const PORT = process.env.PORT || 7860;
const server = app.listen(PORT, () => {
  console.log(`StreamGo Party Server running on port ${PORT}`);
});

// Initialize WebSocket server
watchPartyLive(server);
