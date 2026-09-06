import { useEffect, useState } from 'react';
import { api, apiErrorMessage } from '../../api/client';
import type { Queue } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';

type QueueWithOrder = Queue & {
  order: { orderCode: string; totalAmount: string; user: { name: string; email: string } };
};

export function StaffQueue() {
  const [queue, setQueue] = useState<QueueWithOrder[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data } = await api.get<QueueWithOrder[]>('/queue');
    setQueue(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleStartNext() {
    setError('');
    setBusy(true);
    try {
      await api.post('/queue/start-next', {});
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleReady(queueId: number) {
    setError('');
    try {
      await api.patch(`/queue/${queueId}/ready`, {});
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function handleCancel(queueId: number) {
    setError('');
    try {
      await api.patch(`/queue/${queueId}/cancel`, {});
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  const waiting = queue.filter((q) => q.queueStatus === 'WAITING');
  const printing = queue.filter((q) => q.queueStatus === 'PRINTING');

  return (
    <div>
      <h1>Print queue (FIFO)</h1>
      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <h3>Currently printing</h3>
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Order</th>
              <th>Student</th>
              <th>Started</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {printing.map((q) => (
              <tr key={q.queueId}>
                <td>{q.queueNumber}</td>
                <td>{q.order.orderCode}</td>
                <td>{q.order.user.name}</td>
                <td>{q.startedAt ? new Date(q.startedAt).toLocaleTimeString() : '-'}</td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleReady(q.queueId)}>
                    Mark ready
                  </button>
                </td>
              </tr>
            ))}
            {printing.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">
                  Nothing is currently printing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <button className="btn" onClick={handleStartNext} disabled={busy || waiting.length === 0}>
          Start next in queue
        </button>
      </div>

      <div className="card">
        <h3>Waiting ({waiting.length})</h3>
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Order</th>
              <th>Student</th>
              <th>Entered at</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {waiting.map((q) => (
              <tr key={q.queueId}>
                <td>{q.queueNumber}</td>
                <td>{q.order.orderCode}</td>
                <td>{q.order.user.name}</td>
                <td>{new Date(q.enteredAt).toLocaleString()}</td>
                <td>
                  <StatusBadge status={q.queueStatus} />
                </td>
                <td>
                  <button className="btn btn-secondary" onClick={() => handleCancel(q.queueId)}>
                    Cancel
                  </button>
                </td>
              </tr>
            ))}
            {waiting.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No orders waiting.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
