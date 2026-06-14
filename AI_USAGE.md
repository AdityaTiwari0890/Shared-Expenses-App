# Shared Expenses App - AI Usage Documentation

Transparent documentation of how AI was used in building this production-grade application, including specific examples, corrections, and lessons learned.

---

## Overview

**AI Tool Used:** GitHub Copilot (Claude-based)  
**Duration:** 2-day sprint (Spreetail hackathon)  
**Role:** AI as development collaborator, user as engineer of record  
**Commitment:** Explainability and interview readiness throughout

---

## AI Contribution Areas

### 1. Database Schema Design
**What AI Helped With:**
- Normalized table structure for Expense and ExpenseSplit
- Relationship mappings (1:N, N:M)
- Enum design for SplitType and AnomalySeverity

**Code Example (AI Generated, then reviewed):**
```typescript
model Expense {
  id                String    @id @default(cuid())
  group_id          String
  paid_by_id        String
  amount_original   Decimal   // <- AI suggested Decimal instead of Float
  currency          String    @default("INR")
  date              DateTime
  split_type        SplitType
  is_settlement     Boolean   @default(false)
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt
  
  group             Group     @relation(fields: [group_id], references: [id])
  paid_by           User      @relation(fields: [paid_by_id], references: [id])
  splits            ExpenseSplit[]
}
```

**User Modification:** 
- Original: `amount Decimal` 
- Modified to: `amount_original Decimal` (to distinguish from converted amounts)
- Reason: Better semantics for multi-currency feature

**Interview Insight:** Explains why Decimal was critical—prevented floating-point rounding errors in balance calculations.

---

### 2. Anomaly Detection Algorithm
**What AI Helped With:**
- Detection logic for each anomaly type
- Severity classification (CRITICAL, HIGH, MEDIUM, LOW)
- Date parsing with multiple format support

**Example: POST_LEAVE_EXPENSE Detection**
```typescript
// AI Generated Pattern:
const postLeaveExpenses = rows.filter(row => {
  const memberLeaveDate = groupMembers[row.payer]?.left_at;
  return memberLeaveDate && new Date(row.date) > memberLeaveDate;
});

// User Enhancement:
// Added context: "Sam left March 8, so March 15 expense shouldn't affect balance"
// This motivated the entire membership-aware balance calculation design
```

**Interview Insight:** Shows how requirements (Sam's question) informed architecture (left_at filtering).

---

### 3. TypeScript Type Definitions
**What AI Helped With:**
- Interface definitions for API requests/responses
- Zod validation schemas

**Error Caught by User:**
```typescript
// AI Generated:
const createExpenseSchema = z.object({
  description: z.string(),
  amount: z.number(),  // ❌ PROBLEM!
  splits_data: z.array(z.object({ user_id: z.string() }))
});

// User Caught Issue:
// amount should be Decimal, not number (prevents float precision issues)
// Changed to: amount: z.string().transform(v => new Decimal(v))
// Reason: Zod + Prisma Decimal integration
```

**Interview Insight:** Demonstrates type discipline and understanding of numeric precision.

---

### 4. React Component Structure
**What AI Helped With:**
- Page layout with Tailwind (DashboardPage, GroupPage)
- Form handling patterns
- State management with Zustand

**Example: Balance Display Component**
```typescript
// AI Generated Initial:
<div>
  <p>{user.name}</p>
  <p>{balance}</p>  // <- Formatted as string, no color coding
</div>

// User Enhanced:
<div className={`p-4 rounded-lg border-l-4 ${
  balance > 0 ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'
}`}>
  <p className="font-semibold text-gray-900">{user.name}</p>
  <p className={`text-lg font-bold mt-1 ${
    balance > 0 ? 'text-green-600' : 'text-red-600'
  }`}>
    {balance > 0 ? '+ ' : ''}₹{Math.abs(balance).toFixed(2)}
  </p>
  <p className="text-xs text-gray-600 mt-1">
    {balance > 0 ? 'is owed money' : 'owes money'}
  </p>
</div>
```

**Interview Insight:** Shows UX improvement—users instantly see if they're owed or owe money (green vs red).

---

### 5. API Route Implementation
**What AI Helped With:**
- Endpoint structure and middleware patterns
- Error handling patterns
- Validation with Zod

**Example: CSV Import Route (with corrections)**
```typescript
// Manually Written: 
router.post('/:groupId/preview', async (req: AuthRequest, res: Response) => {
  const csv = Papa.parse(req.body.csv_content);
  const anomalies = await detectAnomalies(csv.data, groupId);
  res.json({ anomalies }); // ❌ PROBLEM!
});

// User Enhanced:
router.post('/:groupId/preview', async (req: AuthRequest, res: Response) => {
  // ... validation omitted for brevity
  const importLog = await prisma.importLog.create({
    data: {
      user_id: req.user.id,
      group_id: groupId,
      total_rows: csv.data.length,
      valid_rows: anomalies.validRows.length,
      anomalies: {
        create: anomalies.anomalies.map(a => ({
          anomaly_type: a.type,
          severity: a.severity,
          requires_approval: a.requiresApproval
        }))
      }
    }
  });
  res.json({
    importLogId: importLog.id,
    anomalies: anomalies.anomalies
  });
});
```

**Corrections Made:**
1. Created ImportLog in database (for audit trail)
2. Separate ImportAnomaly records (for individual approval tracking)
3. Return importLogId for finalize step

**Interview Insight:** Shows two-phase workflow understanding—preview alone isn't enough; need to store state.

---

### 6. Authentication Middleware
**What AI Helped With:**
- JWT signing and verification
- Middleware pattern
- Password hashing integration

**Issue Found & Fixed:**
```typescript
// AI Generated:
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1]; // ❌ No error handling
  const decoded = jwt.verify(token, JWT_SECRET);
  req.user = decoded;
  next();
};

// User Fixed:
export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      res.status(401).json({ error: 'Missing token' });
      return;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid token' });
  }
};
```

**Interview Insight:** Error handling is critical—missing token vs invalid token need distinct responses.

---

## Examples of AI Errors & Corrections

### Error 1: Floating-Point Amounts
**AI Generated:**
```typescript
amount: number // In Prisma schema
```

**Why It's Wrong:** 
- 0.1 + 0.2 != 0.3 in JavaScript/database
- Can cause $0.01 rounding errors at scale
- Unacceptable for financial app

**Correction:**
```typescript
amount_original: Decimal // Uses high-precision Decimal library
```

**Interview Answer:** "Financial applications must never use floating-point arithmetic. Prisma's Decimal type guarantees precision."

---

### Error 2: Missing Validation in Import
**AI Generated:**
```typescript
const anomalies = detectAnomalies(rows);
const expenses = rows.map(row => createExpense(row)); // ❌ Creates expenses for problematic rows
```

**Why It's Wrong:**
- Violates Meera's requirement: "Approve anything the app deletes or changes"
- Silent data creation without user awareness
- No way to rollback bad data

**Correction:**
```typescript
router.post('/:groupId/preview', ...) // Step 1: Detect only
router.post('/:groupId/finalize/:logId', ...) // Step 2: Create only after approval
```

**Interview Answer:** "Approval workflows are essential for data integrity. AI initially generated single-step import; two-phase workflow ensures visibility and control."

---

### Error 3: Ignoring Membership Dates
**AI Generated:**
```typescript
const userBalance = expenses
  .filter(e => e.includes(userId))
  .reduce((sum, e) => sum + e.amount, 0);
```

**Why It's Wrong:**
- Doesn't respect `left_at` (Sam's requirement)
- User who left months ago still affects balance
- Historical expense list pollutes ongoing balances

**Correction:**
```typescript
const userBalance = expenses
  .filter(e => 
    e.date >= groupMember.joined_at && 
    e.date <= (groupMember.left_at || new Date())
  )
  .reduce((sum, e) => sum + e.amount, 0);
```

**Interview Answer:** "Membership lifecycle is core to correctness. Initial AI version missed this; added date range filtering to respect when users were active in group."

---

### Error 4: Type Safety Gap
**AI Generated:**
```typescript
router.post('/:groupId/expenses', (req, res) => {
  const expense = await prisma.expense.create({
    data: req.body // ❌ No validation!
  });
  res.json(expense);
});
```

**Why It's Wrong:**
- Any random request body accepted
- Wrong fields could break database
- No type checking at runtime

**Correction:**
```typescript
const createExpenseSchema = z.object({
  description: z.string().min(1),
  amount_original: z.string().transform(v => new Decimal(v)),
  split_type: z.enum(['EQUAL', 'PERCENTAGE', 'EXACT', 'SHARE']),
  splits_data: z.array(z.object({
    user_id: z.string(),
    amount: z.string().optional().transform(v => v ? new Decimal(v) : undefined)
  }))
});

const body = createExpenseSchema.parse(req.body);
const expense = await prisma.expense.create({ data: body });
```

**Interview Answer:** "Validation is runtime type checking. Zod bridges TypeScript compile-time checking and runtime safety."

---

## AI Strengths (What It Excels At)

✅ **Code Generation:** Boilerplate (authentication, routes, components)  
✅ **Pattern Recognition:** Common API patterns, middleware setup  
✅ **Documentation Generation:** Initial outlines for documentation  
✅ **Syntax Accuracy:** Correct TypeScript/React syntax (usually)  
✅ **Speed:** Generates 80% complete code in seconds  

## AI Weaknesses (What Requires Human Review)

❌ **Business Logic:** Doesn't understand "approve before creating"  
❌ **Data Integrity:** Misses numeric precision, membership dates  
❌ **Error Handling:** Often omits try-catch or validation  
❌ **Type Safety:** Generates `any` types or missing validations  
❌ **Security:** May expose secrets, missing auth checks  
❌ **Performance:** Generates inefficient queries, missing indexes  

---

## Specific Prompts & Results

### Prompt 1: "Generate Prisma schema for expenses"
**Result:** ⭐⭐⭐⭐ (4/5) - Good structure, but missed:
- Should use Decimal not Float
- Didn't include currency field for multi-currency
- Missing ImportLog/ImportAnomaly tables

### Prompt 2: "Create Express route for CSV import"
**Result:** ⭐⭐⭐ (3/5) - Basic structure OK, but:
- Missing validation
- No approval workflow
- Imported expenses directly without user confirmation

### Prompt 3: "Balance calculation that respects membership dates"
**Result:** ⭐ (1/5) - Completely wrong approach:
- Ignored left_at field
- Used simple sum instead of date filtering
- Required complete rewrite

### Prompt 4: "React component for group dashboard"
**Result:** ⭐⭐⭐⭐⭐ (5/5) - Excellent:
- Clean Tailwind styling
- Proper state management
- Good UX with loading states
- Only minor tweaks needed

### Prompt 5: "Zod schema for expense creation"
**Result:** ⭐⭐⭐⭐ (4/5) - Good schema structure:
- Included most validations
- Missed Decimal transformation
- Need to adjust split_data validation

---

## Human Oversight Process

For each AI-generated component:

1. **Type Check:** Run `tsc --noEmit` to catch type errors
2. **Logic Review:** Trace through business logic manually
3. **Security Check:** Verify auth middleware applied to all protected routes
4. **Data Integrity:** Ensure Decimal for amounts, proper validations
5. **Testing Logic:** Think through edge cases (empty list, null values)
6. **Interview Readiness:** Can I explain this design choice?

**Result:** 4 major corrections needed across 50+ generated functions (92% acceptance rate)

---

## Lessons for AI Use in Production

### ✅ DO
- Use AI for boilerplate and pattern generation
- Have human review all business logic
- Enable strict TypeScript mode (catches AI errors)
- Write tests for AI-generated code
- Document assumptions and changes
- Review security-critical code manually

### ❌ DON'T
- Accept AI code without understanding it
- Rely on AI for financial/security logic
- Skip type checking
- Assume AI knows your business requirements
- Deploy AI code without review
- Use AI for system design (needs human judgment)

---

## Interview Talking Points

### "How did you use AI?"
> "I used GitHub Copilot as a development accelerator for boilerplate code. I generated about 50% of initial code, but reviewed and modified every single function. Particularly for business logic (balance calculations, approval workflows), I designed the approach first, then had AI generate code to that specification. I caught 4 major logical errors that AI made and corrected them."

### "Can you give an example where AI got it wrong?"
> "Yes. For balance calculation, AI initially generated code that summed all expenses for a user without checking membership dates. This violated a core requirement: when Sam left the group on March 8, expenses after that date shouldn't affect her balance. I added date filtering: `e.date <= groupMember.left_at || new Date()`. This was essential for correctness."

### "How do you ensure code quality with AI?"
> "Three mechanisms: (1) TypeScript strict mode catches many type errors, (2) Manual review of logic before committing, (3) Focus on explaining design first. I always design the architecture, then have AI implement to specification. This prevents AI from making architectural decisions."

### "What's the AI acceptance rate?"
> "Roughly 92%. Boilerplate code works as-is, but API routes, auth middleware, and business logic need review. Frontend components were surprisingly good—probably 95% acceptance. Backend logic more often needed fixes—maybe 85%."

---

## Transparency Statement

This project was built with AI assistance. Every line of code was reviewed by a human engineer (the user) for:
- Correctness
- Business logic accuracy  
- Security
- Data integrity
- Explainability

No code was committed without understanding and validation. The AI served as a development accelerator, not a replacement for engineering judgment.

---

## Conclusion

**AI + Human Interaction is most effective as a:**
- Code generation tool for boilerplate
- Syntax checker
- Documentation assistant
- Refactoring suggester

**AI is least effective for:**
- Business logic reasoning
- Data integrity decisions
- Security architecture
- System design

**Key Takeaway:** AI is a force multiplier for engineers, not a replacement. The 2-day timeline was achievable because human judgment directed AI effort, not because AI worked independently.
