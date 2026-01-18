# Chrome Page Sender Handoff (Electron App)

This document describes how to use the Chrome extension from an Electron app
that parses pages, scrolls/clicks links, and captures HTML/text.

## Mental Model
- **Extension**: runs in Chrome and performs actions on the active tab.
- **Electron app**: runs a local server (HTTP + WebSocket) that the extension connects to.
- **Connection**: the extension is a client; your app is the server.

The extension does not need to live in the same repo as your app. It only needs
to be loaded once in Chrome via "Load unpacked."

## Load the Extension
1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click "Load unpacked" and select the extension folder.

## Configure Endpoints
Edit the constants at the top of `background.js`:

```js
const INGEST_URL = "http://localhost:4587/ingest";
const WS_URL = "ws://localhost:4587/ws";
const INCLUDE_HTML = false;
const MAX_TEXT_CHARS = 200000;
const MAX_LINKS = 5000;
```

Set `INCLUDE_HTML = true` if you want full page HTML in capture payloads.

## What Your Electron App Should Provide
Run a local server that:
- Accepts `POST /ingest` for "click-to-send" capture payloads.
- Hosts a WebSocket at `/ws` to send commands to the extension.

See `tester/server.mjs` for a reference implementation.

## WebSocket Protocol (from app to extension)
Requests:
- `{ "type": "capture" }`
- `{ "type": "list_tabs" }`
- `{ "type": "list_links" }`
- `{ "type": "scroll_link", "index": 0 }`
- `{ "type": "click_link", "index": 0 }`
- `{ "type": "go_back" }`

Responses:
- `{ "type": "capture_result", "ok": true, "payload": { ... } }`
- `{ "type": "tabs_result", "ok": true, "tabs": [ ... ] }`
- `{ "type": "links_result", "ok": true, "links": [ ... ] }`
- `{ "type": "scroll_result", "ok": true, "result": { ... } }`
- `{ "type": "click_result", "ok": true, "result": { ... } }`
- `{ "type": "back_result", "ok": true, "result": { ... } }`

### Link Indexes
`list_links` returns a list of links with `index`, `href`, and `text`. Use that
`index` in `scroll_link` or `click_link`.

## Suggested Flow in the Electron App
1. Start your HTTP + WS server.
2. Ensure the extension is loaded in Chrome.
3. Wait for the extension to connect to `/ws`.
4. Send `list_links` or `capture` as needed.
5. Use `scroll_link` to bring a link into view.
6. Use `click_link` to navigate.
7. Use `go_back` to return.

## Notes
- Only `http/https` pages can be captured or interacted with.
- Very large pages can be truncated by `MAX_TEXT_CHARS`.
- If WebSocket commands stop working, reload the extension.

