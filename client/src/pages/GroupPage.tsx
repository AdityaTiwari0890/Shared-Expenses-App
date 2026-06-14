import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, DollarSign, X, Trash2, Download } from 'lucide-react';
import { expensesAPI, groupsAPI } from '../lib/api';
import { useAuthStore } from '../lib/store';

interface Expense {
  id: string;
  description: string;
  amount_original: number;
  currency: string;
  date: string;
  paid_by_id: string;
  notes?: string | null;
  paid_by: { first_name: string; last_name: string };
  splits: Array<{ user_id: string; amount_owed: number }>;
}

interface Balance {
  userId: string;
  userName: string;
  balance: string;
}

interface PaymentSummary {
  oweToOthers: string;
  othersOweMe: string;
  netToPay: string;
  netToReceive: string;
}

interface GroupMember {
  user_id: string;
  left_at: string | null;
  user: { first_name: string; last_name: string };
}

function getPayerDisplayName(expense: Expense): string {
  const fallback = `${expense.paid_by.first_name} ${expense.paid_by.last_name}`;
  const match = expense.notes?.match(/\[payer_display:([^\]]+)\]/);
  return match?.[1]?.trim() || fallback;
}

function getMyShare(expense: Expense, userId?: string): number {
  if (!userId) return 0;
  const split = expense.splits?.find((s) => s.user_id === userId);
  return split ? Number(split.amount_owed) : 0;
}

function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    currency: 'INR',
    notes: '',
  });

  useEffect(() => {
    if (groupId) {
      fetchData();
    }
  }, [groupId]);

  const fetchData = async () => {
    if (!groupId) return;

    try {
      const [expensesRes, balancesRes, groupRes, myBalanceRes] = await Promise.all([
        expensesAPI.getExpenses(groupId),
        expensesAPI.getBalances(groupId),
        groupsAPI.getGroup(groupId),
        expensesAPI.getMyBalance(groupId),
      ]);
      setExpenses(expensesRes.data.expenses ?? []);
      setBalances(balancesRes.data.balances ?? []);
      setMembers(groupRes.data.group?.members ?? []);
      setPaymentSummary(myBalanceRes.data.summary ?? null);
    } catch (err) {
      console.error('Failed to fetch group data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeMembers = members.filter((m) => !m.left_at);

  const buildEqualSplits = (totalAmount: number) => {
    const count = activeMembers.length;
    if (count === 0) return [];

    const baseShare = Math.floor((totalAmount / count) * 100) / 100;
    return activeMembers.map((member, index) => {
      const amount =
        index === count - 1
          ? Math.round((totalAmount - baseShare * (count - 1)) * 100) / 100
          : baseShare;
      return { user_id: member.user_id, amount };
    });
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId) return;

    setError('');
    setIsSubmitting(true);

    const amount = parseFloat(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Please enter a valid amount');
      setIsSubmitting(false);
      return;
    }

    if (activeMembers.length === 0) {
      setError('No active members in this group');
      setIsSubmitting(false);
      return;
    }

    try {
      await expensesAPI.createExpense(groupId, {
        description: form.description,
        amount_original: amount,
        currency: form.currency,
        date: form.date,
        split_type: 'EQUAL',
        splits_data: buildEqualSplits(amount),
        notes: form.notes || undefined,
      });

      setForm({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        currency: 'INR',
        notes: '',
      });
      setShowAddForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!groupId) return;

    setError('');
    setIsDeleting(true);
    setDeletingExpenseId(expenseId);
    try {
      await expensesAPI.deleteExpense(groupId, expenseId);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete expense');
    } finally {
      setIsDeleting(false);
      setDeletingExpenseId(null);
    }
  };

  const handleExportCSV = async () => {
    if (!groupId) return;

    try {
      const response = await expensesAPI.exportCSV(groupId);
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `expenses-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to export CSV');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
          >
            <ArrowLeft size={20} />
            Back to Groups
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Group Details</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 btn-secondary"
            >
              <Download size={20} />
              Export CSV
            </button>
            <button
              onClick={() => navigate(`/groups/${groupId}/import`)}
              className="flex items-center gap-2 btn-primary"
            >
              <Upload size={20} />
              Import CSV
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {showAddForm && (
              <div className="card">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">Add Expense</h2>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setError('');
                    }}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <X size={24} />
                  </button>
                </div>

                <form onSubmit={handleAddExpense} className="space-y-4">
                  {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="input-field"
                      placeholder="e.g., Groceries, Dinner, Rent"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={form.amount}
                        onChange={(e) => setForm({ ...form, amount: e.target.value })}
                        className="input-field"
                        placeholder="0.00"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                      <input
                        type="date"
                        value={form.date}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                        className="input-field"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Notes (Optional)</label>
                    <input
                      type="text"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="input-field"
                      placeholder="Any extra details"
                    />
                  </div>

                  <p className="text-sm text-gray-600">
                    Split equally among {activeMembers.length} member(s)
                  </p>

                  <div className="flex gap-4">
                    <button type="submit" className="btn-primary disabled:opacity-50" disabled={isSubmitting}>
                      {isSubmitting ? 'Saving...' : 'Save Expense'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddForm(false);
                        setError('');
                      }}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
                {!showAddForm && (
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-2 btn-primary"
                  >
                    <Plus size={20} />
                    Add Expense
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              {expenses.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <p className="mb-4">No expenses yet. Start by adding one!</p>
                  {!showAddForm && (
                    <button onClick={() => setShowAddForm(true)} className="btn-primary">
                      Add Your First Expense
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {expenses.map((expense) => {
                    const total = Number(expense.amount_original);
                    const myShare = getMyShare(expense, user?.id);
                    const payerName = getPayerDisplayName(expense);
                    const splitCount = expense.splits?.length ?? 0;

                    return (
                      <div key={expense.id}>
                        <div
                          className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h3 className="font-semibold text-gray-900">{expense.description}</h3>
                              <p className="text-sm text-gray-600 mt-1">
                                Paid by <span className="font-medium">{payerName}</span>
                              </p>
                              <p className="text-xs text-gray-500 mt-1">
                                {new Date(expense.date).toLocaleDateString()}
                                {splitCount > 1 && ` · Split among ${splitCount} people`}
                              </p>
                            </div>
                            <div className="text-right shrink-0 flex flex-col items-end gap-2">
                              <div>
                                <p className="text-xs text-gray-500">
                                  Total {expense.currency} {total.toFixed(2)}
                                </p>
                                <p className="text-lg font-bold text-gray-900 mt-1">
                                  You pay ₹{myShare.toFixed(2)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                disabled={isDeleting}
                                className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50 text-sm font-medium transition"
                              >
                                <Trash2 size={16} />
                                {deletingExpenseId === expense.id && isDeleting ? 'Deleting...' : 'Delete'}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            {paymentSummary && (
              <div className="card border-2 border-blue-200 bg-blue-50">
                <h2 className="text-xl font-bold text-gray-900 mb-4">Your Payment Summary</h2>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Owed on others&apos; expenses</span>
                    <span className="font-medium text-red-600">
                      ₹{parseFloat(paymentSummary.oweToOthers).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Others owe on your expenses</span>
                    <span className="font-medium text-green-600">
                      ₹{parseFloat(paymentSummary.othersOweMe).toFixed(2)}
                    </span>
                  </div>
                  <div className="border-t border-blue-200 pt-3 flex justify-between items-center">
                    <span className="font-semibold text-gray-900">Total left to pay</span>
                    <span className="text-xl font-bold text-red-600">
                      ₹{parseFloat(paymentSummary.netToPay).toFixed(2)}
                    </span>
                  </div>
                  {parseFloat(paymentSummary.netToReceive) > 0 && (
                    <div className="flex justify-between">
                      <span className="font-semibold text-gray-900">Total to receive</span>
                      <span className="text-lg font-bold text-green-600">
                        ₹{parseFloat(paymentSummary.netToReceive).toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="card">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <DollarSign size={24} />
                Balances
              </h2>

              {balances.length === 0 ? (
                <p className="text-gray-600 text-center py-8">No members yet</p>
              ) : (
                <div className="space-y-4">
                  {balances.map((balance) => {
                    const amount = parseFloat(balance.balance);
                    const isPositive = amount > 0;
                    const isCurrentUser = balance.userId === user?.id;

                    return (
                      <div
                        key={balance.userId}
                        className={`p-4 rounded-lg border-l-4 ${
                          isCurrentUser
                            ? 'bg-blue-50 border-blue-500'
                            : isPositive
                            ? 'bg-green-50 border-green-500'
                            : amount < 0
                            ? 'bg-red-50 border-red-500'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">
                          {balance.userName}
                          {isCurrentUser && <span className="text-xs text-blue-600 ml-2">(You)</span>}
                        </p>
                        <p
                          className={`text-lg font-bold mt-1 ${
                            isPositive
                              ? 'text-green-600'
                              : amount < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {isPositive ? '+ ' : amount < 0 ? '- ' : ''}₹{Math.abs(amount).toFixed(2)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          {isPositive
                            ? 'is owed money'
                            : amount < 0
                            ? 'owes money'
                            : 'all settled'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default GroupPage;
