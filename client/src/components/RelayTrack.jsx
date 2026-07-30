import { useMeta } from '../context/MetaContext';
import { formatTime } from '../utils/format';

function buildAriaLabel(label, state, event) {
  if (state === 'completed') {
    return event ? `${label}, completed ${formatTime(event.at)}` : `${label}, completed`;
  }
  if (state === 'current') return `${label}, in progress`;
  return `${label}, not yet reached`;
}

/**
 * The signature relay-track element (docs/UI-SPEC.md section 2). Entirely
 * driven by relaySequence from MetaContext and the order's own status/
 * tracking — nothing about the flow is hardcoded here.
 */
export default function RelayTrack({ status, tracking = [], cancelReason }) {
  const { relaySequence, statusLabels } = useMeta();

  if (relaySequence.length === 0) return null;

  const isDelivered = status === 'DELIVERED';
  const isCancelled = status === 'CANCELLED';

  // Cancelled orders aren't part of relaySequence themselves — look at the
  // tracking history to see how far the relay actually got before it was
  // cancelled, so the track can still show real progress, just dimmed.
  let cancelledReachedIndex = 0;
  if (isCancelled) {
    const reachedIndexes = tracking
      .map((event) => relaySequence.indexOf(event.status))
      .filter((index) => index >= 0);
    cancelledReachedIndex = reachedIndexes.length ? Math.max(...reachedIndexes) : 0;
  }

  const rawIndex = relaySequence.indexOf(status);
  const currentIndex = rawIndex >= 0 ? rawIndex : 0;

  const getState = (index) => {
    if (isDelivered) return 'completed';
    if (isCancelled) return index <= cancelledReachedIndex ? 'completed' : 'future';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'current';
    return 'future';
  };

  const splitIndex = Math.max(relaySequence.indexOf('ASSIGNED'), 1);
  const externalLegSteps = splitIndex;
  const relayLegSteps = relaySequence.length - splitIndex;

  const trackClasses = [
    'relay-track',
    isDelivered ? 'relay-track--delivered' : '',
    isCancelled ? 'relay-track--cancelled' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="relay-track-wrap">
      {isCancelled && (
        <div className="relay-track__cancel-banner">
          <span className="status-badge status-badge--cancelled">Cancelled</span>
          {cancelReason && <span className="text-dim">{cancelReason}</span>}
        </div>
      )}

      <div className={trackClasses}>
        <ol className="relay-track__steps" role="list">
          {relaySequence.map((stepStatus, index) => {
            const state = getState(index);
            const leftState = index > 0 ? getState(index - 1) : null;
            const connectorClass =
              index > 0
                ? `relay-track__connector--${leftState === 'completed' ? 'solid' : 'dashed'}`
                : '';
            const event = tracking.find((t) => t.status === stepStatus);
            const label = statusLabels[stepStatus] || stepStatus;

            return (
              <li
                key={stepStatus}
                role="listitem"
                className={`relay-track__step relay-track__step--${state}`}
                aria-label={buildAriaLabel(label, state, event)}
              >
                {index > 0 && (
                  <span
                    className={`relay-track__connector ${connectorClass}`}
                    aria-hidden="true"
                  />
                )}
                <span className="relay-track__node" aria-hidden="true" />
                <span className="relay-track__label">{label}</span>
                {event && (
                  <time className="relay-track__time" dateTime={event.at}>
                    {formatTime(event.at)}
                  </time>
                )}
              </li>
            );
          })}
        </ol>

        <div className="relay-track__legs">
          <span className="relay-track__leg" style={{ flexGrow: externalLegSteps }}>
            External rider
          </span>
          <span className="relay-track__leg" style={{ flexGrow: relayLegSteps }}>
            Relay partner
          </span>
        </div>
      </div>
    </div>
  );
}
