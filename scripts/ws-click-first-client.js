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
      ws.close();
      return;
    }

    const links = Array.isArray(message.links) ? message.links : [];
    if (!links.length) {
      console.log("No links found to click.");
      ws.close();
      return;
    }

    console.log(`Clicking first link: [${links[0].index}] ${links[0].href}`);
    ws.send(JSON.stringify({ type: "click_link", index: links[0].index }));
    return;
  }

  if (message.type === "click_result") {
    if (!message.ok) {
      console.error("Click failed:", message.error);
    } else {
      console.log("Click result:", message.result);
    }
    ws.close();
  }
});

ws.on("error", (err) => {
  console.error("WebSocket error:", err.message || err);
});
