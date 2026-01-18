const INGEST_URL = "http://localhost:4587/ingest";
const WS_URL = "ws://localhost:4587/ws";
const INCLUDE_HTML = false;
const MAX_TEXT_CHARS = 200000;
const MAX_LINKS = 5000;
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

function extractLinks(maxLinks) {
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  const links = [];

  for (const anchor of anchors) {
    if (typeof maxLinks === "number" && maxLinks > 0 && links.length >= maxLinks) {
      break;
    }

    const href = anchor.href || "";
    if (!/^https?:\/\//i.test(href)) {
      continue;
    }

    const rawText = anchor.innerText || anchor.textContent || "";
    const text = rawText.trim();
    links.push({
      index: links.length,
      href,
      text,
    });
  }

  return links;
}

function clickLinkByIndex(linkIndex) {
  const anchors = Array.from(document.querySelectorAll("a[href]")).filter((anchor) =>
    /^https?:\/\//i.test(anchor.href || "")
  );

  if (typeof linkIndex !== "number" || linkIndex < 0 || linkIndex >= anchors.length) {
    return { ok: false, error: "Invalid link index." };
  }

  const target = anchors[linkIndex];
  const href = target.href || "";
  target.click();

  return {
    ok: true,
    href,
    index: linkIndex,
  };
}

function scrollLinkByIndex(linkIndex) {
  const anchors = Array.from(document.querySelectorAll("a[href]")).filter((anchor) =>
    /^https?:\/\//i.test(anchor.href || "")
  );

  if (typeof linkIndex !== "number" || linkIndex < 0 || linkIndex >= anchors.length) {
    return { ok: false, error: "Invalid link index." };
  }

  const target = anchors[linkIndex];
  const href = target.href || "";
  target.scrollIntoView({ behavior: "smooth", block: "center" });

  return {
    ok: true,
    href,
    index: linkIndex,
  };
}

async function buildPayloadFromTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab found.");
  }

  const tabUrl = tab.url || "";
  if (!/^https?:\/\//i.test(tabUrl)) {
    throw new Error("Unsupported tab URL; only http/https pages can be captured.");
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
    throw new Error("Failed to capture page content.");
  }

  if (!page) {
    throw new Error("No page content captured.");
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

async function captureTabById(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return buildPayloadFromTab(tab);
}

async function listLinksForTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab found.");
  }

  const tabUrl = tab.url || "";
  if (!/^https?:\/\//i.test(tabUrl)) {
    throw new Error("Unsupported tab URL; only http/https pages can be captured.");
  }

  let links;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractLinks,
      args: [MAX_LINKS],
    });
    links = results && results[0] ? results[0].result : null;
  } catch (err) {
    throw new Error("Failed to extract links.");
  }

  if (!Array.isArray(links)) {
    throw new Error("No links captured.");
  }

  return links;
}

async function listLinksFromActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return listLinksForTab(tab);
}

async function listLinksFromTabId(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return listLinksForTab(tab);
}

async function clickLinkInTab(tab, linkIndex) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab found.");
  }

  const tabUrl = tab.url || "";
  if (!/^https?:\/\//i.test(tabUrl)) {
    throw new Error("Unsupported tab URL; only http/https pages can be captured.");
  }

  let result;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: clickLinkByIndex,
      args: [linkIndex],
    });
    result = results && results[0] ? results[0].result : null;
  } catch (err) {
    throw new Error("Failed to click link.");
  }

  if (!result || result.ok !== true) {
    throw new Error(result?.error || "Click failed.");
  }

  return result;
}

async function clickLinkInActiveTab(linkIndex) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return clickLinkInTab(tab, linkIndex);
}

async function clickLinkInTabId(tabId, linkIndex) {
  const tab = await chrome.tabs.get(tabId);
  return clickLinkInTab(tab, linkIndex);
}

async function scrollLinkInTab(tab, linkIndex) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab found.");
  }

  const tabUrl = tab.url || "";
  if (!/^https?:\/\//i.test(tabUrl)) {
    throw new Error("Unsupported tab URL; only http/https pages can be captured.");
  }

  let result;
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrollLinkByIndex,
      args: [linkIndex],
    });
    result = results && results[0] ? results[0].result : null;
  } catch (err) {
    throw new Error("Failed to scroll to link.");
  }

  if (!result || result.ok !== true) {
    throw new Error(result?.error || "Scroll failed.");
  }

  return result;
}

async function scrollLinkInActiveTab(linkIndex) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return scrollLinkInTab(tab, linkIndex);
}

async function scrollLinkInTabId(tabId, linkIndex) {
  const tab = await chrome.tabs.get(tabId);
  return scrollLinkInTab(tab, linkIndex);
}

async function goBackInTab(tab) {
  if (!tab || typeof tab.id !== "number") {
    throw new Error("No active tab found.");
  }

  const tabUrl = tab.url || "";
  if (!/^https?:\/\//i.test(tabUrl)) {
    throw new Error("Unsupported tab URL; only http/https pages can be captured.");
  }

  try {
    await chrome.tabs.goBack(tab.id);
  } catch (err) {
    throw new Error("Failed to navigate back.");
  }

  return { ok: true };
}

async function goBackInActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return goBackInTab(tab);
}

async function goBackInTabId(tabId) {
  const tab = await chrome.tabs.get(tabId);
  return goBackInTab(tab);
}

async function sendActiveTab(tab) {
  try {
    const payload = await buildPayloadFromTab(tab);
    await postPayload(payload);
  } catch (err) {
    console.error(err instanceof Error ? err.message : "Failed to capture page.");
  }
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

    if (message?.type === "list_tabs") {
      try {
        const tabs = await chrome.tabs.query({});
        const filtered = tabs
          .filter((tab) => tab.url && /^https?:\/\//i.test(tab.url))
          .map((tab) => ({
            id: tab.id,
            title: tab.title || "",
            url: tab.url || "",
            windowId: tab.windowId,
            active: Boolean(tab.active),
          }));
        socket.send(JSON.stringify({ type: "tabs_result", ok: true, tabs: filtered }));
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "tabs_result",
            ok: false,
            error: err instanceof Error ? err.message : "Failed to list tabs.",
          })
        );
      }
      return;
    }

    if (message?.type === "list_links") {
      try {
        const links =
          typeof message.tab_id === "number"
            ? await listLinksFromTabId(message.tab_id)
            : await listLinksFromActiveTab();
        socket.send(JSON.stringify({ type: "links_result", ok: true, links }));
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "links_result",
            ok: false,
            error: err instanceof Error ? err.message : "Failed to list links.",
          })
        );
      }
      return;
    }

    if (message?.type === "click_link") {
      try {
        const linkIndex =
          typeof message.index === "number" ? message.index : Number(message.index);
        if (!Number.isFinite(linkIndex)) {
          throw new Error("Missing link index.");
        }
        const result =
          typeof message.tab_id === "number"
            ? await clickLinkInTabId(message.tab_id, linkIndex)
            : await clickLinkInActiveTab(linkIndex);
        socket.send(JSON.stringify({ type: "click_result", ok: true, result }));
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "click_result",
            ok: false,
            error: err instanceof Error ? err.message : "Click failed.",
          })
        );
      }
      return;
    }

    if (message?.type === "scroll_link") {
      try {
        const linkIndex =
          typeof message.index === "number" ? message.index : Number(message.index);
        if (!Number.isFinite(linkIndex)) {
          throw new Error("Missing link index.");
        }
        const result =
          typeof message.tab_id === "number"
            ? await scrollLinkInTabId(message.tab_id, linkIndex)
            : await scrollLinkInActiveTab(linkIndex);
        socket.send(JSON.stringify({ type: "scroll_result", ok: true, result }));
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "scroll_result",
            ok: false,
            error: err instanceof Error ? err.message : "Scroll failed.",
          })
        );
      }
      return;
    }

    if (message?.type === "go_back") {
      try {
        const result =
          typeof message.tab_id === "number"
            ? await goBackInTabId(message.tab_id)
            : await goBackInActiveTab();
        socket.send(JSON.stringify({ type: "back_result", ok: true, result }));
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "back_result",
            ok: false,
            error: err instanceof Error ? err.message : "Back failed.",
          })
        );
      }
      return;
    }

    if (message?.type === "capture") {
      try {
        const payload =
          typeof message.tab_id === "number"
            ? await captureTabById(message.tab_id)
            : await captureActiveTab();
        socket.send(JSON.stringify({ type: "capture_result", ok: true, payload }));
      } catch (err) {
        socket.send(
          JSON.stringify({
            type: "capture_result",
            ok: false,
            error: err instanceof Error ? err.message : "Capture failed.",
          })
        );
      }
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

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "ws-reconnect") {
    connectWebSocket();
  }
});

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("ws-reconnect", { periodInMinutes: 1 });
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("ws-reconnect", { periodInMinutes: 1 });
});
