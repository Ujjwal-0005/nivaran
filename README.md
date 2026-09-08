# Nivaran — Crowdsourced Civic Issue Reporting & Resolution Platform

> A MERN stack platform that lets citizens report local civic issues (potholes, garbage, streetlights, water leaks, etc.) with photo + location, automatically detects duplicate reports, prioritizes them intelligently, and gives municipal staff and administrators the tools to track, assign, and resolve them transparently.

**Tagline:** _Report it. Track it. Nivaran — Resolved._

---

## 🎯 Problem Statement

Citizens face broken infrastructure daily — potholes, overflowing garbage, faulty streetlights, water leaks — but reporting is scattered, duplicate complaints flood municipal systems, and there's no transparent tracking of resolution. Nivaran centralizes reporting, eliminates duplicate noise through geolocation-based clustering, prioritizes issues by real urgency signals, and gives full transparency back to citizens and the public.

---

## ✨ Key Features

- 📍 **Geo-tagged issue reporting** with photo upload
- 🔁 **Smart duplicate detection** — merges nearby reports of the same issue instead of creating duplicates (Haversine distance-based)
- ⚖️ **Priority scoring engine** — weighted algorithm ranks issues by urgency (report count, severity, age, upvotes)
- 🎫 **Ticket ID system** — every report gets a trackable ID, just like real 311 systems
- 👥 **Three-role access control** — Citizen, Municipal Staff, and Municipality Admin
- 🗺️ **Live map dashboard** — color-coded by priority
- 🔔 **Real-time status updates** via Socket.io + email fallback
- 📸 **Before/after resolution photos** — visual proof of work
- ⭐ **Citizen satisfaction ratings** feeding into staff/department performance
- ⏱️ **SLA timers & auto-escalation** — unresolved tickets past deadline get flagged and bumped in priority
- 🧑‍🤝‍🧑 **Load-balanced staff assignment** within departments
- 🌐 **Public transparency dashboard** — anyone can view department-wise resolution stats, no login required
- 🕵️ **Anonymous reporting option**
- 💬 **Comment/update threads** on each report
- 🤖 **AI-assisted auto-categorization** (added as an enhancement layer, with graceful fallback to manual/rule-based categorization)

---

## 👥 Roles

| Role                   | Responsibilities                                                             |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Citizen**            | Report issues, track status, comment, upvote, rate resolutions               |
| **Municipal Staff**    | Handle assigned tickets, update status, upload resolution proof              |
| **Municipality Admin** | Route/assign issues, monitor SLA compliance, manage disputes, view analytics |

---

## 🧠 Core Algorithms

### 1. Duplicate Detection (Haversine Distance)

Detects if a newly reported issue is likely the same as an existing open report within a defined radius (~50m) and the same category, merging reports instead of duplicating them.

### 2. Priority Scoring

```
priorityScore = (reportCount × W1) + (categorySeverityWeight × W2) + (daysOpen × W3) + (upvotes × W4)
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB Atlas account
- Cloudinary account

### Setup

```bash
# Clone the repo
git clone https://github.com/Ujjwal-0005/nivaran.git
cd nivaran

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### Environment Variables

Create a `.env` file in `/server`:

```
MONGO_URI=your_mongodb_atlas_uri
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret
EMAIL_USER=your_email
EMAIL_PASS=your_app_password
GEMINI_API_KEY=your_gemini_key   # added in later phase
```

### Run locally

```bash
# Terminal 1 - backend
cd server
npm run dev

# Terminal 2 - frontend
cd client
npm run dev
```

---

## 🗓️ Build Roadmap

- [ ] Auth (register/login/OTP) + 3-role setup
- [ ] Report submission + duplicate detection
- [ ] Citizen dashboard (my reports, comments, ratings)
- [ ] Admin dashboard (map, assignment, SLA/escalation)
- [ ] Staff dashboard (resolve flow, before/after photos)
- [ ] Real-time notifications (Socket.io)
- [ ] Analytics + public transparency dashboard
- [ ] AI auto-categorization (final phase)

---

## 👨‍💻 Team

| Name | Module                                                   |
| ---- | -------------------------------------------------------- |
| —    | Citizen-facing app                                       |
| —    | Admin dashboard                                          |
| —    | Core algorithms (duplicate detection + priority scoring) |
| —    | Real-time system + analytics                             |
| —    | Auth, architecture, deployment, integration              |

---

## 📄 License

This project is developed as an academic capstone project.
