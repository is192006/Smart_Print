import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import type { Order } from '../../api/types';
import { StatusBadge } from '../../components/StatusBadge';

export function OrderList() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    api.get<Order[]>('/orders').then((res) => setOrders(res.data));
  }, []);

  return (
    <div>
      <h1>My orders</h1>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th>Order code</th>
              <th>Shop</th>
              <th>Status</th>
              <th>Total</th>
              <th>Token</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.orderId}>
                <td>{order.orderCode}</td>
                <td>{order.shop?.shopName}</td>
                <td>
                  <StatusBadge status={order.orderStatus} />
                </td>
                <td>₹{Number(order.totalAmount).toFixed(2)}</td>
                <td>{order.queue?.queueNumber ?? '-'}</td>
                <td>
                  <Link to={`/student/orders/${order.orderId}`}>View</Link>
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">
                  No orders yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
