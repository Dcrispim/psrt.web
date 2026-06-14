import { useOnlineStatus } from '../hooks/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="offline-banner" role="status">
      <strong>Sem conexão</strong> — o editor continua funcionando; recarregue apenas se já
      visitou o site online antes.
    </div>
  );
}
