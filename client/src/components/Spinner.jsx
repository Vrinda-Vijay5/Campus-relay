export default function Spinner({ size = 'inline' }) {
  return (
    <span
      className={size === 'block' ? 'spinner spinner--block' : 'spinner'}
      role="status"
      aria-label="Loading"
    />
  );
}
