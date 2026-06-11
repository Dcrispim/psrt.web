import { useConnector } from '../context/ConnectorContext';
import { useEditor } from '../context/useEditor';
import { documentHasLocalAssetRefs } from '../lib/localAssetRef';

export function ConnectorBanner() {
  const { status, connectorUrl } = useConnector();
  const { document } = useEditor();

  if (status === 'online') return null;
  if (!documentHasLocalAssetRefs(document)) return null;

  let message: string;
  if (status === 'offline') {
    message = `Conector indisponível em ${connectorUrl}. Inicie psrt-web-connector com psrt-connector.ini.`;
  } else if (status === 'unpaired') {
    message =
      'Conector ativo, mas não pareado. Abra Local Connector, digite o código do terminal e clique em Parear.';
  } else {
    message = 'Verificando conector local…';
  }

  return (
    <div className="connector-banner" role="status">
      <strong>Atenção:</strong> {message}
    </div>
  );
}
