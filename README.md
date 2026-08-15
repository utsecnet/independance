# independance

An interactive dependency map for tasks, projects, and POA&Ms (Plans of Action & Milestones). Build a map of interconnected work by creating nodes and linking them — including by dragging directly between nodes on the canvas — and watch the graph update live as you edit.

## Stack

- **Client:** React + Vite + TypeScript, [React Flow](https://reactflow.dev/) for the graph canvas, Zustand for state.
- **Server:** Express + TypeScript, persisted to a local SQLite database via Node's built-in [`node:sqlite`](https://nodejs.org/api/sqlite.html) (`DatabaseSync`).
- **Shared:** a `shared` workspace package holding TypeScript types and Zod validation schemas used by both client and server.

npm workspaces tie `client`, `server`, and `shared` together from the root `package.json`.

## Prerequisites

- Node.js 22+ (this project uses `node:sqlite`, so an older Node will not work).

## Setup

```
npm install
```

## Running

```
npm run dev
```

This runs the client (Vite dev server) and server (Express, via `tsx watch`) together via `concurrently`:

- Client: http://localhost:5173
- Server: http://localhost:5175 (the client's dev server proxies `/api` requests here)

The server creates its SQLite database at `server/data/independance.db` on first run (gitignored — local data only).

To run just one side: `npm run dev:client` or `npm run dev:server`.

## Building

```
npm run build
```

## Project layout

```
client/   React app — src/components/layout/{TopBar,LeftSubMenu,LeftPane,RightPane}
server/   Express API — src/app.ts (app factory), src/index.ts (entrypoint),
          src/db/migrations/*.sql, src/routes/, src/db/queries/
shared/   src/types.ts, src/schemas.ts — shared between client and server
```

## Tests

This repository intentionally contains **no test files** — automated tests, regression scripts, and dev tooling live in a separate working directory (`_working/independance`, alongside this repo) that imports directly from here. See that directory's `vitest.config.ts` for how cross-directory module resolution is set up.

## API

REST API under `/api`:

- `GET /api/graph` — combined `{ nodes, edges }` for the initial load
- `GET/POST/PATCH/DELETE /api/nodes[/:id]`, plus `PATCH /api/nodes/:id/position`
- `GET/POST/PATCH/DELETE /api/edges[/:id]`
- `GET /api/health`
