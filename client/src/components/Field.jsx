export default function Field({
  id,
  label,
  as = 'input',
  type = 'text',
  error,
  hint,
  required = false,
  children,
  className = '',
  ...rest
}) {
  const describedBy = [];
  if (hint) describedBy.push(`${id}-hint`);
  if (error) describedBy.push(`${id}-error`);

  const controlProps = {
    id,
    className: `field__control ${error ? 'field__control--error' : ''} ${className}`.trim(),
    required,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy.length ? describedBy.join(' ') : undefined,
    ...rest,
  };

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
        {required && ' *'}
      </label>
      {as === 'select' && <select {...controlProps}>{children}</select>}
      {as === 'textarea' && <textarea {...controlProps} />}
      {as === 'input' && <input type={type} {...controlProps} />}
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
