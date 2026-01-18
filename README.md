# Chrome Page Sender

A minimal Chrome extension (Manifest V3) that captures the active tab's content and sends it to a local HTTP endpoint or a WebSocket client.

## Features
- Captures `title`, `url`, and `text` (optional `html`).
- Click-to-send via HTTP `POST /ingest`.
- WebSocket bridge for on-demand capture from an Electron app.

## Install (unpacked)
1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Click "Load unpacked" and select this repo folder.
4. Pin the extension so the icon is visible in the toolbar.

## Configuration
Edit the constants at the top of `background.js`:

```js
const INGEST_URL = "http://localhost:4587/ingest";
const WS_URL = "ws://localhost:4587/ws";
const INCLUDE_HTML = false;
const MAX_TEXT_CHARS = 200000;
const MAX_LINKS = 5000;
```

Notes:
- `INCLUDE_HTML` adds `document.documentElement.outerHTML` to the payload.
- `MAX_TEXT_CHARS` truncates long pages to avoid oversized payloads.

## Usage
### Click-to-send (HTTP)
1. Navigate to any http/https page.
2. Click the extension icon.
3. The extension sends a JSON payload to `INGEST_URL`.

### WebSocket capture (Electron or local app)
Run a WebSocket server that the extension can connect to. The extension listens
for `capture` and responds with `capture_result`. It also supports `list_tabs`
to enumerate open http/https tabs.

WebSocket requests:
```json
{ "type": "capture" }
```

```json
{ "type": "capture", "tab_id": 123 }
```

```json
{ "type": "list_tabs" }
```

```json
{ "type": "list_links" }
```

```json
{ "type": "list_links", "tab_id": 123 }
```

```json
{ "type": "click_link", "index": 0 }
```

```json
{ "type": "click_link", "tab_id": 123, "index": 0 }
```

```json
{ "type": "scroll_link", "index": 0 }
```

```json
{ "type": "scroll_link", "tab_id": 123, "index": 0 }
```

```json
{ "type": "go_back" }
```

```json
{ "type": "go_back", "tab_id": 123 }
```

Responses:
```json
{ "type": "capture_result", "ok": true, "payload": { ... } }
```

```json
{ "type": "tabs_result", "ok": true, "tabs": [ ... ] }
```

```json
{ "type": "links_result", "ok": true, "links": [ ... ] }
```

```json
{ "type": "click_result", "ok": true, "result": { ... } }
```

```json
{ "type": "scroll_result", "ok": true, "result": { ... } }
```

```json
{ "type": "back_result", "ok": true, "result": { ... } }
```

## Server expectations
### HTTP ingest
Run a local server that accepts `POST /ingest` with JSON and returns `200 OK`.

Example payload:
```json
{
  "captured_at": "2024-01-01T12:00:00.000Z",
  "source": "chrome-page-sender",
  "page": {
    "title": "Example",
    "url": "https://example.com",
    "text": "..."
  }
}
```

### WebSocket bridge
The extension connects to `WS_URL` and expects a JSON message protocol:
- Request: `{ "type": "capture" }` or `{ "type": "capture", "tab_id": 123 }`
- Response: `{ "type": "capture_result", "ok": true, "payload": { ... } }`
- Request: `{ "type": "list_tabs" }`
- Response: `{ "type": "tabs_result", "ok": true, "tabs": [ ... ] }`
- Request: `{ "type": "list_links" }`
- Response: `{ "type": "links_result", "ok": true, "links": [ ... ] }`
- Request: `{ "type": "scroll_link", "index": 0 }`
- Response: `{ "type": "scroll_result", "ok": true, "result": { ... } }`
- Request: `{ "type": "click_link", "index": 0 }`
- Response: `{ "type": "click_result", "ok": true, "result": { ... } }`
- Request: `{ "type": "go_back" }`
- Response: `{ "type": "back_result", "ok": true, "result": { ... } }`

## Troubleshooting
- `chrome://` and extension pages cannot be captured.
- If capture fails, check the service worker console in `chrome://extensions`.
- If WebSocket capture stops, reload the extension to reconnect.

## WS testers
The repo includes simple WebSocket test servers that work with the extension's
`WS_URL` (default `ws://localhost:4587/ws`).

1. Install dependencies:

```sh
npm install
```

2. Run a tester (these start their own WS server):

```sh
npm run test:list-links
```

```sh
npm run test:click-first
```

If you already have a WS server running (for example `tester/server.mjs`),
use the client scripts instead:

```sh
npm run test:list-links-client
```

```sh
npm run test:click-first-client
```

## Tester server (HTTP + WS)
The `tester` folder includes a combined HTTP + WebSocket server and simple
client commands for manual testing.

### Terminal 1 (server)
```sh
cd /Users/zubinjha/Documents/Projects/job-helper/chrome-page-sender/tester
npm start
```

Reload the extension in `chrome://extensions` and wait for:
`WebSocket client connected.`

### Terminal 2 (clients)
```sh
cd /Users/zubinjha/Documents/Projects/job-helper/chrome-page-sender/tester
npm run request
```

```sh
npm run links
```

```sh
npm run scroll -- 0
```

```sh
npm run click -- 0
```

Notes:
- The number (e.g. `0`) is the link index from `npm run links`.
- Use any index printed by `links` to scroll or click that specific link.

## License
MIT. See `LICENSE`.
