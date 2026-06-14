# Shared Expenses App - Frontend

Production-grade React + TypeScript frontend for the Shared Expenses platform.

## Features

- 🔐 **Authentication** - JWT-based login/register with secure token storage
- 👥 **Group Management** - Create groups, invite members, track membership lifecycle
- 💰 **Expense Tracking** - Add expenses with flexible split types (equal, percentage, exact, shares)
- 📊 **Balance Dashboard** - Real-time balance calculations showing who owes whom
- 📤 **CSV Import** - Bulk import with anomaly detection and approval workflow
- 🎯 **Explain Balances** - Detailed breakdown of each balance with expense history

## Stack

- React 18 with TypeScript (strict mode)
- Vite for fast development
- TailwindCSS for styling
- Zustand for state management
- Axios for API calls with interceptors
- React Router for navigation
- Lucide React for icons

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (runs on http://localhost:5173)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
client/
├── src/
│   ├── pages/
│   │   ├── LoginPage.tsx         # Authentication form
│   │   ├── RegisterPage.tsx      # User registration
│   │   ├── DashboardPage.tsx     # Group listing and management
│   │   ├── GroupPage.tsx         # Expense and balance views
│   │   └── ImportPage.tsx        # CSV import with anomaly detection
│   ├── lib/
│   │   ├── api.ts                # API client and endpoints
│   │   └── store.ts              # Zustand auth state store
│   ├── index.css                 # Global TailwindCSS styles
│   ├── App.tsx                   # Main router
│   └── main.tsx                  # React entry point
├── index.html                    # HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
└── postcss.config.js
```

## API Integration

The frontend connects to the backend API running on `http://localhost:4000/api`.

Key endpoints:
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /groups` - Create group
- `GET /groups` - List user's groups
- `POST /groups/:id/expenses` - Add expense
- `GET /groups/:id/balances` - Get group balances
- `POST /import/:id/preview` - Preview CSV import
- `POST /import/:id/finalize/:logId` - Finalize import

## Production Deployment

Deploy to Vercel:

```bash
npm run build
# Deploy dist/ directory to Vercel
```

Set environment variable in Vercel:
```
VITE_API_BASE=https://your-backend-domain.com/api
```
