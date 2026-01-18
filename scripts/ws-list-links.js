const http = require("http");
const { WebSocketServer } = require("ws");

const server = http.createServer();
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket) => {
  console.log("Extension connected. Requesting links...");
  socket.send(JSON.stringify({ type: "list_links" }));

  socket.on("message", (data) => {
    let message;
    try {
      message = JSON.parse(data.toString());
    } catch (err) {
      console.error("Invalid message JSON:", data.toString());
      return;
    }

    if (message.type === "links_result") {
      if (!message.ok) {
        console.error("Failed to list links:", message.error);
      } else {
        const links = Array.isArray(message.links) ? message.links : [];
        console.log(`Links (${links.length}):`);
        for (const link of links) {
          console.log(`- [${link.index}] ${link.href} ${link.text ? `(${link.text})` : ""}`);
        }
      }
    }
  });

  socket.on("close", () => {
    console.log("Extension disconnected.");
  });
});

server.listen(4587, () => {
  console.log("WS test server listening on ws://localhost:4587/ws");
});
