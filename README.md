# VFind Social — Prototype

This repository contains a minimal prototype for the VFind Social concept: a marketplace/community app to find physical products in local shops with an AI agent fallback.

Architecture
- Backend: Express + SQLite (server)
- Frontend: static single-page app (public)

Quick start (Windows)

1. Install dependencies

```bash
cd c:\GitHub\VfindApp
npm install
```

2. Start server

```bash
npm start
```

3. Open http://localhost:3000

What is included
- `server/index.js`: Express server, API endpoints `/api/search`, `/api/shops`, `/api/reserve`, `/api/ai-agent` (mock)
- `server/db.js`: SQLite initialization and seed data
- `public/index.html`, `public/app.js`: simple SPA to search and reserve

Next steps / integrations
- Replace AI agent mock (`/api/ai-agent`) with real Twilio/WhatsApp + OpenAI Realtime or Vapi/Retell
- Integrate Mapbox Search API for geosearch and distance
- Add OAuth / phone verification for merchants and customers
- Add GDPR consent flow with Iubenda/OneTrust APIs

If you want, I can:
- Add Mapbox integration and frontend map view
- Implement a Telegram bot for merchants (pilot)
- Wire an OpenAI/Twilio demo for the AI agent
# VfindApp