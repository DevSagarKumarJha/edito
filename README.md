# Collaborative Code Editor (Monorepo)

## Quick start

```bash
npm install
npm run dev::server
```

- Client: Vite dev server (see `client/package.json`)
- Server: Express + Socket.IO (default `http://localhost:9000`)

## Collaboration

- Click a file in the left tree to open it in Monaco.
- Editors on the same file sync in real time via Yjs over Socket.IO.
- Server auto-saves changes to disk (debounced) and you can also use the **Save** button.

## Configuration

- `VITE_SERVER_URL` (client) defaults to `http://localhost:9000`
- `PORT`, `CORS_ORIGIN`, `USER_DIR` (server) are read in `server/src/config.js`

