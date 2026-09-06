import { FormEvent, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { FinishingRule, FinishingType } from '../../api/types';

const FINISHING_TYPES: FinishingType[] = ['STAPLING', 'SPIRAL_BINDING', 'HARD_BINDING', 'LAMINATION'];

export function StaffFinishing() {
  const { user } = useAuth();
  const [rules, setRules] = useState<FinishingRule[]>([]);
  const [finishingType, setFinishingType] = useState<FinishingType>('STAPLING');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!user?.shopId) return;
    const { data } = await api.get<FinishingRule[]>(`/shops/${user.shopId}/finishing`);
    setRules(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.shopId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post(`/shops/${user?.shopId}/finishing`, { finishingType, price: Number(price) });
      setPrice('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function toggleActive(rule: FinishingRule) {
    setError('');
    try {
      await api.patch(`/shops/${user?.shopId}/finishing/${rule.finishingRuleId}/active`, {
        isActive: !rule.isActive,
      });
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <h1>Finishing options</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>Configured finishing</h3>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Price</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.finishingRuleId}>
                <td>{rule.finishingType}</td>
                <td>₹{Number(rule.price).toFixed(2)}</td>
                <td>{rule.isActive ? 'Yes' : 'No'}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => toggleActive(rule)}>
                    {rule.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Set a finishing price</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-row">
              <label>Finishing type</label>
              <select value={finishingType} onChange={(e) => setFinishingType(e.target.value as FinishingType)}>
                {FINISHING_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-row">
              <label>Price (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                required
              />
            </div>
          </div>
          <button className="btn" type="submit">
            Save price
          </button>
        </form>
      </div>
    </div>
  );
}
