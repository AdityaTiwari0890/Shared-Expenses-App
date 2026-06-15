# Shared Expenses App

A simple shared expenses tracker with a React frontend and Express backend.

## Features

- Add expenses with title, amount, payer, and date
- View all expenses and total amount
- Delete expenses
- Backend persistence using a JSON file
- Vite-powered React frontend with API proxy to Express

## Live Preview 
<img width="1530" height="773" alt="image" src="https://github.com/user-attachments/assets/2715af19-c54c-4f2b-91a3-2e8d3ee5f3db" />
<img width="1533" height="773" alt="image" src="https://github.com/user-attachments/assets/524438d5-f15f-40e4-b6bf-bc5383502522" />
<img width="1525" height="825" alt="image" src="https://github.com/user-attachments/assets/e1f48ce8-aa89-4403-9e29-74f2b599b3ea" />
<img width="1536" height="778" alt="image" src="https://github.com/user-attachments/assets/4b0cdfdf-42c8-4718-9403-b129ab4f73c5" />
<img width="1535" height="775" alt="image" src="https://github.com/user-attachments/assets/c49ebd86-19f1-4558-9399-31202adf36ae" />

<img width="1536" height="863" alt="Screenshot 2026-06-15 040208" src="https://github.com/user-attachments/assets/72445c7d-7bde-43d5-84bb-369542c9cb0e" />
<img width="1536" height="863" alt="Screenshot 2026-06-15 040215" src="https://github.com/user-attachments/assets/48ce608d-758b-460e-8e6d-9934420cdb9f" />
<img width="1512" height="817" alt="Screenshot 2026-06-15 024627" src="https://github.com/user-attachments/assets/9c8c130b-4ba1-44a3-8c23-06bc8bca0858" />



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
