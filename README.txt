NKAIVault - Ready-to-deploy

Folders:
- frontend: React + Vite app (Tailwind ready)
- backend: Node/Express server with ffmpeg to convert WebM -> MP4

Quick start (local):

1) Frontend
   cd frontend
   npm install
   npm run dev
   # open http://localhost:5173

2) Backend (local)
   cd backend
   npm install
   # ensure ffmpeg is installed (on Debian/Ubuntu: sudo apt-get install ffmpeg)
   node index.js
   # server runs on http://localhost:3000

Deploy:
- Push both folders to GitHub.
- Deploy frontend on Vercel (connect repo).
- Deploy backend on Render/Heroku/Render using Dockerfile (or plain node if ffmpeg installed).

Security: Protect /api/convert with auth token in production.
