import { useEffect, useState, useCallback } from 'react';
import { Ban, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi } from '../../api/endpoints.js';
import { showApiError } from '../../api/axios.js';
import { formatDate } from '../../utils/format.js';
import Spinner from '../../components/ui/Spinner.jsx';
import Badge from '../../components/ui/Badge.jsx';

const ROLES = ['all', 'customer', 'admin', 'superadmin'];

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');

  const load = useCallback(() => {
    setLoading(true);
    adminApi.users().then((r) => setUsers(r.data.data)).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggle = async (id) => {
    try { const { data } = await adminApi.toggleBlock(id); toast.success(data.message); load(); }
    catch (e) { showApiError(e); }
  };

  const q = search.trim().toLowerCase();
  const filtered = users.filter((u) => {
    const matchesRole = role === 'all' || u.role === role;
    const matchesSearch = !q
      || u.fullName.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q);
    return matchesRole && matchesSearch;
  });

  if (loading) return <div className="flex justify-center py-16"><Spinner className="h-8 w-8" /></div>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Users</h1>
        <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="input w-56"
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className="input w-auto">
            {ROLES.map((r) => (
              <option key={r} value={r}>{r === 'all' ? 'All roles' : r}</option>
            ))}
          </select>
        </div>
      </div>

      <p className="mb-2 text-sm text-gray-500">{filtered.length} of {users.length} users</p>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr><th className="p-3">Name</th><th>Email</th><th>Phone</th><th>Role</th><th>Orders</th><th>Joined</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-gray-500">No users match your filters.</td></tr>
            )}
            {filtered.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3 font-medium">{u.fullName}</td>
                <td>{u.email}</td>
                <td>{u.phone || '—'}</td>
                <td><Badge className={u.role === 'customer' ? 'bg-gray-100 text-gray-700' : 'bg-purple-100 text-purple-700'}>{u.role}</Badge></td>
                <td>{u.orderCount}</td>
                <td>{formatDate(u.createdAt)}</td>
                <td>{u.isBlocked ? <Badge className="bg-red-100 text-red-700">Blocked</Badge> : <Badge className="bg-green-100 text-green-700">Active</Badge>}</td>
                <td className="pr-3 text-right">
                  {u.role === 'customer' && (
                    <button onClick={() => toggle(u.id)} className={`btn-outline !py-1 text-xs ${u.isBlocked ? 'text-green-600' : 'text-red-600'}`}>
                      {u.isBlocked ? <><CheckCircle className="h-3.5 w-3.5" /> Unblock</> : <><Ban className="h-3.5 w-3.5" /> Block</>}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
