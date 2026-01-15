const INGEST_URL = "http://localhost:4587/ingest";
const WS_URL = "ws://localhost:4587/ws";
const INCLUDE_HTML = false;
const MAX_TEXT_CHARS = 200000;
const WS_RECONNECT_MS = 3000;

let socket = null;
let socketReconnectTimer = null;

function capturePage(includeHtml, maxChars) {
  const title = document.title || "";
  const url = location.href || "";
  const rawText = document.body ? document.body.innerText : "";
  const text =
    typeof maxChars === "number" && maxChars > 0 && rawText.length > maxChars
      ? rawText.slice(0, maxChars)
      : rawText;
  const page = { title, url, text };

  if (includeHtml) {
    page.html = document.documentElement ? document.documentElement.outerHTML : "";
  }

  return page;
}

async function buildPayloadFromTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    console.error("No active tab found.");
    return null;
  }

  const tabUrl = tab.url || "";
  if (!/^https?:\/\//i.test(tabUrl)) {
    console.error("Unsupported tab URL; only http/https pages can be captured.");
    return null;
  }

  let page;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: capturePage,
      args: [INCLUDE_HTML, MAX_TEXT_CHARS],
    });
    page = results && results[0] ? results[0].result : null;
  } catch (err) {
    console.error("Failed to capture page content.", err);
    return null;
  }

  if (!page) {
    console.error("No page content captured.");
    return null;
  }

  return {
    captured_at: new Date().toISOString(),
    source: "chrome-page-sender",
    page,
  };
}

async function postPayload(payload) {
  try {
    const response = await fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`POST failed with status ${response.status}.`);
      return false;
    }

    console.log("Page sent successfully.");
    return true;
  } catch (err) {
    console.error("Failed to send page content.", err);
    return false;
  }
}

async function captureActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return buildPayloadFromTab(tab);
}

async function sendActiveTab(tab) {
  const payload = await buildPayloadFromTab(tab);
  if (!payload) {
    return;
  }

  await postPayload(payload);
}

function scheduleReconnect() {
  if (socketReconnectTimer) {
    return;
  }

  socketReconnectTimer = setTimeout(() => {
    socketReconnectTimer = null;
    connectWebSocket();
  }, WS_RECONNECT_MS);
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  try {
    socket = new WebSocket(WS_URL);
  } catch (err) {
    console.error("Failed to create WebSocket.", err);
    scheduleReconnect();
    return;
  }

  socket.addEventListener("open", () => {
    console.log("WebSocket connected.");
  });

  socket.addEventListener("message", async (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (err) {
      console.error("Invalid WebSocket message JSON.", err);
      return;
    }

    if (message?.type === "capture") {
      const payload = await captureActiveTab();
      if (!payload) {
        socket.send(JSON.stringify({ type: "capture_result", ok: false }));
        return;
      }
      socket.send(JSON.stringify({ type: "capture_result", ok: true, payload }));
    }
  });

  socket.addEventListener("close", () => {
    console.warn("WebSocket disconnected.");
    scheduleReconnect();
  });

  socket.addEventListener("error", (err) => {
    console.error("WebSocket error.", err);
  });
}

chrome.action.onClicked.addListener((tab) => {
  void sendActiveTab(tab);
});

chrome.runtime.onStartup.addListener(() => {
  connectWebSocket();
});

chrome.runtime.onInstalled.addListener(() => {
  connectWebSocket();
});
