import Button from './Button';

export default function Pagination({ page, pages, onPageChange }) {
  if (!pages || pages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <Button
        variant="ghost"
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
      >
        Prev
      </Button>
      <span className="pagination__status">
        Page {page} of {pages}
      </span>
      <Button
        variant="ghost"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pages}
      >
        Next
      </Button>
    </nav>
  );
}
