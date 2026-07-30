import Button from './Button';

export default function ErrorState({ message = 'Something went wrong.', onRetry }) {
  return (
    <div className="state-block state-block--error">
      <div className="state-block__icon" aria-hidden="true">
        ⚠️
      </div>
      <p className="state-block__message">{message}</p>
      {onRetry && (
        <Button variant="ghost" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
