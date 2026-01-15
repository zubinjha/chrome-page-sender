# Chrome Page Sender

A minimal Chrome extension (Manifest V3) that captures the active tab's content and sends it to a local HTTP endpoint.

## What it captures
- `title` (`document.title`)
- `url` (`location.href`)
- `text` (`document.body.innerText`)
- Optional: `html` (`document.documentElement.outerHTML`)

## Configuration
Update the ingest URL at the top of `background.js`:

```js
const INGEST_URL = "http://localhost:4587/ingest";
```

Optional flags in `background.js`:
- `INCLUDE_HTML`: include full HTML in the payload
- `MAX_TEXT_CHARS`: truncate long pages (default: 200k)

## Electron integration (WebSocket bridge)
If you want your Electron app to request a capture on demand, run a local WebSocket
server and let the extension connect to it. The extension listens for a JSON
message `{ "type": "capture" }` and replies with `{ "type": "capture_result", "ok": true, "payload": { ... } }`.

The WebSocket URL is configurable at the top of `background.js`:

```js
const WS_URL = "ws://localhost:4587/ws";
```

Your Electron app should:
1. Start a WebSocket server on the same URL.
2. Wait for the extension to connect.
3. Send `{ "type": "capture" }` when you want the current page data.
4. Read `capture_result.payload` and use it in your app.

Note: the extension still supports click-to-send via HTTP POST to `INGEST_URL`.

## Install (unpacked)
1. Open `chrome://extensions` in Chrome.
2. Enable Developer mode.
3. Click "Load unpacked" and select this repo folder.

## Icon
The extension icon assets are in `icons/` (SVG source plus 16/48/128 PNGs).

## Usage
1. Navigate to any http/https page.
2. Click the extension icon.
3. Check the console for success or error logs.

## Local testing
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

## Notes
- `chrome://` and extension pages cannot be captured.
- If capture fails, check the service worker console in `chrome://extensions`.
