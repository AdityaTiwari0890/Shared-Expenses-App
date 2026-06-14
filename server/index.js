const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const dataFile = path.join(__dirname, 'expenses.json');

app.use(cors());
app.use(express.json());

function readExpenses() {
  try {
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return [];
  }
}

function writeExpenses(expenses) {
  fs.writeFileSync(dataFile, JSON.stringify(expenses, null, 2), 'utf8');
}

app.get('/api/expenses', (req, res) => {
  const expenses = readExpenses();
  res.json(expenses);
});

app.post('/api/expenses', (req, res) => {
  const { title, amount, payer, date } = req.body;
  if (!title || !amount || !payer) {
    return res.status(400).json({ error: 'Title, amount, and payer are required.' });
  }

  const expenses = readExpenses();
  const newExpense = {
    id: Date.now().toString(),
    title,
    amount: Number(amount),
    payer,
    date: date || new Date().toISOString().split('T')[0]
  };

  writeExpenses([newExpense, ...expenses]);
  res.status(201).json(newExpense);
});

app.delete('/api/expenses/:id', (req, res) => {
  const id = req.params.id;
  const expenses = readExpenses();
  const filtered = expenses.filter(expense => expense.id !== id);
  writeExpenses(filtered);
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
