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

Responses:
```json
{ "type": "capture_result", "ok": true, "payload": { ... } }
```

```json
{ "type": "tabs_result", "ok": true, "tabs": [ ... ] }
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

## Troubleshooting
- `chrome://` and extension pages cannot be captured.
- If capture fails, check the service worker console in `chrome://extensions`.
- If WebSocket capture stops, reload the extension to reconnect.

## License
MIT. See `LICENSE`.
