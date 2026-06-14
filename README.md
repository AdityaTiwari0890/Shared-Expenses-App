# Shared Expenses App

A simple shared expenses tracker with a React frontend and Express backend.

## Features

- Add expenses with title, amount, payer, and date
- View all expenses and total amount
- Delete expenses
- Backend persistence using a JSON file
- Vite-powered React frontend with API proxy to Express

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the backend and frontend separately:
   ```bash
   npm --prefix server run dev
   npm --prefix client run dev
   ```

3. Build the frontend:
   ```bash
   npm --prefix client run build
   ```

## Deployment

- The frontend build is generated in `client/dist`.
- The backend serves API requests at `http://localhost:4000`.
