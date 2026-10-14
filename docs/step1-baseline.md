# Step 1 Baseline — Pre-Migration Audit

**Date:** 2026-10-14  
**Branch:** `multitenant-v2`  
**Purpose:** Baseline audit of models, routes, category-department coupling, hardcoded values, and Socket.io authentication prior to multi-city foundation work.

---

## 1. Models and Fields

### `User` (`server/models/User.js`)
- `name`: String (required)
- `email`: String (required, unique)
- `passwordHash`: String (required)
- `role`: String (enum: `['citizen', 'staff', 'admin']`, required)
- `phone`: String
- `city`: String
- `state`: String
- `department`: ObjectId (ref: `Department`)
- `isVerified`: Boolean (default: false)
- `otp`: String
- `otpExpiry`: Date
- `lastOtpSentAt`: Date
- Timestamps: `createdAt`, `updatedAt`

### `Department` (`server/models/Department.js`)
- `name`: String (required, unique)
- `description`: String
- Timestamps: `createdAt`, `updatedAt`

### `Category` (`server/models/Category.js`)
- `name`: String (required, unique)
- `department`: ObjectId (ref: `Department`, required)
- `severityWeight`: Number (min: 1, max: 10, required)
- `slaHours`: Number (default: 48, min: 1, required)
- Timestamps: `createdAt`, `updatedAt`

### `Report` (`server/models/Report.js`)
- `ticketId`: String (required, unique)
- `citizen`: ObjectId (ref: `User`, required)
- `category`: ObjectId (ref: `Category`, required)
- `department`: ObjectId (ref: `Department`, required)
- `description`: String (required)
- `photoUrl`: String
- `resolutionPhotoUrl`: String
- `location`:
  - `lat`: Number (required)
  - `lng`: Number (required)
- `status`: String (enum: `['reported', 'acknowledged', 'in_progress', 'resolved', 'disputed']`, default: `'reported'`)
- `isAnonymous`: Boolean (default: false)
- `reportCount`: Number (default: 1)
- `reportedBy`: Array of ObjectId (ref: `User`)
- `upvotes`: Array of ObjectId (ref: `User`)
- `priorityScore`: Number (default: 0)
- `comments`: Array of subdocuments:
  - `author`: ObjectId (ref: `User`, required)
  - `authorRole`: String (required)
  - `text`: String (required)
  - `createdAt`: Date (default: Date.now)
- `rating`:
  - `score`: Number (min: 1, max: 5)
  - `feedback`: String
- `isDisputed`: Boolean (default: false)
- `disputeReason`: String
- `assignedTo`: ObjectId (ref: `User`, default: null)
- `resolutionNote`: String
- `slaDeadline`: Date
- `isEscalated`: Boolean (default: false)
- `escalatedAt`: Date
- `resolvedAt`: Date
- Timestamps: `createdAt`, `updatedAt`

*(Note: Dispute and Comment models are embedded inside Report document schema; no separate collections exist.)*

---

## 2. Complete Route Table

| Method | Path | Auth Required | Role Check | Param `:id` | Description / Controller |
|---|---|---|---|---|---|
| POST | `/api/auth/register` | No | None | No | `authController.register` |
| POST | `/api/auth/verify-otp` | No | None | No | `authController.verifyOTP` |
| POST | `/api/auth/resend-otp` | No | None | No | `authController.resendOTP` |
| POST | `/api/auth/login` | No | None | No | `authController.login` |
| GET | `/api/categories` | No | None | No | `categoryController.getCategories` |
| POST | `/api/categories` | Yes | `admin` | No | `categoryController.createCategory` |
| PATCH | `/api/categories/:id` | Yes | `admin` | Yes | `categoryController.updateCategory` |
| GET | `/api/departments` | Yes | None (any authenticated) | No | `departmentController.getDepartments` |
| POST | `/api/departments` | Yes | `admin` | No | `departmentController.createDepartment` |
| PATCH | `/api/departments/:id` | Yes | `admin` | Yes | `departmentController.updateDepartment` |
| GET | `/api/staff` | Yes | `admin` | No | `staffController.getAllStaff` |
| GET | `/api/staff/:id/tickets` | Yes | `admin` | Yes | `staffController.getStaffTickets` |
| GET | `/api/reports/disputed` | Yes | `admin` | No | `reportController.getDisputedReports` |
| GET | `/api/reports` | Yes | `admin` | No | `reportController.getAllReports` |
| GET | `/api/reports/nearby` | Yes | None (any authenticated) | No | `reportController.getNearbyReports` |
| GET | `/api/reports/mine` | Yes | `citizen` | No | `reportController.getMyReports` |
| GET | `/api/reports/assigned` | Yes | `staff` | No | `reportController.getAssignedReports` |
| GET | `/api/reports/department` | Yes | `staff` | No | `reportController.getDepartmentReports` |
| POST | `/api/reports` | Yes | `citizen` | No | `reportController.submitReport` (upload: photo) |
| POST | `/api/reports/:id/join` | Yes | `citizen` | Yes | `reportController.joinReport` |
| POST | `/api/reports/:id/upvote` | Yes | `citizen` | Yes | `reportController.upvoteReport` |
| POST | `/api/reports/:id/comments` | Yes | None (any authenticated) | Yes | `reportController.addComment` |
| POST | `/api/reports/:id/rate` | Yes | `citizen` | Yes | `reportController.rateReport` |
| POST | `/api/reports/:id/dispute` | Yes | `citizen` | Yes | `reportController.disputeReport` |
| PATCH | `/api/reports/:id/assign` | Yes | `admin` | Yes | `reportController.assignReport` |
| PATCH | `/api/reports/:id/resolve-dispute` | Yes | `admin` | Yes | `reportController.resolveDispute` |
| PATCH | `/api/reports/:id/status` | Yes | `staff` | Yes | `reportController.updateStatus` (upload: resolutionPhoto) |
| GET | `/api/reports/:id` | Yes | None (any authenticated) | Yes | `reportController.getReportById` |
| GET | `/api/analytics/overview` | Yes | `admin` | No | `analyticsController.getOverviewAnalytics` |
| GET | `/api/analytics/by-category` | Yes | `admin` | No | `analyticsController.getCategoryAnalytics` |
| GET | `/api/analytics/by-department` | Yes | `admin` | No | `analyticsController.getDepartmentAnalytics` |
| GET | `/api/analytics/trends` | Yes | `admin` | No | `analyticsController.getTrendAnalytics` |
| GET | `/api/analytics/staff-leaderboard` | Yes | `admin` | No | `analyticsController.getStaffLeaderboard` |
| GET | `/api/analytics/zones` | Yes | `admin` | No | `analyticsController.getZoneAnalytics` |
| GET | `/api/public/transparency` | No | None | No | `analyticsController.getPublicTransparency` |

---

## 3. Places Reading `Category.department`

1. **`server/controllers/reportController.js` (lines 39, 90, 120, 176):**
   - In duplicate detection & new report submission: validates `categoryDoc.department`, sets `report.department = categoryDoc.department._id`, and returns `department: categoryDoc.department.name` in nearby candidate responses.
2. **`server/controllers/categoryController.js` (line 84):**
   - `updateCategory` assigns `category.department = department`.
3. **`server/seed.js` (lines 93, 212, 240, 281):**
   - Matches seeded categories to department ObjectId via `deptMap.get(cat.department)` and populates `department` on dummy reports.
4. **`client/src/pages/admin/AdminDepartments.jsx` (lines 84, 92, 181, 198, 311):**
   - Category management modal links category creation/editing to a department dropdown (`catForm.department`).
5. **`client/src/pages/citizen/ReportIssue.jsx` (line 170):**
   - Dropdown display text: `{cat.name} — {cat.department?.name}`.
6. **`client/src/pages/citizen/MyReports.jsx` (lines 108, 109, 125, 130):**
   - Fallback display: `report.category?.department?.name || report.department?.name`.
7. **`client/src/pages/staff/StaffTicketDetail.jsx` (line 182):**
   - `getDeptColor(report.department?.name || report.category?.department?.name)`.

---

## 4. Hardcoded Coordinates, City, or State Names

1. **`client/src/pages/admin/AdminMap.jsx` (line 114):**
   - `const defaultCenter = [31.25, 75.70] // Default Punjab center`
2. **`client/src/pages/citizen/ReportIssue.jsx` (line 233):**
   - `center={position || [28.6139, 77.2090]}` (New Delhi coordinates)
3. **`client/src/pages/citizen/NearbyIssues.jsx` (line 235):**
   - `center={position || [28.6139, 77.2090]}` (New Delhi coordinates)
4. **`server/seed.js` (lines 182, 183):**
   - `parseFloat(process.env.SEED_CENTER_LAT) || 28.6139`
   - `parseFloat(process.env.SEED_CENTER_LNG) || 77.2090`

---

## 5. Socket.io Authentication and Rooms Today

- **Server Setup (`server/config/socket.js`):**
  - Origin is wildcard `*` with standard HTTP verbs allowed.
  - Connection event logs client connection.
  - **No token authentication in `io.use`**.
  - Client sends an unauthenticated `register` event with `{ userId, role }`.
  - Joins personal room `userId.toString()`.
  - If `role === 'admin'`, joins shared room `'admins'`.
- **Client Implementation (`client/src/context/SocketContext.jsx`):**
  - Initializes `io(socketUrl)` without auth token.
  - On `connect`, emits `register` with `{ userId, role }`.
- **Admin notifications (`server/utils/notify.js`):**
  - `notifyAdmins(event, payload)` broadcasts to `'admins'` room regardless of city.
