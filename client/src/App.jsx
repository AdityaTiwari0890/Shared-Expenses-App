import { useEffect, useState } from 'react';

function App() {
  const [expenses, setExpenses] = useState([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [payer, setPayer] = useState('');
  const [date, setDate] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExpenses();
  }, []);

  async function fetchExpenses() {
    const response = await fetch('/api/expenses');
    const data = await response.json();
    setExpenses(data);
  }

  async function handleAdd(event) {
    event.preventDefault();
    if (!title || !amount || !payer) {
      setError('Title, amount and payer are required.');
      return;
    }

    const response = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, amount, payer, date })
    });

    if (response.ok) {
      setTitle('');
      setAmount('');
      setPayer('');
      setDate('');
      setError('');
      fetchExpenses();
      return;
    }

    const payload = await response.json();
    setError(payload.error || 'Could not add the expense.');
  }

  async function handleDelete(id) {
    await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    fetchExpenses();
  }

  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="app-shell">
      <header>
        <h1>Shared Expenses</h1>
        <p>Track group expenses, split costs, and stay organized.</p>
      </header>

      <main>
        <section className="form-card">
          <h2>Add Expense</h2>
          {error && <div className="error">{error}</div>}
          <form onSubmit={handleAdd}>
            <label>
              Title
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dinner" />
            </label>
            <label>
              Amount
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
            </label>
            <label>
              Paid by
              <input value={payer} onChange={e => setPayer(e.target.value)} placeholder="e.g. Me" />
            </label>
            <label>
              Date
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </label>
            <button type="submit">Add Expense</button>
          </form>
        </section>

        <section className="list-card">
          <div className="summary">
            <h2>Expenses</h2>
            <div className="total">Total: ₹{total.toFixed(2)}</div>
          </div>

          {expenses.length === 0 ? (
            <p className="empty-state">No expenses recorded yet.</p>
          ) : (
            <ul>
              {expenses.map(expense => (
                <li key={expense.id}>
                  <div>
                    <strong>{expense.title}</strong>
                    <span>{expense.payer}</span>
                  </div>
                  <div>
                    <span>₹{Number(expense.amount).toFixed(2)}</span>
                    <span>{expense.date}</span>
                    <button onClick={() => handleDelete(expense.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
