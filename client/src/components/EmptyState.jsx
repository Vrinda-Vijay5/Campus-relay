import Button from './Button';

export default function EmptyState({ icon = '📭', message, actionLabel, onAction }) {
  return (
    <div className="state-block">
      <div className="state-block__icon" aria-hidden="true">
        {icon}
      </div>
      <p className="state-block__message">{message}</p>
      {actionLabel && onAction && (
        <Button variant="ghost" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
