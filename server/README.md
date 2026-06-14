# Shared Expenses Backend

## Environment Variables Required

```
DATABASE_URL=postgresql://user:password@localhost:5432/shared_expenses
JWT_SECRET=your-secret-key-change-in-production
NODE_ENV=development
PORT=4000
```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Setup PostgreSQL database

3. Create `.env` file with DATABASE_URL

4. Run migrations:
   ```bash
   npm run db:push
   ```

5. Start development server:
   ```bash
   npm run dev
   ```

## API Structure

- `/api/auth` - Authentication endpoints
- `/api/users` - User management
- `/api/groups` - Group management
- `/api/expenses` - Expense operations
- `/api/settlements` - Settlement operations
- `/api/import` - CSV import endpoint
