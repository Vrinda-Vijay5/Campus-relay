import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { getStatusGroup } from '../utils/status';
import { formatDateTime } from '../utils/format';

export default function OrderCard({ order, children }) {
  const group = getStatusGroup(order.status);

  return (
    <div className={`order-card order-card--${group} fade-up`}>
      <div className="order-card__body">
        <div className="row-between">
          <Link to={`/orders/${order.id}`} className="order-card__code">
            {order.orderCode}
          </Link>
          <StatusBadge status={order.status} />
        </div>

        <div className="order-card__meta">
          <span>{order.vendor}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{order.destination?.label}</span>
        </div>

        {order.itemDescription && (
          <p className="text-dim order-card__description">{order.itemDescription}</p>
        )}

        <div className="order-card__footer row-between">
          <span className="text-caption">
            Expected {formatDateTime(order.expectedArrival)}
          </span>
          {children && <div className="order-card__actions row">{children}</div>}
        </div>
      </div>
    </div>
  );
}
