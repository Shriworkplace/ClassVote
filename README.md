# ClassVote

ClassVote is a multi-position class election app with a Node/Express backend, MongoDB persistence, Socket.io live updates, and a React/Vite frontend.

## What it does

- Verifies voters against an eligible roster before ballot access
- Supports multiple positions with separate candidate lists
- Records one vote per position per voter
- Streams live results to connected clients
- Keeps admin controls separate from student-facing pages

## Project Structure

- [backend](backend): Express API, Socket.io, and Mongoose models
- [frontend](frontend): React app, pages, and UI styling
- [ARCHITECTURE.md](ARCHITECTURE.md): system map, workflow, and data model notes
- [PRD.md](PRD.md): product requirements and intended behavior

## Requirements

- Node.js 18 or newer
- MongoDB running locally or a MongoDB Atlas connection string

## Setup

1. Install dependencies from the repo root:

```bash
npm install
```

2. Create a `.env` file in the root with at least:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/classvote
JWT_SECRET=your-secret-key
ADMIN_PASSWORD=your-admin-password
PORT=3000
NODE_ENV=development
```

3. Start the backend:

```bash
npm start
```

4. Start the frontend in a second terminal:

```bash
cd frontend
npm run dev
```

## Useful Scripts

### Root

- `npm start`: run the Express backend

### Frontend

- `npm run dev`: start the Vite dev server
- `npm run build`: create a production frontend build
- `npm run lint`: run Oxlint

## How It Works

1. A student opens the entry page and submits name plus email.
2. The backend checks the email against the eligible voter roster.
3. If allowed, the student sees all positions and candidates.
4. The ballot is submitted in one request.
5. The backend stores the vote and broadcasts a Socket.io update.
6. Results pages refresh automatically when new votes arrive.

## Admin Flow

- Admin logs in through the dashboard
- Admin manages the roster, positions, candidates, and election status
- Admin can publish results when they are ready for public viewing

## Notes

- The root `.gitignore` excludes environment files, dependency folders, and build output.
- The old seed script was removed because it was not needed for normal startup.
- The frontend still has its own README in [frontend/README.md](frontend/README.md), but this is the main repo-level guide.
