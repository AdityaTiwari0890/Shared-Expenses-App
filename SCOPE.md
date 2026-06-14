# Shared Expenses App - Scope Document

## Project Overview

Production-grade shared expenses platform built for a 2-day Spreetail hackathon assignment. The app handles complex scenarios of group expense splitting with membership lifecycle awareness, multi-currency support, and CSV import with anomaly detection and approval workflows.

**Delivery Date:** 2 days  
**Technology Stack:** PostgreSQL + Prisma, Express.js + TypeScript, React + TypeScript  
**Deployment:** GitHub + Render (backend) + Vercel (frontend)

---

## CSV Anomalies Identified & Handling

### Source Data
- **File:** expenses_export.csv (from trip expense tracking)
- **Total Rows Analyzed:** 14+ problems identified
- **Severity Categories:** CRITICAL, HIGH, MEDIUM, LOW
- **Dataset:** Multi-person trip to Thalassa (India, March 2026)

### Detected Anomalies

| # | Type | Severity | Count | Row(s) | Issue | Handling | Approval? |
|---|------|----------|-------|--------|-------|----------|-----------|
| 1 | MISSING_PAYER | CRITICAL | 1 | 8 | No payer specified | Row skipped | ✅ Required |
| 2 | INVALID_DATE_FORMAT | HIGH | 3 | 2,6,9 | Mixed formats (01-02-2026, Mar-14, 04-05-2026) | Fuzzy parse with confirmation | ✅ Required |
| 3 | DUPLICATE_EXPENSE | HIGH | 2 | 3,4 | Aisha thalassa dinner (₹2000) vs Rohan (₹2500) | Hash on payer+date+amount - manual review | ✅ Required |
| 4 | MISSING_CURRENCY | MEDIUM | 4 | 1,5,7,10 | No currency, assumed INR | Default to INR | ❌ Optional |
| 5 | UNKNOWN_MEMBER | HIGH | 2 | 11,12 | Names not in group (Michael, Unknown Person) | Check membership, reject if absent | ✅ Required |
| 6 | POST_LEAVE_EXPENSE | MEDIUM | 1 | 13 | Sam left group March 8, expense dated March 15 | Exclude from Sam's balance | ✅ Required |
| 7 | NEGATIVE_AMOUNT | LOW | 1 | 14 | Refund: -₹500 | Treat as refund/settlement | ❌ Optional |
| 8 | INVALID_PERCENTAGE_SUM | HIGH | 1 | 6 | Percentages: 30%, 40%, 50% (sum=120%) | Normalize or reject | ✅ Required |
| 9 | CURRENCY_MISMATCH | MEDIUM | 1 | Throughout | Mixed INR and USD | Store original, convert at reporting | ❌ Optional |
| 10 | ZERO_AMOUNT | LOW | 1 | Sample | Zero amount expense | Skip silently | ❌ Optional |
| 11 | WHITESPACE_ERROR | LOW | 2 | Various | Extra spaces in names | Trim whitespace | ❌ Optional |
| 12 | NAME_INCONSISTENCY | MEDIUM | 1 | 2,7 | "Aisha Khan" vs "Aisha K" | Fuzzy match (>90%) | ✅ Required |
| 13 | SETTLEMENT_AS_EXPENSE | HIGH | 1 | 5 | Contains keywords ("paid back," "settlement") | Reclassify or skip | ✅ Required |
| 14 | MISSING_FIELD | CRITICAL | 2 | 4,11 | Required fields absent | Row skipped | ✅ Required |

### Critical Business Requirements Met

**Sam's Question:** "Why would March affect me?" (Sam left March 8)
- ✅ Solution: Balance calculation filters expenses by membership dates [joined_at, left_at]
- ✅ POST_LEAVE_EXPENSE detection prevents March 15 expense from affecting Sam's balance

**Meera's Requirement:** "Approve anything the app deletes or changes"
- ✅ Solution: Two-phase import workflow (preview → approve → finalize)
- ✅ ImportAnomaly records created for each issue with requires_approval flag
- ✅ User explicitly approves each decision before finalization

**Rohan's Requirement:** "Show exactly which expenses make that up"
- ✅ Solution: Balance breakdown includes expense-by-expense details
- ✅ GET /groups/:id/my-balance returns { paid[], owed[] } with individual amounts

---

## Database Schema

### Core Tables

#### User
```sql
CREATE TABLE "User" (
  id                String    @id @default(cuid())
  email             String    @unique
  password_hash     String
  first_name        String
  last_name         String
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
)
```

#### Group
```sql
CREATE TABLE "Group" (
  id                String    @id @default(cuid())
  name              String
  description       String?
  created_by_id     String
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  created_by        User      @relation(fields: [created_by_id], references: [id])
  members           GroupMember[]
  expenses          Expense[]
  imports           ImportLog[]
)
```

#### GroupMember (Membership Lifecycle)
```sql
CREATE TABLE "GroupMember" {
  id                String    @id @default(cuid())
  group_id          String
  user_id           String
  joined_at         DateTime  @default(now())
  left_at           DateTime? -- Nullable: null = still member, non-null = left on this date
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  @@unique([group_id, user_id])
  group             Group     @relation(fields: [group_id], references: [id])
  user              User      @relation(fields: [user_id], references: [id])
}
```
**Key Design:** `left_at` enables soft-delete for balance calculations

#### Expense
```sql
CREATE TABLE "Expense" {
  id                String    @id @default(cuid())
  group_id          String
  paid_by_id        String
  description       String
  amount_original   Decimal   -- Original amount (uses Decimal to prevent float errors)
  currency          String    @default("INR")
  date              DateTime
  split_type        SplitType -- EQUAL | PERCENTAGE | EXACT | SHARE
  is_settlement     Boolean   @default(false)
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  group             Group     @relation(fields: [group_id], references: [id])
  paid_by           User      @relation(fields: [paid_by_id], references: [id])
  splits            ExpenseSplit[]
}

enum SplitType {
  EQUAL
  PERCENTAGE
  EXACT
  SHARE
}
```

#### ExpenseSplit (Flexible Split Storage)
```sql
CREATE TABLE "ExpenseSplit" {
  id                String    @id @default(cuid())
  expense_id        String
  user_id           String
  amount_owed       Decimal?  -- For EXACT split
  percentage        Decimal?  -- For PERCENTAGE split (0-100)
  shares            Int?      -- For SHARE split
  created_at        DateTime  @default(now())
  
  expense           Expense   @relation(fields: [expense_id], references: [id], onDelete: Cascade)
  user              User      @relation(fields: [user_id], references: [id])
}
```

#### Settlement
```sql
CREATE TABLE "Settlement" {
  id                String    @id @default(cuid())
  group_id          String
  from_user_id      String
  to_user_id        String
  amount            Decimal
  currency          String    @default("INR")
  date              DateTime  @default(now())
  created_at        DateTime  @default(now())
  
  group             Group     @relation(fields: [group_id], references: [id])
  from_user         User      @relation("from", fields: [from_user_id], references: [id])
  to_user           User      @relation("to", fields: [to_user_id], references: [id])
}
```

#### ImportLog (CSV Import Tracking)
```sql
CREATE TABLE "ImportLog" {
  id                String    @id @default(cuid())
  user_id           String
  group_id          String
  total_rows        Int
  valid_rows        Int
  rejected_rows     Int
  report_json       Json      -- Summary of import
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  user              User      @relation(fields: [user_id], references: [id])
  group             Group     @relation(fields: [group_id], references: [id])
  anomalies         ImportAnomaly[]
}
```

#### ImportAnomaly (Individual Anomaly Records)
```sql
CREATE TABLE "ImportAnomaly" {
  id                String    @id @default(cuid())
  import_log_id     String
  row_number        Int
  anomaly_type      String    -- Type identifier
  severity          AnomalySeverity
  description       String
  raw_data          Json
  action_taken      String
  requires_approval Boolean
  approved_at       DateTime?
  approved_by_id    String?
  created_at        DateTime  @default(now())
  
  import_log        ImportLog @relation(fields: [import_log_id], references: [id], onDelete: Cascade)
  approved_by       User?     @relation(fields: [approved_by_id], references: [id])
}

enum AnomalySeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

#### CurrencyConversion (Date-based Rates)
```sql
CREATE TABLE "CurrencyConversion" {
  id                String    @id @default(cuid())
  date              DateTime
  from_currency     String
  to_currency       String
  rate              Decimal
  created_at        DateTime  @default(now())
  
  @@unique([date, from_currency, to_currency])
}
```

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Create account
- `POST /api/auth/login` - Get JWT token
- `GET /api/auth/me` - Get current user (protected)

### Groups
- `POST /api/groups` - Create group
- `GET /api/groups` - List user's groups
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/members` - Add member
- `POST /api/groups/:id/members/:userId/remove` - Remove member

### Expenses
- `POST /api/groups/:id/expenses` - Create expense
- `GET /api/groups/:id/expenses` - List expenses
- `GET /api/groups/:id/expenses/:id` - Get expense details
- `DELETE /api/groups/:id/expenses/:id` - Delete expense
- `GET /api/groups/:id/balances` - Get all member balances
- `GET /api/groups/:id/my-balance` - Get personal balance with breakdown

### Settlements
- `POST /api/groups/:id/settle` - Record settlement
- `GET /api/groups/:id/settlements` - List settlements
- `GET /api/groups/:id/my-settlements` - List user's settlements

### CSV Import
- `POST /api/import/:groupId/preview` - Analyze CSV, return anomalies
- `POST /api/import/:groupId/finalize/:logId` - Approve anomalies, finalize import
- `GET /api/import/:groupId/history` - Get import history

---

## Split Type Examples

### EQUAL Split
```json
{
  "description": "Dinner",
  "amount_original": 3000,
  "split_type": "EQUAL",
  "splits_data": [
    { "user_id": "user1" },
    { "user_id": "user2" },
    { "user_id": "user3" }
  ]
}
// Result: Each person owes 1000
```

### PERCENTAGE Split
```json
{
  "description": "Groceries",
  "amount_original": 1000,
  "split_type": "PERCENTAGE",
  "splits_data": [
    { "user_id": "user1", "percentage": 50 },
    { "user_id": "user2", "percentage": 30 },
    { "user_id": "user3", "percentage": 20 }
  ]
}
// Result: user1 owes 500, user2 owes 300, user3 owes 200
```

### EXACT Split
```json
{
  "description": "Utilities",
  "amount_original": 1500,
  "split_type": "EXACT",
  "splits_data": [
    { "user_id": "user1", "amount": 600 },
    { "user_id": "user2", "amount": 500 },
    { "user_id": "user3", "amount": 400 }
  ]
}
```

### SHARE Split
```json
{
  "description": "Rent",
  "amount_original": 2000,
  "split_type": "SHARE",
  "splits_data": [
    { "user_id": "user1", "shares": 2 },
    { "user_id": "user2", "shares": 1 }
  ]
}
// Result: user1 owes 1333.33, user2 owes 666.67
```

---

## Key Features Implemented

✅ **Authentication System**
- JWT-based with 7-day expiry
- bcryptjs password hashing (10 salt rounds)
- Protected routes with authMiddleware

✅ **Membership Lifecycle**
- Users can join/leave groups
- Balance calculations respect membership dates
- Expenses after leave_date don't affect user's balance

✅ **Flexible Split Types**
- EQUAL: Simple division
- PERCENTAGE: Based on percentage
- EXACT: Direct amounts
- SHARE: Proportional to shares

✅ **Multi-Currency Support**
- Stores original currency with amount
- CurrencyConversion table for rates
- Conversions at reporting time (not storage)

✅ **CSV Import with Anomaly Detection**
- 14+ detection patterns
- Severity classification
- Approval workflow before finalization
- Preserves data integrity

✅ **Balance Calculation**
- Membership-aware (respects leave_at)
- Includes settlements
- Provides expense-by-expense breakdown
- Uses Decimal for precision

---

## Deployment Configuration

### Backend (Render)
```
Build Command: npm install --prefix server && npm run --prefix server build
Start Command: npm run --prefix server start
Environment:
  - DATABASE_URL=postgresql://...
  - JWT_SECRET=...
  - NODE_ENV=production
  - PORT=4000
```

### Frontend (Vercel)
```
Build Command: npm install --prefix client && npm run --prefix client build
Output Directory: client/dist
Environment:
  - VITE_API_BASE=https://backend-url/api
```

### Database (PostgreSQL)
- Managed cloud instance (Render, Heroku, or AWS RDS)
- Automatic Prisma migrations on deployment
- Backup strategy: Daily automated backups

---

## Testing Strategy

- **Unit Tests:** Balance calculation logic
- **Integration Tests:** Anomaly detection against sample CSV
- **E2E Tests:** Full import workflow with UI

---

## Known Limitations & Future Work

1. **Real-time Notifications:** No WebSocket support for live balance updates
2. **Advanced Search:** No full-text search on expense descriptions
3. **Recurring Expenses:** No automation for monthly/weekly expenses
4. **Mobile App:** Web-only for now
5. **Offline Support:** No offline functionality

---

## Success Criteria (All Met ✅)

- [x] Handle all split types (EQUAL, PERCENTAGE, EXACT, SHARE)
- [x] Detect all 14+ CSV anomalies
- [x] Respect membership lifecycle (Sam's requirement)
- [x] Provide approval workflow (Meera's requirement)
- [x] Show balance breakdown (Rohan's requirement)
- [x] Production-grade code (TypeScript strict, error handling)
- [x] Deployable to cloud (GitHub + Render/Vercel)
- [x] Interview-ready documentation
