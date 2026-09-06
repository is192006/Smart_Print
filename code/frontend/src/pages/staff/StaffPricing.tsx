import { FormEvent, useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import type { PaperSize, PricingRule, PrintType, Sides } from '../../api/types';

export function StaffPricing() {
  const { user } = useAuth();
  const [rules, setRules] = useState<PricingRule[]>([]);
  const [printType, setPrintType] = useState<PrintType>('BW');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [sides, setSides] = useState<Sides>('SINGLE');
  const [pricePerPage, setPricePerPage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    if (!user?.shopId) return;
    const { data } = await api.get<PricingRule[]>(`/shops/${user.shopId}/pricing`);
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
      await api.post(`/shops/${user?.shopId}/pricing`, {
        printType,
        paperSize,
        sides,
        pricePerPage: Number(pricePerPage),
      });
      setPricePerPage('');
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div>
      <h1>Pricing rules</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>Active rules</h3>
        <table>
          <thead>
            <tr>
              <th>Print type</th>
              <th>Paper size</th>
              <th>Sides</th>
              <th>Price / page</th>
              <th>Effective from</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr key={rule.pricingRuleId}>
                <td>{rule.printType}</td>
                <td>{rule.paperSize}</td>
                <td>{rule.sides}</td>
                <td>₹{Number(rule.pricePerPage).toFixed(2)}</td>
                <td>{new Date(rule.effectiveFrom).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Set a price (replaces any existing active rule for this combination)</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-row">
              <label>Print type</label>
              <select value={printType} onChange={(e) => setPrintType(e.target.value as PrintType)}>
                <option value="BW">B&amp;W</option>
                <option value="COLOR">Color</option>
              </select>
            </div>
            <div className="form-row">
              <label>Paper size</label>
              <select value={paperSize} onChange={(e) => setPaperSize(e.target.value as PaperSize)}>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="LETTER">Letter</option>
              </select>
            </div>
            <div className="form-row">
              <label>Sides</label>
              <select value={sides} onChange={(e) => setSides(e.target.value as Sides)}>
                <option value="SINGLE">Single-sided</option>
                <option value="DOUBLE">Double-sided</option>
              </select>
            </div>
            <div className="form-row">
              <label>Price per page (₹)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={pricePerPage}
                onChange={(e) => setPricePerPage(e.target.value)}
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
