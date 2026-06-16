import { useConnector } from '../context/ConnectorContext';
import { useEditor } from '../context/useEditor';
import { documentHasLocalAssetRefs } from '../lib/localAssetRef';

export function ConnectorBanner() {
  const skip = localStorage.getItem('connector-banner-skip') === 'true' || false;

  if (skip) return null;


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
      <div><strong>Atenção:</strong> {message}</div>
      <div><button type="button" className="link" onClick={() => localStorage.setItem('connector-banner-skip', 'true')}>Não mostrar novamente</button></div>
    </div>
  );
}
