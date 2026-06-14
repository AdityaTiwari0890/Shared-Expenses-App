import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Upload, Users, DollarSign } from 'lucide-react';
import { expensesAPI, settlementsAPI } from '../lib/api';

interface Expense {
  id: string;
  description: string;
  amount_original: number;
  currency: string;
  date: string;
  paid_by: { first_name: string; last_name: string };
  splits: Array<{ user_id: string; amount_owed: number }>;
}

interface Balance {
  userId: string;
  userName: string;
  balance: string;
}

function GroupPage() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (groupId) {
      fetchData();
    }
  }, [groupId]);

  const fetchData = async () => {
    try {
      const [expensesRes, balancesRes] = await Promise.all([
        expensesAPI.getExpenses(groupId!),
        expensesAPI.getBalances(groupId!)
      ]);
      setExpenses(expensesRes.data.expenses);
      setBalances(balancesRes.data.balances);
    } catch (err) {
      console.error('Failed to fetch group data:', err);
    } finally {
      setIsLoading(false);
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
      {/* Header */}
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
          <button
            onClick={() => navigate(`/groups/${groupId}/import`)}
            className="flex items-center gap-2 btn-primary"
          >
            <Upload size={20} />
            Import CSV
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Expenses */}
          <div className="lg:col-span-2">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Expenses</h2>
                <button className="flex items-center gap-2 btn-primary">
                  <Plus size={20} />
                  Add Expense
                </button>
              </div>

              {expenses.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  No expenses yet. Start by adding one!
                </div>
              ) : (
                <div className="space-y-4">
                  {expenses.map((expense) => (
                    <div
                      key={expense.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-gray-900">{expense.description}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Paid by {expense.paid_by.first_name} {expense.paid_by.last_name}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {new Date(expense.date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">
                            {expense.currency} {Number(expense.amount_original).toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Balances */}
          <div className="lg:col-span-1">
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

                    return (
                      <div
                        key={balance.userId}
                        className={`p-4 rounded-lg border-l-4 ${
                          isPositive
                            ? 'bg-green-50 border-green-500'
                            : amount < 0
                            ? 'bg-red-50 border-red-500'
                            : 'bg-gray-50 border-gray-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-900">{balance.userName}</p>
                        <p
                          className={`text-lg font-bold mt-1 ${
                            isPositive
                              ? 'text-green-600'
                              : amount < 0
                              ? 'text-red-600'
                              : 'text-gray-600'
                          }`}
                        >
                          {isPositive ? '+ ' : ''}₹{Math.abs(amount).toFixed(2)}
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
