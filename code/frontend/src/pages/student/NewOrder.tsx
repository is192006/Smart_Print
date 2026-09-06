import { ChangeEvent, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, apiErrorMessage } from '../../api/client';
import type {
  DocumentMeta,
  FinishingRule,
  FinishingType,
  PaperSize,
  PricingRule,
  PrintType,
  Shop,
  Sides,
} from '../../api/types';

interface OrderLine {
  documentId: number;
  fileName: string;
  pageCount: number;
  printType: PrintType;
  paperSize: PaperSize;
  sides: Sides;
  copies: number;
  finishingType: FinishingType;
}

function priceForLine(line: OrderLine, pricing: PricingRule[], finishing: FinishingRule[]) {
  const rule = pricing.find(
    (p) => p.printType === line.printType && p.paperSize === line.paperSize && p.sides === line.sides,
  );
  const finishingRule =
    line.finishingType === 'NONE' ? undefined : finishing.find((f) => f.finishingType === line.finishingType);
  if (!rule) return null;
  const printingCost = line.pageCount * line.copies * Number(rule.pricePerPage);
  const finishingCost = finishingRule ? Number(finishingRule.price) : 0;
  return printingCost + finishingCost;
}

export function NewOrder() {
  const [shops, setShops] = useState<Shop[]>([]);
  const [shopId, setShopId] = useState<number | null>(null);
  const [pricing, setPricing] = useState<PricingRule[]>([]);
  const [finishing, setFinishing] = useState<FinishingRule[]>([]);
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get<Shop[]>('/shops').then((res) => setShops(res.data));
  }, []);

  useEffect(() => {
    if (!shopId) return;
    setLines([]);
    api.get<PricingRule[]>(`/shops/${shopId}/pricing`).then((res) => setPricing(res.data));
    api.get<FinishingRule[]>(`/shops/${shopId}/finishing`).then((res) => setFinishing(res.data));
  }, [shopId]);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !shopId) return;
    setError('');
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post<DocumentMeta>('/documents', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const defaultPricing = pricing[0];
      setLines((prev) => [
        ...prev,
        {
          documentId: data.documentId,
          fileName: data.fileName,
          pageCount: data.pageCount,
          printType: defaultPricing?.printType ?? 'BW',
          paperSize: defaultPricing?.paperSize ?? 'A4',
          sides: defaultPricing?.sides ?? 'SINGLE',
          copies: 1,
          finishingType: 'NONE',
        },
      ]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  function updateLine(index: number, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const total = lines.reduce((sum, line) => sum + (priceForLine(line, pricing, finishing) ?? 0), 0);
  const hasUnpriced = lines.some((line) => priceForLine(line, pricing, finishing) === null);

  async function handleSubmit() {
    if (!shopId || lines.length === 0) return;
    setError('');
    setSubmitting(true);
    try {
      const { data } = await api.post('/orders', {
        shopId,
        documents: lines.map((line) => ({
          documentId: line.documentId,
          printType: line.printType,
          paperSize: line.paperSize,
          sides: line.sides,
          copies: line.copies,
          finishingType: line.finishingType,
        })),
      });
      navigate(`/student/orders/${data.orderId}`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <h1>New print order</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>1. Choose a shop</h3>
        <div className="form-row">
          <select value={shopId ?? ''} onChange={(e) => setShopId(Number(e.target.value) || null)}>
            <option value="">Select a shop...</option>
            {shops.map((shop) => (
              <option key={shop.shopId} value={shop.shopId}>
                {shop.shopName} ({shop.shopCode}) {shop.location ? `- ${shop.location}` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {shopId && (
        <div className="card">
          <h3>2. Upload documents (PDF)</h3>
          <input type="file" accept="application/pdf" onChange={handleUpload} disabled={uploading} />
          {uploading && <p className="muted">Uploading...</p>}

          {lines.map((line, index) => (
            <div className="doc-line" key={line.documentId + '-' + index}>
              <strong>{line.fileName}</strong>
              <span className="muted">{line.pageCount} pages</span>

              <select
                value={line.printType}
                onChange={(e) => updateLine(index, { printType: e.target.value as PrintType })}
              >
                <option value="BW">B&amp;W</option>
                <option value="COLOR">Color</option>
              </select>

              <select
                value={line.paperSize}
                onChange={(e) => updateLine(index, { paperSize: e.target.value as PaperSize })}
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="LETTER">Letter</option>
              </select>

              <select value={line.sides} onChange={(e) => updateLine(index, { sides: e.target.value as Sides })}>
                <option value="SINGLE">Single-sided</option>
                <option value="DOUBLE">Double-sided</option>
              </select>

              <label className="muted">
                Copies:{' '}
                <input
                  type="number"
                  min={1}
                  value={line.copies}
                  style={{ width: 60 }}
                  onChange={(e) => updateLine(index, { copies: Math.max(1, Number(e.target.value)) })}
                />
              </label>

              <select
                value={line.finishingType}
                onChange={(e) => updateLine(index, { finishingType: e.target.value as FinishingType })}
              >
                <option value="NONE">No finishing</option>
                <option value="STAPLING">Stapling</option>
                <option value="SPIRAL_BINDING">Spiral binding</option>
                <option value="HARD_BINDING">Hard binding</option>
                <option value="LAMINATION">Lamination</option>
              </select>

              <span>
                {priceForLine(line, pricing, finishing) !== null
                  ? `₹${priceForLine(line, pricing, finishing)!.toFixed(2)}`
                  : 'Unavailable at this shop'}
              </span>

              <button className="btn btn-secondary" onClick={() => removeLine(index)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <div className="card">
          <h3>3. Review &amp; place order</h3>
          <p>
            Total: <strong>₹{total.toFixed(2)}</strong>
          </p>
          {hasUnpriced && (
            <div className="alert alert-error">
              One or more lines has no matching price at this shop — adjust the options above.
            </div>
          )}
          <button className="btn" onClick={handleSubmit} disabled={submitting || hasUnpriced}>
            {submitting ? 'Placing order...' : 'Place order'}
          </button>
        </div>
      )}
    </div>
  );
}
