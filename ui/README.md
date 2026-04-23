# rcopt-ui

## Purpose
React + Vite + TypeScript + Tailwind frontend for the rc-rt-optimize
retaining wall design tool. Consumes `api/` endpoints via Vite dev proxy.

## Prerequisites
Before running the dev server, start the backend API in a separate terminal:

    cd ../api
    npm start

(api/ listens on http://localhost:3000)

## How to run (dev)

    npm install
    npm run dev

Vite serves on http://localhost:5173 and proxies `/api/*` to `:3000`.

## How to build

    npm run build

Outputs to `dist/`.

## Folder structure

    src/
      components/   -- React components (Day 2+)
      lib/          -- API client, utilities (Day 2+)
      types/        -- Shared TypeScript types (Day 2+)
