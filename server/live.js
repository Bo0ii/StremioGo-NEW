const WebSocket = require("ws");

const watchPartyVersion = "1";
const serverPrefix = process.env.SERVER_PREFIX || "S";

let wss;

module.exports = (server) => {
  wss = new WebSocket.Server({ server });
  wss.on("connection", onConnection);

  // Heartbeat interval - ping clients every 30 seconds
  const interval = setInterval(
    () =>
      wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();

        ws.isAlive = false;
        ws.startMsg = Date.now();
        ws.send("ping");
      }),
    30000
  );

  wss.on("close", () => clearInterval(interval));
  console.log(`StreamGo Party WebSocket Server is running!`);
  return wss;
};

function onConnection(ws, req) {
  // Validate protocol header
  if (!req.headers["sec-websocket-protocol"]) return ws.terminate();

  const protocol = req.headers["sec-websocket-protocol"].charAt(0);
  ws.userId = req.headers["sec-websocket-key"];

  // Validate protocol type (c=create, j=join)
  if (!protocols[protocol]) return ws.terminate();

  // Parse protocol parameters
  const params = req.headers["sec-websocket-protocol"]
    .split("#")
    .map((p) => decodeURIComponent(p));

  // Version check
  const v = params[1];
  if (v !== watchPartyVersion) {
    ws.send("upgrade");
    return ws.terminate();
  }

  // Initialize connection
  ws.isAlive = true;
  ws.startMsg = Date.now();
  ws.send("ping");

  // Set up event handlers
  ws.on("message", (data, binary) => (binary ? null : onMessage(ws, data)));
  ws.on("error", (error) => onError(ws, error));
  ws.on("close", () => onClose(ws));

  // Execute protocol handler (create or join)
  protocols[protocol](ws, params);
}

function onError(ws, err) {
  console.error(`[WS Error]: ${err.message}`);
}

function onClose(ws) {
  const partyCode = ws.partyCode;
  if (!partyCode) return;

  const party = parties[partyCode];
  if (!party) return;

  // If last client, delete party
  if (party.clients.length === 1) {
    delete parties[partyCode];
  } else {
    // Remove client from party
    party.clients = party.clients.filter((el) => el !== ws);

    // If no hosts remain, promote first client to host
    if (!party.clients.find((ws) => ws.isHost)) {
      party.clients[0].isHost = true;
    }

    // Notify remaining clients
    updateParty(party);
  }
}

function updateParty(party) {
  // Build member list
  const partyMembers = party.clients.map((ws) => ({
    userId: ws.userId,
    userName: ws.userName,
    isHost: ws.isHost,
  }));

  // Broadcast party state to all clients
  party.clients.forEach((ws) => {
    ws.send(
      "party:" +
        JSON.stringify({
          name: party.name,
          code: party.code,
          members: partyMembers,
        })
    );
  });
}

function onMessage(ws, data) {
  data = data.toString();

  // Chat message
  if (data.startsWith("msg:")) {
    const party = parties[ws.partyCode];
    if (!party) return;

    party.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send("msg:" + ws.userId + ":" + data.substring(4));
      }
    });
  }
  // Toggle host status (host only)
  else if (ws.isHost && data.startsWith("toggle:")) {
    const id = data.substring(7);
    const party = parties[ws.partyCode];
    if (!party) return;

    const hosts = party.clients.filter((ws) => ws.isHost);
    const user = party.clients.find((client) => client.userId === id);

    // Can only toggle if: multiple hosts OR toggling non-host
    // This ensures at least one host always remains
    if (user && (hosts.length > 1 || !user.isHost)) {
      user.isHost = !user.isHost;
      updateParty(party);
    }
  }
  // Command broadcast (any member can send - allows pause/play for all)
  else if (data.startsWith("cmd:")) {
    const party = parties[ws.partyCode];
    if (!party) return;

    party.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        // Add latency compensation: sender latency + receiver latency
        const latencies = (ws.latency || 0) + (client.latency || 0);
        client.send("cmd:" + Math.round(latencies) + ":" + data.substring(4));
      }
    });
  }
  // Pong response - update latency
  else if (data === "pong") {
    ws.isAlive = true;
    ws.latency = Date.now() - ws.startMsg;
  }
}

const protocols = {
  c: createParty,
  j: joinParty,
};

const parties = {};

function generatePartyCode(tries = 0) {
  // Character set (excluding confusing characters like O/0, I/1)
  const characters = "0123456789ABCDEHIJKLMNORSTUVWYZ";

  // Start with 5 chars, increase if collisions occur
  const length = 5 + Math.floor(tries / 3);

  // Start with server prefix (e.g., "S" for StreamGo)
  let code = serverPrefix;

  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }

  // Retry if code already exists
  if (parties[code]) return generatePartyCode(tries + 1);

  return code;
}

// Protocol: c#version#username#password#partyname#joinAsHost
function createParty(ws, params) {
  const userName = params[2] || "Anonymous";
  const password = params[3] || "";
  const name = params[4] || "Watch Party";
  const joinAsHost = params[5] || "0";

  const code = generatePartyCode();

  ws.partyCode = code;
  ws.isHost = true;
  ws.userName = userName;

  parties[code] = {
    code,
    password,
    name,
    joinAsHost: joinAsHost === "1",
    clients: [ws],
  };

  updateParty(parties[code]);
}

// Protocol: j#version#username#partycode#password
function joinParty(ws, params) {
  const userName = params[2] || "Anonymous";
  const code = params[3] || "???";
  const password = params[4] || "";

  const party = parties[code];

  // Validate party exists and password matches
  if (party && party.password === password) {
    ws.partyCode = code;
    ws.isHost = party.joinAsHost; // New members get host if party allows
    ws.userName = userName;

    party.clients.push(ws);
    updateParty(party);
  } else {
    ws.send("badroom");
    ws.terminate();
  }
}
