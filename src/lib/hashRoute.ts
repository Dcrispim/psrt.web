export type AppRoute = 'editor' | 'reader';

export function getHashRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
  if (hash === 'reader') return 'reader';
  return 'editor';
}

export function navigateTo(route: AppRoute): void {
  const next = route === 'reader' ? '#/reader' : '#/';
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}

export function subscribeHashRoute(onChange: (route: AppRoute) => void): () => void {
  const handler = () => onChange(getHashRoute());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
