export function isDevMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (localStorage.getItem('acls_dev_mode') === 'true') return true;
  } catch {
    // ignore storage errors
  }
  const params = new URLSearchParams(window.location.search);
  return params.get('dev') === '1';
}
