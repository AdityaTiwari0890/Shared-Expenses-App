import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { groupsAPI } from '../lib/api';
import { useAuthStore } from '../lib/store';
import { LogOut, Plus, Users } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description?: string;
  members?: Array<{ user_id: string }>;
  _count?: { expenses: number };
}

function DashboardPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDesc, setNewGroupDesc] = useState('');
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  useEffect(() => {
    fetchGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const { data } = await groupsAPI.getGroups();
      setGroups(Array.isArray(data.groups) ? data.groups : []);
    } catch (err) {
      console.error('Failed to fetch groups:', err);
      setGroups([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsCreating(true);

    try {
      await groupsAPI.createGroup({
        name: newGroupName,
        description: newGroupDesc || undefined,
      });
      setNewGroupName('');
      setNewGroupDesc('');
      setShowCreateForm(false);
      await fetchGroups();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setIsCreating(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shared Expenses</h1>
            <p className="text-gray-600 text-sm mt-1">Welcome, {user?.first_name}!</p>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {showCreateForm && (
          <div className="card mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Group</h2>
            <form onSubmit={handleCreateGroup} className="space-y-4">
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Group Name</label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="input-field"
                  required
                  placeholder="e.g., Apartment, Trip, Project"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                <input
                  type="text"
                  value={newGroupDesc}
                  onChange={(e) => setNewGroupDesc(e.target.value)}
                  className="input-field"
                  placeholder="What is this group for?"
                />
              </div>
              <div className="flex gap-4">
                <button type="submit" className="btn-primary disabled:opacity-50" disabled={isCreating}>
                  {isCreating ? 'Creating...' : 'Create Group'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
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

        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">Your Groups</h2>
            {!showCreateForm && (
              <button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2 btn-primary"
              >
                <Plus size={20} />
                New Group
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="text-center py-12 text-gray-600">Loading groups...</div>
          ) : groups.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600 mb-4">You haven't joined any groups yet.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="btn-primary"
              >
                Create Your First Group
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <div
                  key={group.id}
                  onClick={() => navigate(`/groups/${group.id}`)}
                  className="card cursor-pointer hover:shadow-lg transition-shadow"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{group.name}</h3>
                      {group.description && (
                        <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-gray-700">
                      <Users size={18} />
                      <span>{group.members?.length ?? 0} members</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      {group._count?.expenses ?? 0} expenses tracked
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/groups/${group.id}`);
                    }}
                    className="mt-4 w-full btn-secondary"
                  >
                    View Details
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DashboardPage;
