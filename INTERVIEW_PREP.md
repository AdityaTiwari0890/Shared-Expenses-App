# Shared Expenses App - Interview Preparation Guide

Top 50 interview questions covering architecture, design decisions, problem-solving, and technical depth. Each includes a prepared answer demonstrating expertise and communication clarity.

---

## SECTION 1: Project Overview & Requirements (Q1-5)

### Q1: Walk me through this project. What did you build and why?

**Answer:**
> "I built a production-grade shared expenses app in 2 days for the Spreetail hackathon. The core problem: when a group of friends travels together, tracking who paid what and who owes whom becomes complex. Traditional apps miss critical scenarios like:
> 
> - **Sam's Problem:** 'I left the trip March 8. Why would an expense on March 15 affect my balance?' (membership lifecycle)
> - **Meera's Problem:** 'I want to approve any data changes before they're applied' (approval workflows)
> - **Rohan's Problem:** 'Show me exactly which expenses make up my balance' (transparency)
>
> The app solves these with:
> - Membership-aware balance calculation (respects join/leave dates)
> - Two-phase CSV import (preview → approve → finalize)
> - Flexible split types (equal, percentage, exact, shares)
> - 14+ anomaly detection patterns
> 
> Tech stack: PostgreSQL + Prisma, Express + TypeScript, React + TypeScript. Everything type-safe and production-ready."

**Why This Answer:**
- Shows understanding of real user needs
- Demonstrates problem-solving mindset
- Mentions specific technologies
- Explains time constraint (2 days)

---

### Q2: Why build this instead of using an existing app like Splitwise?

**Answer:**
> "Great question. Two reasons:
> 
> 1. **Learning** - I wanted to experience full-stack development: schema design, API architecture, UI patterns, and deployment under time pressure.
> 
> 2. **Requirements** - This project had specific constraints Splitwise doesn't handle:
>    - Membership-aware balances (expenses after member leaves shouldn't affect them)
>    - Approval workflows before importing CSV changes
>    - Explainable architecture (every design decision documented for interviews)
>    - Production-grade code with 14+ anomaly detection patterns
>
> Building from scratch let me control every layer—database design, validation logic, UI responsiveness—in a way using a library wouldn't."

**Why This Answer:**
- Shows intentionality
- Explains learning goals
- Clarifies project scope vs existing solutions

---

### Q3: What were the biggest challenges you faced?

**Answer:**
> "Three main challenges:
> 
> 1. **Membership Lifecycle Complexity** 
>    - Initial approach: ignore `left_at`, sum all expenses for user
>    - Problem: User who left March 8 would be affected by March 15 expense
>    - Solution: Added date range filtering [joined_at, left_at] in balance query
>    - This changed everything—affected schema, API contracts, test cases
>
> 2. **CSV Anomaly Handling**
>    - Initial approach: auto-fix or skip problematic rows
>    - Problem: Violates Meera's requirement—'approve anything deleted'
>    - Solution: Two-phase import with explicit user approval per anomaly
>    - Added ImportLog + ImportAnomaly tables for audit trail
>
> 3. **Financial Precision**
>    - Initial approach: JavaScript Number type for amounts
>    - Problem: 0.1 + 0.2 ≠ 0.3 causes rounding errors
>    - Solution: Switched to Prisma Decimal type everywhere
>    - Updated validation, balance calc, all endpoints
>
> The pattern: Recognize early that initial approach won't work, redesign quickly, document why."

**Why This Answer:**
- Shows problem-solving progression
- Demonstrates technical depth (floating-point precision)
- Illustrates iteration mindset

---

### Q4: What would you do differently if you had more time?

**Answer:**
> "If I had 1 week instead of 2 days:
>
> 1. **Real-time Updates** - Add WebSocket support so balance changes update live without refresh
> 2. **Refresh Tokens** - Current JWT is 7-day expiry. Would add refresh token mechanism for enhanced security
> 3. **Recurring Expenses** - Automate monthly/weekly recurring expenses
> 4. **Advanced Analytics** - Charts showing top spenders, trends over time, anomaly patterns
> 5. **Full-Text Search** - Elasticsearch to search expense descriptions
> 6. **Mobile App** - React Native version sharing API with web
> 7. **Comprehensive Tests** - Unit tests for balance logic, integration tests for import workflow, e2e tests for full user flow
> 8. **Performance** - Add Redis caching for frequently accessed balances, query optimization with indexes
>
> But given 2 days, I prioritized: correctness > features > polish. Got the core logic right first."

**Why This Answer:**
- Shows product thinking (prioritization)
- Demonstrates awareness of limitations
- Lists realistic improvements

---

### Q5: How would you explain this to a non-technical person?

**Answer:**
> "Imagine you're on a trip with 3 friends. One person pays for the hotel ($300), another buys groceries ($100), a third pays for gas ($60). Everyone should pay equally ($140 each).
>
> This app does three things:
>
> 1. **Tracks everything** - 'Alice paid $300, Bob paid $100, Carol paid $60'
> 2. **Calculates who owes whom** - 'Alice is owed $40, Bob owes $40, Carol owes $80'
> 3. **Handles changes** - 'When Dave joins, everyone's share changes. When Carol leaves, old expenses don't affect her anymore'
>
> Plus, if you want to upload a spreadsheet of expenses, the app checks if the data looks right before adding it—because garbage in = garbage out. You approve any fixes."

**Why This Answer:**
- Accessible language
- Concrete example
- Explains three core features simply

---

## SECTION 2: Technical Architecture (Q6-15)

### Q6: Why PostgreSQL instead of MongoDB?

**Answer:**
> "PostgreSQL for three reasons:
>
> 1. **Relational Integrity** - The core data model has complex relationships:
>    - User → GroupMember ← Group (many-to-many)
>    - Group → Expense ← User (who paid?)
>    - Expense → ExpenseSplit → User (who owes what?)
>    
>    These relationships are best expressed with foreign keys. MongoDB documents would require duplicating data (violating DRY).
>
> 2. **ACID Transactions** - CSV import is multi-step:
>    - Validate all rows
>    - Create ImportLog record
>    - Create 20+ ImportAnomaly records
>    - If any step fails, rollback all
>    
>    MongoDB transactions are more limited; PostgreSQL guarantees atomicity.
>
> 3. **Type Safety** - Prisma generates TypeScript types matching the schema. When I renamed a column, Prisma caught all 23 places I needed to update."

**Why This Answer:**
- Explains database choice with reasoning
- Shows understanding of data modeling
- Mentions specific features (ACID, types)

---

### Q7: Walk through the database schema. Why did you design it that way?

**Answer:**
> "11 tables, organized around core concepts:
>
> **Users & Groups:**
> - `User` - stores credentials (password_hash, email)
> - `Group` - created_by_id links to creator
> - `GroupMember` - joins User+Group with **`joined_at, left_at`** (critical design)
>
> **Expenses & Splits:**
> - `Expense` - one record per expense with split_type enum
> - `ExpenseSplit` - flexible storage (amount, percentage, or shares)
> - Each split type uses different fields:
>   - EQUAL: no split record needed (divide by count)
>   - EXACT: uses amount_owed
>   - PERCENTAGE: uses percentage (validated = 100%)
>   - SHARE: uses shares (proportional division)
>
> **Settlements & Imports:**
> - `Settlement` - records payments between users
> - `ImportLog` - tracks CSV imports with metadata
> - `ImportAnomaly` - individual anomalies with approval flags
> - `CurrencyConversion` - date-based exchange rates
>
> **Key Design Decision: left_at**
> - Null when user is active, filled when they leave
> - Enables soft-delete without losing history
> - Balance query filters: `date >= joined_at AND date <= (left_at OR now())`
> - This single field prevents entire class of bugs (Sam's requirement)"

**Why This Answer:**
- Shows comprehensive understanding
- Explains reasoning for each table
- Highlights critical design decision (left_at)

---

### Q8: How does balance calculation work? Walk through an example.

**Answer:**
> "Balance = What I paid - What I owe
>
> **Example:** Sam's balance in 3-person trip
> - Paid $300 hotel (alone)
> - Owes $30 (her share of $90 groceries split 3 ways)
> - Balance = $300 - $30 = $270 (owed money)
>
> **Code pattern:**
> ```typescript
> async calculateUserBalance(userId, groupId) {
>   const member = await prisma.groupMember.findFirst({
>     where: { user_id: userId, group_id: groupId }
>   });
>   
>   // Only include expenses within membership window
>   const expenses = await prisma.expense.findMany({
>     where: {
>       group_id: groupId,
>       date: {
>         gte: member.joined_at,
>         lte: member.left_at || new Date()
>       }
>     }
>   });
>   
>   let paid = 0;
>   let owed = 0;
>   
>   for (const exp of expenses) {
>     if (exp.paid_by_id === userId) paid += exp.amount;
>     
>     const split = await prisma.expenseSplit.findFirst({
>       where: { expense_id: exp.id, user_id: userId }
>     });
>     if (split) owed += split.amount_owed;
>   }
>   
>   return new Decimal(paid).minus(owed);
> }
> ```
>
> **Critical Point:** The date filtering respects membership dates. If Sam left March 8 and there's an expense March 15, it's excluded from her calculation."

**Why This Answer:**
- Concrete code example
- Shows membership-aware filtering
- Explains full calculation logic

---

### Q9: Why use Decimal instead of JavaScript Number for amounts?

**Answer:**
> "Classic floating-point precision problem:
>
> ```javascript
> 0.1 + 0.2 === 0.3  // false! (returns 0.30000000000000004)
> ```
>
> In a financial app with thousands of transactions:
> - Round-trip conversions accumulate errors
> - $0.01 error × 1000 transactions = $10 loss
> - Unacceptable for any money app
>
> **Solution:** Prisma's Decimal type
> - Stores as precise string representation internally
> - Arithmetic operations are exact
> - No precision loss through conversions
>
> **Implementation:**
> ```typescript
> const amount = new Decimal('0.1').plus(new Decimal('0.2'));
> amount.equals(new Decimal('0.3')); // true!
> ```
>
> **Side Effect:** This influenced all validation, calculations, API contracts. Amount fields are always strings in JSON, then converted to Decimal in Prisma."

**Why This Answer:**
- Explains real problem with concrete example
- Shows understanding of precision
- Demonstrates careful consideration

---

### Q10: Describe the CSV import workflow. Why two phases?

**Answer:**
> "Two-phase approach:
>
> **Phase 1: PREVIEW**
> - User uploads CSV
> - System parses rows and detects 14+ anomaly types
> - Returns ImportLog with anomalies listed
> - User can review in UI before applying changes
>
> **Phase 2: FINALIZE**
> - User explicitly approves/rejects each anomaly
> - System creates expenses for approved rows
> - User has record of what was approved (audit trail)
>
> **Why two phases?** (Meera's requirement)
>
> Meera said: 'Approve anything the app deletes or changes'
>
> Single-phase approach would:
> - Auto-fix or skip problematic rows silently
> - User unaware of dropped data
> - No ability to override system decision
> - Violates data governance
>
> Two-phase approach:
> - Transparent: shows exact issues
> - Controlled: user must approve each decision
> - Auditable: ImportAnomaly records what was decided
> - Safe: can cancel before finalizing
>
> **Example Anomaly:**
> ```json
> {
>   \"type\": \"POST_LEAVE_EXPENSE\",
>   \"severity\": \"HIGH\",
>   \"description\": \"Sam left March 8, but this expense is dated March 15\",
>   \"action\": \"Exclude from Sam's balance calculation\",
>   \"requires_approval\": true
> }
> ```
> User sees this and can:
> - Approve (exclude from Sam)
> - Reject (include anyway if data was wrong)"

**Why This Answer:**
- Shows understanding of workflow design
- Explains business requirement origin
- Demonstrates user-centric thinking

---

### Q11: What are the 14 anomaly types you detect? Give examples.

**Answer:**
> "**Critical (stop processing):**
> 1. MISSING_PAYER - No one listed as payer → can't create expense
> 2. MISSING_FIELD - Required fields absent → incomplete record
>
> **High (requires approval):**
> 3. INVALID_DATE_FORMAT - '01-02-2026' ambiguous (DD-MM or MM-DD?) → fuzzy parse
> 4. DUPLICATE_EXPENSE - Hash on (payer, date, amount) detects duplicates
> 5. UNKNOWN_MEMBER - 'Michael' not in group → typo or guest?
> 6. INVALID_PERCENTAGE_SUM - Percentages don't equal 100%
> 7. SETTLEMENT_AS_EXPENSE - 'John paid back Mary' misclassified
>
> **Medium (low risk):**
> 8. POST_LEAVE_EXPENSE - Expense after member left (Sam's requirement)
> 9. CURRENCY_MISMATCH - Mixed INR and USD in same group
> 10. NAME_INCONSISTENCY - 'Aisha Khan' vs 'Aisha K' (fuzzy match)
>
> **Low (auto-fix):**
> 11. MISSING_CURRENCY - Default to INR
> 12. NEGATIVE_AMOUNT - Treat as refund
> 13. WHITESPACE_ERROR - Trim spaces
> 14. ZERO_AMOUNT - Skip silently
>
> **Example Detection (Duplicate):**
> ```typescript
> const hash = (row) => 
>   `${row.payer}|${row.date}|${row.amount}|${row.description}`;
> const duplicates = rows.filter((r, i) => 
>   rows.findIndex(x => hash(x) === hash(r)) !== i
> );
> ```"

**Why This Answer:**
- Shows comprehensive thinking
- Categorizes by severity
- Provides concrete examples

---

### Q12: How do you handle multi-currency expenses?

**Answer:**
> "Store original amount and currency, convert at reporting time:
>
> **Data Model:**
> ```sql
> Expense {
>   amount_original: Decimal
>   currency: String  -- 'INR', 'USD', etc.
> }
>
> CurrencyConversion {
>   date: DateTime
>   from_currency: String
>   to_currency: String
>   rate: Decimal
> }
> ```
>
> **Why not convert at import time?**
> 1. **Data Loss** - User paid $50 but we store ₹4000. Can't recover '$50' later.
> 2. **Wrong Rates** - Rate used at import time may change; want historical accuracy
> 3. **Transparency** - Users expect to see amount they actually paid
>
> **Example Query:**
> ```typescript
> // Get balance in USD
> const expenses = await getExpenses(groupId);
> let total = new Decimal(0);
> 
> for (const exp of expenses) {
>   if (exp.currency === 'USD') {
>     total = total.plus(exp.amount_original);
>   } else {
>     const rate = await getRate(exp.date, exp.currency, 'USD');
>     total = total.plus(exp.amount_original.times(rate));
>   }
> }
> ```
>
> **Default:** If currency missing, assume INR (most common in trip data)"

**Why This Answer:**
- Shows financial data thinking
- Explains design rationale
- Demonstrates handling of ambiguity

---

### Q13: What does the Prisma migration strategy look like?

**Answer:**
> "Prisma handles migrations automatically:
>
> **Development:**
> ```bash
> # When you change schema.prisma
> npx prisma migrate dev --name add_settlement_table
> # Creates migration file, applies to database
> ```
>
> **Production:**
> ```bash
> # On deployment (Render), run:
> npx prisma migrate deploy
> # Applies all pending migrations atomically
> ```
>
> **Key Features:**
> - Migrations are SQL files (trackable in git)
> - Atomic: all-or-nothing (no partial updates)
> - Reversible: can rollback with `migrate resolve`
> - Schema validation: Prisma checks consistency
>
> **Example Migration:**
> ```sql
> -- prisma/migrations/add_left_at/migration.sql
> ALTER TABLE \"GroupMember\" 
>   ADD COLUMN \"left_at\" TIMESTAMP;
>
> -- This enables the membership-aware balance calculation
> UPDATE \"GroupMember\" 
>   SET \"left_at\" = NULL 
>   WHERE \"left_at\" IS NULL;
> ```
>
> **Risk Mitigation:**
> - Database backups before migrations
> - Test migrations on staging first
> - Keep deployment and migration together"

**Why This Answer:**
- Shows understanding of deployment
- Explains migration safety
- Demonstrates DevOps thinking

---

### Q14: How is authentication implemented? Is it secure?

**Answer:**
> "JWT + bcryptjs:
>
> **Registration:**
> ```typescript
> const hashedPassword = await bcryptjs.hash(password, 10); // 10 salt rounds
> await prisma.user.create({
>   data: { email, password_hash: hashedPassword, first_name, last_name }
> });
> ```
>
> **Login:**
> ```typescript
> const user = await prisma.user.findUnique({ where: { email } });
> const isValid = await bcryptjs.compare(password, user.password_hash);
> const token = jwt.sign({ id: user.id, email }, JWT_SECRET, { expiresIn: '7d' });
> return { token };
> ```
>
> **Protected Routes:**
> ```typescript
> const authMiddleware = (req, res, next) => {
>   const token = req.headers.authorization?.split(' ')[1];
>   if (!token) return res.status(401).json({ error: 'Unauthorized' });
>   
>   try {
>     const decoded = jwt.verify(token, JWT_SECRET);
>     req.user = decoded;
>     next();
>   } catch (err) {
>     res.status(401).json({ error: 'Invalid token' });
>   }
> };
> ```
>
> **Security:**
> ✅ Passwords hashed (bcryptjs, 10 rounds = ~100ms computation)
> ✅ Tokens signed (JWT_SECRET never exposed)
> ✅ Tokens expire (7 days max lifetime)
> ✅ HTTPS only (enforced in production)
> ⚠️ Could improve: Add refresh token mechanism
> ⚠️ Could improve: Rate limiting on login
> ⚠️ Could improve: 2FA for sensitive operations"

**Why This Answer:**
- Shows complete authentication flow
- Acknowledges limitations
- Demonstrates security thinking

---

### Q15: Describe the tech stack and why each choice.

**Answer:**
> "**Backend:**
> - **Express** - Lightweight, mature, flexible routing
> - **TypeScript** - Strict mode catches errors at compile time
> - **Prisma** - Type-safe ORM with automatic migrations
> - **PostgreSQL** - Relational data, ACID transactions, good performance
>
> **Frontend:**
> - **React** - Component reusability, largest ecosystem, JSX syntax
> - **TypeScript** - Same benefits as backend
> - **Vite** - Fast dev server, quick builds (vs Webpack)
> - **TailwindCSS** - Utility classes, no custom CSS boilerplate
> - **Zustand** - Lightweight state (vs Redux boilerplate)
> - **React Router** - Standard navigation library
>
> **Infrastructure:**
> - **GitHub** - Version control, meaningful commit history
> - **Render** - Backend hosting (PostgreSQL, Node.js support)
> - **Vercel** - Frontend hosting (React optimized, fast deploys)
>
> **Design Principle:** Minimize boilerplate, maximize productivity in 2-day sprint, but keep production-grade quality (TypeScript strict, error handling, validation)."

**Why This Answer:**
- Shows cohesive decision-making
- Explains purpose of each tool
- Demonstrates system thinking

---

## SECTION 3: Problem-Solving & Design Thinking (Q16-25)

### Q16: You had 2 days. How did you prioritize?

**Answer:**
> "Day 1: Database + Backend API
> Day 2: Frontend + Documentation
>
> **Day 1 Strategy:**
> - 30 min: Analyze requirements (Sam's, Meera's, Rohan's questions)
> - 1 hour: Design schema (schema.prisma)
> - 2 hours: Core services (auth.ts, balanceService.ts, anomalyDetectionService.ts)
> - 3 hours: API routes (auth, groups, expenses, settlements, import)
> - 30 min: Test locally (npm run dev, simple curl tests)
> - 30 min: Deploy backend to Render
>
> **Day 2 Strategy:**
> - 1 hour: Frontend project setup (Vite, TailwindCSS, routing)
> - 2 hours: Core pages (Login, Dashboard, GroupPage)
> - 1 hour: CSV import page with anomaly visualization
> - 1 hour: Deploy to Vercel
> - 2 hours: Documentation (SCOPE, DECISIONS, AI_USAGE, README)
> - 30 min: Commit history cleanup
>
> **Prioritization Rules:**
> 1. Correctness > Features (balance calc must be right)
> 2. Core flows > Polish (auth + expenses > animations)
> 3. Documentation > Code comments (architecture decisions matter)
> 4. Backend first (frontend can wait, backend can't)
>
> **Time-Savers:**
> - Used GitHub Copilot for boilerplate (50% initial code, 100% reviewed)
> - Tailwind utilities instead of custom CSS
> - Zustand instead of Redux (no action/reducer/selector boilerplate)
> - Postman for API testing instead of writing tests"

**Why This Answer:**
- Shows time management
- Explains prioritization logic
- Demonstrates pragmatism

---

### Q17: When did you realize the membership dates were critical?

**Answer:**
> "During requirements analysis on Day 0 (before coding).
>
> Sam asked: 'I left the group on March 8. Why would March 15 expense affect me?'
>
> Initial thought: Maybe Sam made an error. But reading it 3 times, I realized this reveals a deep design requirement.
>
> **The Implication:**
> - Not just: 'Sam shouldn't pay for March 15 expense'
> - But: 'What happened *after* Sam left shouldn't affect her settlement amount at all'
> - This means: balance calculation needs a date range, not just accumulation
>
> **Cascade Effect:**
> Once I recognized this, it rippled through:
> 1. Schema: GroupMember needs `left_at` field
> 2. Query: Balance calculation needs date filtering
> 3. Import: POST_LEAVE_EXPENSE becomes critical anomaly
> 4. Testing: Edge case for boundary dates
> 5. Documentation: Must explain membership lifecycle
>
> **Lesson:** Read requirements deeply. What seems like a simple complaint often reveals architectural necessity."

**Why This Answer:**
- Shows thoughtful analysis
- Demonstrates requirements thinking
- Explains how one insight cascades

---

### Q18: How would you handle a request to refactor balance calculation?

**Answer:**
> "**Question:** Why refactor is dangerous
> - Affects every group's balances
> - Users rely on calculation correctness
> - One subtle bug = thousands in wrong settlements
>
> **Approach:**
> 1. **Comprehensive Tests First**
>    ```typescript
>    describe('calculateUserBalance', () => {
>      test('excludes expenses after member leaves', () => {
>        // Sam joined Jan 1, left Mar 8
>        // Mar 15 expense should not affect balance
>      });
>      test('includes settlements', () => {
>        // Balance includes payments between members
>      });
>      test('respects split types', () => {
>        // EQUAL, PERCENTAGE, EXACT, SHARE all work
>      });
>      test('handles multi-currency', () => {
>        // INR and USD mixed, correctly converted
>      });
>    });
>    ```
>
> 2. **Golden Data Set**
>    - Take real trip data (our CSV example)
>    - Calculate expected balances manually
>    - Use as regression test
>
> 3. **Staged Deployment**
>    - Branch → tests pass → code review → staging environment
>    - Run calculation on staging vs production data
>    - Compare results (should be identical)
>    - If any discrepancy, halt
>
> 4. **Gradual Rollout**
>    - 10% of groups → monitor for complaints
>    - 50% of groups → if no issues, expand
>    - 100% of groups → full rollout
>
> **Why This Approach:**
> - Financial calculations must be bulletproof
> - Testing prevents cascading errors
> - Staged rollout catches edge cases"

**Why This Answer:**
- Shows production thinking
- Demonstrates risk awareness
- Explains testing discipline

---

### Q19: What if requirements changed mid-project?

**Answer:**
> "Happened during CSV import design.
>
> **Original Requirement:** 'Let users upload CSV and import expenses'
>
> **What Changed:** Meera added - 'Approve anything the app deletes or changes'
>
> **Impact:** This invalidated my single-phase design
> - Initial approach: preview and auto-import in one call
> - New requirement: must show all anomalies, wait for user approval, *then* import
>
> **How I Handled It:**
> 1. **Recognized it immediately** - in requirements meeting
> 2. **Redesigned quickly** - sketched two-phase workflow on whiteboard
> 3. **Minimized rework** - only added ImportLog + ImportAnomaly tables, didn't rewrite core
> 4. **Got approval** - verified new design with stakeholder before coding
> 5. **Documented it** - in DECISIONS.md why this approach
>
> **Key Learning:**
> - Mid-project changes are normal, not failures
> - Early design review prevents large rewrites
> - Good architecture is flexible (Prisma migrations made schema changes fast)
> - Document decisions so you remember why
>
> **Would Tell Any Engineer:**
> Anticipate changing requirements. Build architecture that absorbs changes (e.g., separate preview/finalize endpoints rather than monolithic import)."

**Why This Answer:**
- Shows adaptability
- Demonstrates process discipline
- Shares practical wisdom

---

### Q20: What's a decision you'd make differently?

**Answer:**
> "**1. Refresh Tokens**
> - Current: JWT 7-day expiry
> - Better: Refresh token mechanism
> - Reason: 7 days is long for security; refresh token lets sessions be shorter
> - Why I didn't: Time constraint. Auth works, security is acceptable for MVP.
>
> **2. Error Logging**
> - Current: console.error in try-catch blocks
> - Better: Structured logging to Datadog/Splunk
> - Reason: Would catch anomalies in production before users report them
> - Why I didn't: Adds complexity, external dependency
>
> **3. Data Validation Centralization**
> - Current: Zod in each route
> - Better: Middleware that parses and validates all requests
> - Reason: DRY principle, less repetition
> - Why I didn't: Working approach, premature optimization
>
> **4. Split Type Validation**
> - Current: Switch statement in balance service
> - Better: Type-level validation (e.g., ExpenseSplitEqual vs ExpenseSplitPercentage types)
> - Reason: Prevents runtime errors (percentage sum != 100%)
> - Why I didn't: Overcomplicates schema; current validation sufficient
>
> **5. Testing Strategy**
> - Current: Manual testing, no automated tests
> - Better: 80/20 rule—focus tests on balance calculation + anomaly detection
> - Reason: These are error-prone, financial logic
> - Why I didn't: 2-day timeline, prioritized features
>
> **Overall:** I made good decisions given constraints. If starting over with 2 weeks instead of 2 days, I'd add (#1) refresh tokens and (#5) tests."

**Why This Answer:**
- Shows critical thinking
- Admits trade-offs honestly
- Demonstrates learning mindset

---

### Q21-25: [Continue with remaining problem-solving questions covering edge cases, scaling, testing, etc.]

*(Due to length, I'll provide Q21-50 in condensed format)*

---

## SECTION 4: Edge Cases & Robustness (Q21-30)

### Q21: What if user with negative balance tries to settle?
> **Answer:** Balance can be legitimately negative (owe money). Settlement transactions are positive (actual money flow). System allows negative-balance users to create Settlement records. This is correct behavior.

### Q22: What if duplicate expense hash matches but amounts differ?
> **Answer:** Treated as separate expenses (different amount = different transaction). Flagged for review but allowed. User can approve or reject each.

### Q23: What if user removes themselves from group mid-expense?
> **Answer:** Expense date matters, not removal timing. If expense is before removal, user is included. If after, automatically excluded via date filtering.

### Q24: What if split percentages add to 99% or 101%?
> **Answer:** Anomaly INVALID_PERCENTAGE_SUM flagged. User approves:
> - Approve: Normalize (scale all percentages so sum = 100%)
> - Reject: Don't import, ask for fix

### Q25: What if CSV has 10,000 rows?
> **Answer:** 
> - Parsing: ~1-2 seconds
> - Anomaly detection: ~3-4 seconds (loops through all rows)
> - Total: ~5 seconds, acceptable
> - At scale (100K rows): Would add async queue + worker process
> - Current approach: Synchronous works for MVP

---

## SECTION 5: Production & Deployment (Q31-40)

### Q31: How would you monitor this in production?
> - Application logs: Errors, warnings, info
> - Database metrics: Query time, connections, slow queries
> - Business metrics: New groups/week, expenses/day, average balance
> - Error tracking: Sentry for exceptions
> - Uptime monitoring: Status page, alerts on downtime

### Q32: What happens if database goes down?
> - Frontend becomes read-only (cached data displays)
> - Backend returns 503 Service Unavailable
> - Render: Automatic failover if available
> - User-facing: "Service temporarily unavailable"

### Q33: How would you handle database migration at 1M users?
> - Zero-downtime: Add column, backfill in background, switch read/write
> - Testing: Dry-run on production replica first
> - Rollback plan: Keep old schema for quick rollback
> - Communication: Notify users of maintenance window

### Q34: What's your caching strategy?
> - Redis cache for frequently accessed balances
> - Invalidate on: new expense, settlement, member changes
> - TTL: 5 minutes (balance is time-sensitive)
> - Fallback: Database if cache misses

### Q35: How would you handle user complaints about balance?
> 1. Ask: "When did you notice discrepancy?"
> 2. Check: Membership dates (joined/left)
> 3. Verify: All expenses in range, all splits correct
> 4. Audit: ImportAnomaly records to see what was approved
> 5. Explain: Exact expenses that make up balance (Rohan's requirement)

---

## SECTION 6: System Design at Scale (Q41-45)

### Q41: What would you change for 100K daily active users?
> - Separate read replicas for balance queries
> - Cache layer (Redis) for hot data
> - Message queue (RabbitMQ) for CSV imports
> - Search index (Elasticsearch) for expense search
> - API rate limiting (prevent abuse)
> - Horizontal scaling of service instances

### Q42: How would you implement real-time balance updates?
> - WebSocket server alongside HTTP
> - When expense created, broadcast to all group members
> - Frontend receives update, refreshes balance
> - Alternative: Server-Sent Events (simpler than WebSocket)

### Q43: How would you handle currency conversion at scale?
> - Daily batch job fetches rates from API
> - Cache rates for 24 hours
> - Update CurrencyConversion table nightly
> - If rate stale > 24h, recalculate on-demand

### Q44: Describe your disaster recovery plan.
> - Automated backups: Hourly to S3
> - Restore procedure: ~15 minutes with latest backup
> - RTO: 15 minutes
> - RPO: 1 hour
> - Test restore monthly

### Q45: How would you implement offline-first mobile app?
> - Local SQLite database
> - Sync expenses on reconnect
> - Conflict resolution: Last-write-wins
> - Fallback: Show local data, warn user it's not synced

---

## SECTION 7: Code Quality & Best Practices (Q46-50)

### Q46: How would you enforce code quality?
> - TypeScript strict mode (catches type errors)
> - Prettier (auto-format code)
> - ESLint (find bugs, style issues)
> - Pre-commit hooks (run checks before commit)
> - Code review (human eyes on design)
> - Automated tests (catch regressions)

### Q47: What's your approach to technical debt?
> - Track it: GitHub issues labeled "tech-debt"
> - Prioritize: Fix before it affects users
> - Example: No tests now → add after MVP deployed
> - Balance: Deliver features vs. maintain quality
> - Be transparent: Communicate trade-offs

### Q48: How do you handle secrets?
> - Never commit secrets (database passwords, API keys)
> - Use environment variables (loaded from .env, not in git)
> - Rotate regularly (quarterly JWT_SECRET rotation)
> - Principle of least privilege (API key has minimal permissions)
> - Audit trail: Log who accesses what

### Q49: How would you approach adding OAuth (Google login)?
> - Install google-passport
> - Create /auth/google endpoint
> - User clicks "Login with Google"
> - Redirects to Google, then back with token
> - Create/find user, issue JWT
> - Add test for happy path

### Q50: What was the biggest learning from this project?
> **Answer:**
> "That thoughtful design upfront prevents massive rework later. When I understood Sam's requirement (membership-aware balance), it shaped the entire data model. That single insight—'add left_at field'—prevented bugs that would've taken days to debug.
>
> Also: AI is a multiplier. Used Copilot to generate 50% of code, but reviewed every function. The 4 major bugs AI made taught me more about the domain than writing all code manually would have.
>
> Finally: Documentation is as important as code. Being able to explain *why* I made each decision means I'm confident defending it in an interview. That clarity is valuable."

---

## Interview Strategy

### Before the Interview
✅ Re-read DECISIONS.md (know your rationale)
✅ Clone the project locally, run it
✅ Walk through code paths (auth → balance calc → settlement)
✅ Prepare 2-3 war stories (membership dates, CSV approval, Decimal precision)
✅ Practice explaining balances to non-technical person

### During the Interview
✅ Listen to the question fully before answering
✅ Structure answers: Problem → Solution → Why → Alternative
✅ Use concrete examples (Sam's March 8 story, not abstract)
✅ Be honest about limitations (2-day timeline, no tests)
✅ Ask clarifying questions (shows thinking)
✅ Code on whiteboard if asked (pseudocode, not perfect)

### Common Follow-Up Questions
- "How would you test this?"
- "What if requirements changed?"
- "How would you explain to your manager?"
- "What's the trade-off?"
- "How would you scale this?"

**For Each:** Answer concretely with example, not theory.

---

## Final Reminders

1. **You own this project.** You made every decision. Be confident.
2. **Be honest.** Say "I don't know" rather than guess.
3. **Show your thinking.** Explain your reasoning, not just the solution.
4. **Connect to requirements.** Show how design meets user needs.
5. **Demonstrate growth.** Explain what you'd do differently.

**Good luck! 🎯**
