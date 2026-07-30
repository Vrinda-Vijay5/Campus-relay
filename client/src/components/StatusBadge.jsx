import { useMeta } from '../context/MetaContext';
import { getStatusGroup } from '../utils/status';

export default function StatusBadge({ status }) {
  const { statusLabels } = useMeta();
  const group = getStatusGroup(status);

  return (
    <span className={`status-badge status-badge--${group}`}>
      {statusLabels[status] || status}
    </span>
  );
}
