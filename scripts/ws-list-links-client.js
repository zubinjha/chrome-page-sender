const { WebSocket } = require("ws");

const ws = new WebSocket("ws://localhost:4587/ws");

ws.on("open", () => {
  console.log("Connected. Requesting links...");
  ws.send(JSON.stringify({ type: "list_links" }));
});

ws.on("message", (data) => {
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
    ws.close();
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message || err);
});
