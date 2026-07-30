export default function Toast({ message, type = 'info', onClose }) {
  return (
    <div className={`toast toast--${type}`} role="status">
      <div className="row-between">
        <span>{message}</span>
        <button
          type="button"
          className="modal__close"
          aria-label="Dismiss notification"
          onClick={onClose}
        >
          &times;
        </button>
      </div>
    </div>
  );
}
