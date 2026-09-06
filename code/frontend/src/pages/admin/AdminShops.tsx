import { FormEvent, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client';
import type { Shop } from '../../api/types';

export function AdminShops() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopCode, setShopCode] = useState('');
  const [shopName, setShopName] = useState('');
  const [location, setLocation] = useState('');
  const [contact, setContact] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const { data } = await api.get<Shop[]>('/shops?all=true');
    setShops(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/shops', { shopCode, shopName, location, contact });
      setShopCode('');
      setShopName('');
      setLocation('');
      setContact('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function toggle(shop: Shop, field: 'isActive' | 'acceptingOrders') {
    setError('');
    try {
      await api.patch(`/shops/${shop.shopId}`, { [field]: !shop[field] });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <h1>Shops</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Location</th>
              <th>Active</th>
              <th>Accepting orders</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.shopId}>
                <td>{shop.shopCode}</td>
                <td>{shop.shopName}</td>
                <td>{shop.location}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => toggle(shop, 'isActive')}>
                    {shop.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
                <td>
                  <button className="btn btn-secondary" onClick={() => toggle(shop, 'acceptingOrders')}>
                    {shop.acceptingOrders ? 'Stop orders' : 'Accept orders'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Create a shop</h3>
        <form onSubmit={handleCreate}>
          <div className="form-grid">
            <div className="form-row">
              <label>Shop code (used as order-code prefix)</label>
              <input value={shopCode} onChange={(e) => setShopCode(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Shop name</label>
              <input value={shopName} onChange={(e) => setShopName(e.target.value)} required />
            </div>
            <div className="form-row">
              <label>Location</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)} />
            </div>
            <div className="form-row">
              <label>Contact</label>
              <input value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
          </div>
          <button className="btn" type="submit">
            Create shop
          </button>
        </form>
      </div>
    </div>
  );
}
