import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, apiErrorMessage } from '../../api/client';
import type { Order } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';

export function OrderDetail() {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [paying, setPaying] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [requestingRefund, setRequestingRefund] = useState(false);

  async function load() {
    const { data } = await api.get<Order>(`/orders/${orderId}`);
    setOrder(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function handlePay() {
    setError('');
    setNotice('');
    setPaying(true);
    try {
      const { data } = await api.post(`/payments/orders/${orderId}`, { paymentMethod });
      if (data.payment.paymentStatus === 'SUCCESS') {
        setNotice(`Payment successful! Your queue token is ${data.queue.queueNumber}.`);
      } else {
        setError('Payment failed. You can retry with a different method.');
      }
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPaying(false);
    }
  }

  async function handleCancel() {
    setError('');
    try {
      await api.post(`/orders/${orderId}/cancel`, {});
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleRefundRequest(e: FormEvent) {
    e.preventDefault();
    if (!order?.payments?.length) return;
    const successPayment = order.payments.find((p) => p.paymentStatus === 'SUCCESS');
    if (!successPayment) return;
    setError('');
    setRequestingRefund(true);
    try {
      await api.post('/refunds', {
        paymentId: successPayment.paymentId,
        refundAmount: Number(refundAmount),
        refundReason,
      });
      setNotice('Refund requested. The shop will review it.');
      setRefundAmount('');
      setRefundReason('');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setRequestingRefund(false);
    }
  }

  if (!order) return <div className="page-loading">Loading...</div>;

  const successPayment = order.payments?.find((p) => p.paymentStatus === 'SUCCESS');

  return (
    <div>
      <h1>
        Order {order.orderCode} <StatusBadge status={order.orderStatus} />
      </h1>
      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {order.queue && (
        <div className="card">
          <h3>Queue token</h3>
          <div className="token-display">{order.queue.queueNumber}</div>
          <p className="muted">Queue status: {order.queue.queueStatus}</p>
        </div>
      )}

      <div className="card">
        <h3>Documents</h3>
        <table>
          <thead>
            <tr>
              <th>File</th>
              <th>Copies</th>
              <th>Price/page</th>
              <th>Finishing</th>
              <th>Line total</th>
            </tr>
          </thead>
          <tbody>
            {order.orderDocuments?.map((od) => (
              <tr key={od.orderDocumentId}>
                <td>{od.document.fileName}</td>
                <td>{od.copies}</td>
                <td>₹{Number(od.pricePerPage).toFixed(2)}</td>
                <td>₹{Number(od.finishingPrice).toFixed(2)}</td>
                <td>₹{Number(od.lineTotal).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>
          <strong>Total: ₹{Number(order.totalAmount).toFixed(2)}</strong>
        </p>
      </div>

      {order.orderStatus === 'CREATED' && (
        <div className="card">
          <h3>Pay for this order</h3>
          <div className="form-row">
            <label>Payment method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="NETBANKING">Net banking</option>
              <option value="FAIL_TEST">Simulate failure (test)</option>
            </select>
          </div>
          <button className="btn" onClick={handlePay} disabled={paying}>
            {paying ? 'Processing...' : `Pay ₹${Number(order.totalAmount).toFixed(2)}`}
          </button>{' '}
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel order
          </button>
        </div>
      )}

      {successPayment && (
        <div className="card">
          <h3>Request a refund</h3>
          <form onSubmit={handleRefundRequest}>
            <div className="form-row">
              <label>Refund amount (max ₹{Number(successPayment.amount).toFixed(2)})</label>
              <input
                type="number"
                step="0.01"
                min={0.01}
                max={Number(successPayment.amount)}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                required
              />
            </div>
            <div className="form-row">
              <label>Reason</label>
              <textarea value={refundReason} onChange={(e) => setRefundReason(e.target.value)} required />
            </div>
            <button className="btn" type="submit" disabled={requestingRefund}>
              {requestingRefund ? 'Submitting...' : 'Request refund'}
            </button>
          </form>
        </div>
      )}

      <div className="card">
        <h3>Status history</h3>
        <table>
          <thead>
            <tr>
              <th>Status</th>
              <th>When</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {order.statusHistory?.map((h) => (
              <tr key={h.historyId}>
                <td>
                  <StatusBadge status={h.status} />
                </td>
                <td>{new Date(h.changedAt).toLocaleString()}</td>
                <td>{h.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
