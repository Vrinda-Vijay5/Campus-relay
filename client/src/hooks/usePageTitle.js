import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · Campus Relay` : 'Campus Relay';
  }, [title]);
}
