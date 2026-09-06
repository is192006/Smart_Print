import { FormEvent, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client';
import type { MeResponse, Shop } from '../../api/types';

export function AdminUsers() {
  const [users, setUsers] = useState<MeResponse[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'SHOP_STAFF' | 'ADMIN'>('SHOP_STAFF');
  const [shopId, setShopId] = useState<number | ''>('');
  const [error, setError] = useState('');

  async function load() {
    const [usersRes, shopsRes] = await Promise.all([api.get<MeResponse[]>('/users'), api.get<Shop[]>('/shops?all=true')]);
    setUsers(usersRes.data);
    setShops(shopsRes.data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', {
        name,
        email,
        password,
        role,
        shopId: role === 'SHOP_STAFF' ? shopId || undefined : undefined,
      });
      setName('');
      setEmail('');
      setPassword('');
      setShopId('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function setStatus(userId: number, status: string) {
    setError('');
    try {
      await api.patch(`/users/${userId}/status`, { status });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <h1>Users</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Shop</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.userId}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>{shops.find((s) => s.shopId === u.shopId)?.shopCode ?? '-'}</td>
                <td>{u.status}</td>
                <td>
                  {u.status === 'ACTIVE' ? (
                    <button className="btn btn-secondary" onClick={() => setStatus(u.userId, 'SUSPENDED')}>
                      Suspend
                    </button>
                  ) : (
                    <button className="btn btn-secondary" onClick={() => setStatus(u.userId, 'ACTIVE')}>
                      Activate
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Create shop staff / admin</h3>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="form-row">
              <label>Name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Password</label>
              <input
                type="password"
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <label>Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value as 'SHOP_STAFF' | 'ADMIN')}>
                <option value="SHOP_STAFF">Shop staff</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            {role === 'SHOP_STAFF' && (
              <div className="form-row">
                <label>Shop</label>
                <select value={shopId} onChange={(e) => setShopId(Number(e.target.value))} required>
                  <option value="">Select a shop...</option>
                  {shops.map((shop) => (
                    <option key={shop.shopId} value={shop.shopId}>
                      {shop.shopName} ({shop.shopCode})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <button className="btn" type="submit">
            Create user
          </button>
        </form>
      </div>
    </div>
  );
}
