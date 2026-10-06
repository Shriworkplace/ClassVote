# ClassVote

ClassVote is a modern, full-stack, multi-position campus election and voting platform built with **Node.js/Express**, **MongoDB**, **Socket.io**, and **React/Vite**.

Designed for class and student council elections, ClassVote allows students to vote across multiple contested offices simultaneously, verifies voter eligibility against an official roster, enforces single-ballot constraints, and streams live result updates in real time.

---

## Key Features

### 🗳️ Multi-Position Ballots
- Supports any number of dynamically configured positions (e.g., *Class Representative*, *Sports Coordinator*, *Cultural Coordinator*, *Discipline Coordinator*).
- Each position contains its own independent candidate slate with portrait photos and manifests.
- Voters cast selections for all offices in a single streamlined submission.

### 🔒 Two-Gate Voter Verification & Integrity
1. **Roster Verification Gate**: Students authenticate using their Full Name along with either their **College Email** OR **Enrollment Number (En no.)** against the eligible roster (uploaded via CSV or JSON). Only enrolled students on the roster can vote, and the typed name is compulsory and strictly verified against the official registered roster name.
2. **Duplicate Prevention Gate**: Compound unique indexing `(voterId, positionId)` plus unique constraints on email and enrollment number ensure strictly one ballot per student across all positions (voting with either email or enrollment number locks out any subsequent attempts).

### ⚡ Real-Time Live Tallies
- Powered by **Socket.io** WebSockets.
- Instant, sub-second tally synchronization across all connected clients whenever a ballot is submitted—no manual page refresh required.
- Interactive animated percentage bars with countdown suspense, winner declarations, and celebratory confetti.

### 🛠️ Dedicated Admin Control Panel
- **Election State Management**: Toggle manual voting windows or set automated schedule timestamps (start/close times).
- **Roster Management**: Upload CSV rosters with Name, Email, and/or Enrollment No, input raw JSON, view verified voters with search, or delete entries.
- **Candidate & Position Management**: Add/remove positions and register candidates with photo uploads or external image URLs.
- **Public Results Visibility**: Keep results private for administrative review or publish live standings to the student body with a single click.
- **Audit Logs & CSV Export**: Timestamped ballot logs with voter identity, enrollment number, position, choice, and one-click CSV export for audit records.
- **Plurality Monitor & Danger Zone**: Live vote monitor per candidate, options to reset cast ballots, or completely wipe the session for a clean election.

### 📱 Frictionless QR Code Distribution
- Admin dashboard displays a single sharable QR code linking straight to the voter authentication portal.
- Display on projectors or print for the classroom; students scan and vote directly from their phones.

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, Vite, React Router 7, Tailwind CSS, Framer Motion, Lucide Icons, React Confetti |
| **Backend** | Node.js, Express, Helmet, Rate Limiting, Mongo Sanitize |
| **Database** | MongoDB (Local or MongoDB Atlas) via Mongoose ODM |
| **Real-Time** | Socket.io (WebSockets) |

---

## System Architecture & Data Model

### MongoDB Collections

- **`positions`**: Defines election offices.
  ```json
  { "_id": "ObjectId", "name": "Sports Coordinator" }
  ```
- **`candidates`**: Candidate records attached to a position.
  ```json
  { "_id": "ObjectId", "positionId": "ObjectId", "name": "Alex Smith", "photoUrl": "/uploads/..." }
  ```
- **`electionSettings`**: Global singleton for election control.
  ```json
  { 
    "_id": "ObjectId", 
    "votingOpen": true, 
    "resultsPublished": false, 
    "scheduledStartTime": "2026-08-25T10:00:00.000Z", 
    "scheduledCloseTime": "2026-08-25T16:00:00.000Z" 
  }
  ```
- **`eligibleVoters`**: Pre-loaded roster for authentication.
  ```json
  { "_id": "ObjectId", "name": "Jane Doe", "email": "jane@school.edu", "enrollmentNo": "21BCS001" }
  ```
- **`voters`**: Registered voters who accessed the ballot.
  ```json
  { "_id": "ObjectId", "name": "Jane Doe", "email": "jane@school.edu", "enrollmentNo": "21BCS001" }
  ```
- **`votes`**: Individual ballot submissions with compound uniqueness on `(voterId, positionId)`.
  ```json
  { "_id": "ObjectId", "voterId": "ObjectId", "positionId": "ObjectId", "candidateId": "ObjectId", "votedAt": "Date" }
  ```

---

## API Reference

### Public / Student Endpoints
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/verify` | `POST` | Check `{ name, email | enrollmentNo }` against the roster with compulsory name matching prior to ballot access |
| `/api/positions` | `GET` | Retrieve active positions with their candidate lists |
| `/api/vote` | `POST` | Submit completed ballot selections `{ name, email | enrollmentNo, selections: [...] }` |
| `/api/results` | `GET` | Get current vote tallies (only returns data if results are published) |
| `/api/status` | `GET` | Check if voting is open and if results are public |

### Protected Admin Endpoints (`/api/admin/*`)
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/admin/login` | `POST` | Authenticate with master secret |
| `/api/admin/logout` | `POST` | Invalidate admin session |
| `/api/admin/settings` | `POST` | Update election state (`votingOpen`, `resultsPublished`, schedules) |
| `/api/admin/results` | `GET` | Real-time live results (always accessible to authenticated admin) |
| `/api/admin/roster` | `GET` / `POST` | List all eligible voters / bulk add voters via JSON |
| `/api/admin/roster/:id` | `DELETE` | Remove a single voter from the roster |
| `/api/admin/upload-roster`| `POST` | Upload and sync roster via CSV file (Name, Email, Enrollment No) |
| `/api/admin/positions` | `POST` | Create a new position |
| `/api/admin/positions/:id`| `DELETE`| Remove a position and its candidates |
| `/api/admin/candidates` | `POST` | Add a candidate to a position |
| `/api/admin/candidates/:id`| `DELETE`| Remove a candidate |
| `/api/admin/upload-photo` | `POST` | Upload candidate photo locally to `/uploads` |
| `/api/admin/votes-log` | `GET` | Retrieve timestamped audit log of all cast ballots |
| `/api/admin/votes/:id` | `DELETE` | Delete an individual vote record |
| `/api/admin/votes` | `DELETE` | Reset all cast ballots (keeps positions/candidates/roster) |
| `/api/admin/election` | `DELETE` | Full reset: purge positions, candidates, and votes |

---

## User Flows

### Student Flow
1. **QR / URL Access**: Student scans the classroom QR code and lands on `/entry`.
2. **Authentication**: Enters Full Name and either their Enrollment Number (En no.) or College Email. The server finds their eligible record and strictly enforces that the typed name matches the official college roster record.
3. **Balloting**: If verified, user proceeds to `/voting`, selecting one candidate for each required position.
4. **Submission**: Ballot is submitted in a single atomic payload. Server verifies duplicate prevention, records the vote, and broadcasts an update via Socket.io.
5. **Confirmation & Results**: Student receives confirmation. Once the admin publishes standings, students can watch live updates on `/results`.

### Admin Workflow
1. **Login**: Access `/admin` using the master password.
2. **Setup**: Add election offices and candidates with photos.
3. **Roster Upload**: Upload class CSV roster with `Name`, `Email`, and `Enrollment No` (or `En No`) headers.
4. **Launch**: Open voting manually or set scheduled start/close windows.
5. **Monitor & Audit**: Watch real-time plurality tallies, audit voter logs with enrollment numbers, and export CSV reports.
6. **Publish Results**: Trigger public visibility when voting concludes.

---

## Project Structure

```
ClassVote/
├── backend/                  # Express API & Socket.io server
│   ├── config/               # Database connection
│   ├── middleware/           # Auth and security middleware
│   ├── models/               # Mongoose schemas (Position, Candidate, Vote, etc.)
│   ├── routes/               # API endpoint handlers (voter & admin)
│   ├── uploads/              # Uploaded candidate images
│   └── server.js             # Express entry point & Socket.io setup
├── frontend/                 # React client built with Vite
│   ├── public/               # Static assets & logos
│   ├── src/
│   │   ├── components/       # Header, Footer, Alert, UI components
│   │   ├── pages/            # LandingPage, EntryPage, VotingPage, ResultsPage, AdminDashboard, PrivacyPolicy
│   │   ├── App.jsx           # Client routes
│   │   ├── index.css         # Typography, glassmorphism, design tokens
│   │   └── main.jsx          # React DOM root
│   ├── tailwind.config.js    # Font pairings, letter-spacing, dark slate palette
│   └── vite.config.js        # Vite config with backend proxy
├── ARCHITECTURE.md           # System architecture and workflow details
├── package.json              # Root dependencies and scripts
└── README.md                 # Complete project documentation & guide
```

---

## Prerequisites

- **Node.js**: v18.0.0 or newer
- **MongoDB**: Local MongoDB community server or a [MongoDB Atlas](https://www.mongodb.com/atlas) cluster URI

---

## Setup & Installation

### 1. Install Dependencies
From the repository root:
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/classvote
JWT_SECRET=your-secure-jwt-secret-key
ADMIN_PASSWORD=your-secure-admin-password
PORT=3000
NODE_ENV=development
```

### 3. Run the Application

**Start the Backend Server (Terminal 1):**
```bash
npm start
```
*Backend runs on `http://localhost:3000`.*

**Start the Frontend Dev Server (Terminal 2):**
```bash
cd frontend
npm run dev
```
*Frontend runs on `http://localhost:5173` with automatic API proxy to port 3000.*

---

## Useful Scripts

| Directory | Command | Description |
|---|---|---|
| Root | `npm start` | Start the Express backend server |
| Root | `npm install` | Install all dependencies |
| `frontend/` | `npm run dev` | Launch Vite frontend development server |
| `frontend/` | `npm run build` | Compile optimized production frontend build |
| `frontend/` | `npm run lint` | Run Oxlint on frontend code |

---

## Security & Non-Functional Highlights

- **Server-Side Authorization**: Every administrative endpoint is protected by session tokens; URL manipulation cannot bypass authentication.
- **Injection & Abuse Prevention**: Uses `helmet`, `express-rate-limit`, and `express-mongo-sanitize`.
- **Database Integrity**: Compound unique indexes prevent duplicate ballot insertions at the database engine level.
- **Auditability**: Every cast ballot includes a server timestamp, voter email, position, and candidate ID for post-election auditing.

---

## Development Team

- **Backend Architecture & Engineering**: [Shrived Dhone](https://shriworkplace.github.io/)
- **Frontend & UI/UX Design**: Siya Giri

&copy; 2026 ClassVote. All rights reserved.
