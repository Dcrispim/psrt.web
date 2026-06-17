const ROUTES = {
  editor: '#/',
  reader: '#/reader',
  'local-assets': '#/local-assets',
};

export type AppRoute = 'editor' | 'reader' | 'local-assets';

export function getHashRoute(): AppRoute {
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0]?.toLowerCase() ?? '';
  if (ROUTES[hash as AppRoute]) {
    return hash as AppRoute
  };
  return 'editor';
}

export function navigateTo(route: AppRoute): void {

  if (ROUTES[route] && window.location.hash !== ROUTES[route]) {
    window.location.hash = ROUTES[route];
  }
}

export function subscribeHashRoute(onChange: (route: AppRoute) => void): () => void {
  const handler = () => onChange(getHashRoute());
  window.addEventListener('hashchange', handler);
  return () => window.removeEventListener('hashchange', handler);
}
