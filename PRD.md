# Product Requirements Document: Class Election Voting System

## 1. Overview
A lightweight web-based voting system for a class election with **multiple positions** — e.g., Class Representative, Sports Coordinator, Cultural Coordinator, Discipline Coordinator, etc. Each position has its own list of candidates. Voters identify themselves with their name and email, cast one vote per position, and results update live for every position as votes come in.

**Owner:** [Your name]
**Status:** Draft
**Last updated:** July 9, 2026

## 2. Problem Statement
The class needs a fast, fair, and transparent way to elect multiple role-holders (not just one representative) without paper ballots or manual tallying. The system must prevent duplicate voting **per position** and let everyone watch results update in real time across all positions.

## 3. Goals
- Support multiple positions/roles in a single election, each with its own candidate list (e.g., Class Rep, Sports Coordinator, Cultural Coordinator).
- Let every eligible student cast exactly one vote **per position**.
- Prevent double voting using name + email, tracked independently for each position.
- Show live, auto-updating results for every position without needing to refresh the page.
- Verify each voter against a pre-loaded roster (name + email list) before allowing them to vote — no unrecognized voters.
- Provide a single QR code that any student can scan to land directly on the voting entry page.
- Let the admin see live results privately at all times, while the public only sees results after the admin explicitly publishes them.
- Keep the admin section fully separated from the student side — no student action (URL guessing, form manipulation, etc.) should be able to reach admin controls or admin-only data.
- Use MongoDB Atlas (cloud) so results are accessible without relying on one person's laptop as the database.

### Positions (v1)
The system supports **any number of positions** — not capped at 4. Positions are defined in admin config, so adding a 5th, 6th, etc. is just adding another entry, no code change needed.

Currently planned (add more as needed):
1. Class Representative
2. Sports Coordinator
3. Cultural Coordinator
4. Discipline Coordinator
5. *(add more here — e.g., Events Coordinator, Discipline Coordinator, Library Coordinator, etc.)*

Each position has its own independent candidate list and its own vote tally. The voting page and results dashboard both scale automatically to however many positions are configured.

### Non-Goals (Out of Scope for v1)
- Anonymous/secret ballots (name + email are stored against each vote).
- Ranked-choice or weighted voting — single choice per position only.
- Mobile app — web only.
- Formal identity verification (e.g., school SSO login) — self-reported name/email only.
- Letting voters skip a position and come back later — in v1, a voter submits votes for all positions in one form submission (partial/staggered voting across sessions is a stretch goal, not v1).

## 4. Users
| Role | Description |
|---|---|
| Voter | A student who visits the voting page, enters name + email, and picks one candidate. |
| Admin (you) | Sets up candidates, opens/closes voting, and monitors the live results dashboard. |

## 5. User Stories
- As a voter, I want to scan one QR code and land straight on the entry page, without typing a URL.
- As a voter, I want the system to confirm I'm an eligible voter before letting me vote.
- As a voter, I want to see all positions and their candidates on one page, so I can vote for each role in one sitting.
- As a voter, I want to pick one candidate per position.
- As a voter, I want to be blocked from voting twice (per position) with the same email, so the election stays fair.
- As a voter, I want confirmation that my votes were recorded for all positions.
- As an admin, I want to upload the list of eligible voters (name + email) so only real classmates can vote.
- As an admin, I want to see live vote counts for every position at once, so I can monitor the whole election as it happens.
- As an admin, I want to define positions (e.g., Class Rep, Sports Coordinator) and each one's candidate list before voting opens.
- As an admin, I want to close voting at a set time so no more votes are accepted, across all positions.
- As an admin, I want a login so that only I (not students) can reach admin controls or see private results.

## 6. Functional Requirements

### 6.5 Voter Roster & Verification
- Admin pre-loads a roster of eligible voters: a list of `{ name, email }` pairs (e.g., uploaded as CSV, or entered via a simple admin form).
- When a student enters their name + email on the entry page, the backend checks it against the roster:
  - **Match found** → proceed to the voting form.
  - **No match** → show a clear error ("You're not on the eligible voters list — contact the admin") and block access to voting.
- This roster check happens *before* the duplicate-vote check. Two independent gates:
  1. Are you eligible? (roster match)
  2. Have you already voted? (votes collection)
- Roster is separate from the `votes`/`voters` collections used for duplicate-vote tracking, so "who's allowed to vote" and "who has voted" stay cleanly separated.

### 6.6 QR Code Entry
- A single, static QR code is generated once (not per-student) that encodes the URL of the voting **entry page** (the name + email verification screen).
- Admin displays/prints this one QR code for the whole class — any student scans it on their own phone and lands on the entry page to begin voting.
- No per-student unique QR codes in v1 (that would add significant complexity); the roster check (6.5) is what provides the actual access control, not the QR code itself — the QR is just a convenient shortcut to the URL.

### 6.7 Voting Page
- Display all **positions** (e.g., Class Representative, Sports Coordinator, Cultural Coordinator), each with its own candidate list, on a single form.
- Each candidate is shown as a card with: **photo**, **name**, and the **position/role** they're running for (grouped under that position's section).
- Form fields: Name (required, entered once), Email (required, validated format, entered once), then one candidate selection (required, single choice) per position — selection is made by clicking/tapping the candidate's card (photo + name + role).
- Voter must select a candidate for every position before submitting (no partial submission in v1).
- On submit: send all selections to backend in one request.
- Show clear success message ("Your votes have been recorded") or error message ("This email has already voted") — if the email has already voted for *any* position, treat the whole submission as already-voted (prevents re-submitting to "fill gaps").
- Voting page should be disabled/read-only once admin closes voting, showing a "Voting is closed" message.

### 6.8 Duplicate Vote Prevention
- Email is the uniqueness key (case-insensitive, trimmed), enforced **per position** at the database level.
- Since v1 submits all positions together, one unique-email check per submission is sufficient — but the underlying schema keeps votes separate per position so future partial/staggered voting is possible without a redesign.
- Backend rejects a duplicate submission with a clear error — does not silently overwrite.
- (Optional stretch) Basic email format validation only — no email verification link in v1, since that adds complexity/cost.

### 6.9 Results Visibility (Admin Dashboard vs Public Results)
- **Admin dashboard:** Always shows live results for every position, in real time, as soon as votes come in — visible only to the admin (e.g., behind a simple admin password/token).
- **Public results page:** Hidden by default. Shows nothing (or a "Results not yet published" message) until the admin explicitly publishes them.
- Admin has a **"Publish Results"** action (a toggle/button). Once triggered:
  - The public results page becomes viewable to everyone, showing live counts per position from that point forward (or a frozen final tally, depending on whether voting is still open — see below).
  - This is independent of "close voting" — admin can close voting first, review results privately, then publish when ready. Or publish while voting is still open, if they want the class to watch live (their choice).
- Un-publishing (hiding results again after publishing) is not needed for v1 — publish is a one-way action.

### 6.10 Results Page Content (Public, once Published)
- Shows **every position** as its own section, listing each candidate (with their photo and name) and their current vote count within that position.
- Updates in real time (via WebSocket/Socket.io) as new votes arrive — no manual refresh needed.
- Shows total votes cast per position (and overall number of students who have voted).
- (Optional stretch) Simple bar chart per position instead of just numbers.

### 6.11 Admin Controls
- Define positions and add/remove/edit each position's candidate list before voting starts. Includes uploading candidate photos directly.
- Upload/edit the eligible-voters roster (add manually or upload via CSV), and remove individual voters.
- Open/close voting manually (a single toggle) OR set scheduled start and close times that take precedence over the manual toggle.
- Publish/hold-back public results (see 6.9).
- View a detailed audit log of every vote cast.
- Reset the election (ability to delete individual votes, clear all casted votes, or wipe the entire election session including configuration).

## 7. Non-Functional Requirements
- **Scale:** Designed for a single classroom (dozens to low hundreds of voters) — no need for high-scale infrastructure.
- **Data storage:** MongoDB (local install, or a free-tier MongoDB Atlas cluster if you want it accessible without keeping your laptop running as the DB).
- **Security/Integrity:**
  - One vote per email, enforced at the database level (unique index), not just in the UI.
  - Basic input validation/sanitization on all form fields to prevent injection.
  - **Admin/student separation is enforced on the backend, not just hidden in the UI:**
    - Every `/api/admin/*` route (roster upload, position/candidate management, close voting, publish results, admin results view) requires authentication — a login (username/password) issuing a session token or JWT.
    - Admin routes check that token/session on every request; a student who guesses or navigates to an admin URL gets rejected (401/403) with no data returned — there is no "admin page that just isn't linked," the page itself refuses to load data without valid credentials.
    - Student-facing routes (`/api/vote`, `/api/verify`, `/api/positions`, `/api/results`) never expose admin actions (no way to close voting, publish results, or edit candidates through them).
    - Admin credentials are not hardcoded in frontend code — stored server-side only (env var or hashed in DB), never sent to the browser.
    - Session/token expires after a reasonable period of inactivity, and admin can log out.
  - Roster and vote data are validated server-side even though the frontend also validates — never trust client-side checks alone.
- **Availability:** Should run reliably for the duration of the election (a few hours to a day).
- **Auditability:** Every vote is timestamped and retrievable (name, email, candidate, position, time) in case of dispute.
- **UI feel:** Entrance/transition animations should be smooth but not slow down voting — keep them under ~400ms so the form stays fast to use.

## 8. Tech Stack
- **Backend:** Node.js + Express (with Helmet, Rate Limiting, Mongo Sanitize)
- **Database:** MongoDB (via Mongoose)
- **Real-time updates:** Socket.io (WebSockets)
- **Frontend:** React 19 (via Vite) + React Router + Tailwind CSS for styling + **Framer Motion** for animations (candidate cards entrance, animated vote-count ticking).

## 8a. Visual Design
A professional, cohesive look using a fixed color palette (not just default browser styling):

| Name | Hex | Suggested Use |
|---|---|---|
| Prussian Blue | `#0b132b` | Page background / darkest tone |
| Space Indigo | `#1c2541` | Card backgrounds, header/nav |
| Dusk Blue | `#3a506b` | Secondary elements, borders, inactive states |
| Tropical Teal | `#5bc0be` | Primary accent — buttons, selected-candidate highlight, live-result bars, links |
| White | `#ffffff` | Primary text on dark backgrounds, card text |

Design principles:
- Dark, professional theme (Prussian Blue background) with Teal as the single accent color used consistently for anything interactive or "alive" (submit button, selected candidate card, live vote bars, the publish toggle) — avoids a cluttered, rainbow look.
- Candidate cards (6.7) use Space Indigo/Dusk Blue backgrounds with white text and photo, and highlight in Tropical Teal when selected.
- Results dashboard (6.10) uses the same palette so the public page feels like one consistent product, not a bolted-on afterthought — bars/charts in Tropical Teal against the dark background for strong contrast and readability.
- Consistent spacing, rounded corners, and subtle shadows (not flat/default HTML forms) to read as "built," not "prototype."

## 9. Data Model (MongoDB collections)
**positions**
```
{ _id, name: "Sports Coordinator" }
```

**candidates**
```
{ _id, positionId, name, photoUrl }
```
Candidate's "role" is simply the position they belong to (via `positionId`) — no separate field needed, since a candidate only runs for one position in v1.

**electionSettings** (single document holding global state)
```
{ _id, votingOpen: boolean, resultsPublished: boolean, scheduledStartTime: Date, scheduledCloseTime: Date }
```

**eligibleVoters** (the roster — admin-loaded, checked before allowing entry to voting)
```
{ _id, name, email (unique index) }
```

**voters** (records who has actually voted, for duplicate prevention)
```
{ _id, name, email (unique index) }
```

**votes**
```
{ _id, voterId, positionId, candidateId, votedAt }
```
Compound unique index on `(voterId, positionId)` — one vote per voter per position.

## 10. API Surface (high level)
| Endpoint | Method | Purpose |
|---|---|---|
| `/api/verify` | POST | Check `{ name, email }` against the roster before allowing entry to the voting form |
| `/api/positions` | GET | List all positions with their candidates, for the voting form |
| `/api/vote` | POST | Submit all votes in one go: `{ name, email, selections: [{ positionId, candidateId }, ...] }` |
| `/api/results` | GET | Get current vote counts, grouped by position — **only returns data if results are published** |
| `/api/admin/results` | GET | Get current vote counts, grouped by position — always live, admin-only |
| `/api/status` | GET | Whether voting is currently open, and whether results are published |
| (admin) `/api/admin/login` | POST | Admin login |
| (admin) `/api/admin/logout` | POST | Admin logout |
| (admin) `/api/admin/settings` | POST | Manage votingOpen, resultsPublished |
| (admin) `/api/admin/roster` | GET/POST | List roster / Add to roster |
| (admin) `/api/admin/roster/:id` | DELETE | Remove voter from roster |
| (admin) `/api/admin/upload-roster` | POST | Upload CSV roster |
| (admin) `/api/admin/positions` | POST | Add a position |
| (admin) `/api/admin/positions/:id` | DELETE | Delete a position |
| (admin) `/api/admin/candidates` | POST | Add a candidate |
| (admin) `/api/admin/candidates/:id`| DELETE | Delete a candidate |
| (admin) `/api/admin/upload-photo` | POST | Upload candidate photo |
| (admin) `/api/admin/votes-log` | GET | View detailed vote logs |
| (admin) `/api/admin/votes/:id` | DELETE | Delete an individual vote |
| (admin) `/api/admin/votes` | DELETE | Clear all votes |
| (admin) `/api/admin/election` | DELETE | Wipe entire election session |

Real-time: server emits a `results-updated` event over Socket.io whenever a new submission is recorded, so the results page updates instantly for all positions.

## 11. User Flow
1. Admin defines positions and their candidate lists, uploads the eligible-voters roster, opens voting.
2. Admin displays/prints the single QR code for the class.
3. Student scans the QR code on their phone → lands on the entry page.
4. Student enters name + email → backend checks against the roster.
   - Not on roster → error, access blocked.
   - On roster → proceed to the voting form.
5. Student sees all positions, each with its candidates → selects one candidate per position → submits.
6. Backend checks the email hasn't voted before → records one vote per position in a single transaction → broadcasts updated results for all positions.
7. Student sees confirmation that all their votes were recorded.
8. Admin can watch live results privately on the admin dashboard throughout voting.
9. When ready, admin clicks "Publish Results" — the public results page goes live for everyone, showing every position's counts (updating live if voting is still open, or as a final tally if closed).
10. Admin closes voting at the agreed time (independently of publishing, in whichever order they prefer); voting page shows "closed."

## 12. Success Metrics
- 100% of submitted votes are uniquely attributable to one email (no duplicates in the DB).
- Results page reflects a new vote within ~1 second of submission.
- Zero data loss (all votes present in the database after the election closes).

## 13. Risks / Open Questions
- **Admin credential handling:** Since this is a class project, keep the admin password out of any public repo/config that students might see (e.g., if you ever publish the code, `.env` files with secrets must be excluded via `.gitignore`). If the code itself gets shared with classmates for any reason, the login credential must not be visible in it.
- **Roster maintenance:** Admin must keep the eligible-voters roster accurate (correct names/emails) before voting opens — a typo in the roster means a real student can't get past verification. Worth double-checking the roster import before go-live.
- **Shared QR code risk:** Since one QR code is shared by the whole class, the actual access control comes from the roster check (6.5), not the QR code — anyone could photograph/share the QR link, but they'd still be blocked at entry unless they're on the roster.
- **Hosting:** MongoDB Atlas (cloud) will be used as the database, connected via a connection string stored in an environment variable (`.env`, not committed to source control). Node/Express app can run locally or be deployed to any Node host that can reach Atlas.

## 14. Milestones (suggested)
1. Backend + DB schema + vote/dup-check logic
2. Voting page (frontend)
3. Live results page + Socket.io wiring
4. Basic admin controls (candidate config, open/close toggle)
5. Testing with a handful of test votes
6. Deploy / run for the actual election
