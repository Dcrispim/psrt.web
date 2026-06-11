# psrt-gui-web (PSRT Web)

Editor visual PSRT no browser. Cópia auto-contida da UI do desktop. O conector local `psrt-web-connector` é opcional — só é necessário para carregar imagens referenciadas por URL local (`file://...`).

## Desenvolvimento

```bash
cd cmd/psrt-gui-web
npm install
npm run dev
```

Abre em http://localhost:5174. Para uso normal, basta fazer upload dos arquivos PSRT no editor.

### Conector local (opcional)

Necessário apenas quando o documento referencia imagens com URL local (`file://...`). Sem o conector, use upload de arquivos normalmente.

Abra o executável **psrt-web-connector** já instalado na sua máquina.

### Pareamento

Quando o conector local estiver em execução:

1. O conector imprime um código de 6 dígitos no terminal
2. Abra **Local Connector** no header
3. Aba **Conexão**: confirme URL, digite o código, clique **Parear**
4. Token fica em `sessionStorage` até fechar a aba ou reiniciar o conector

## Build

```bash
npm run build
npm run preview
```

## Demo online (GitHub Pages)

Editor publicado em: **https://dcrispim.github.io/psrt-gui-web/**

O deploy é automático a cada push na branch `main` via GitHub Actions.

No ambiente publicado, o upload de arquivos PSRT funciona normalmente. O conector local (`http://127.0.0.1:5278`) não funciona a partir do HTTPS do GitHub Pages (limitação cross-origin/mixed-content).

### Preview local com base path do Pages

PowerShell:

```powershell
$env:GITHUB_PAGES='true'; npm run build; npx vite preview --base /psrt-gui-web/
```

Bash:

```bash
GITHUB_PAGES=true npm run build && npx vite preview --base /psrt-gui-web/
```

## Arquitetura

| Camada | Descrição |
|--------|-----------|
| UI | Cópia de `cmd/psrt-gui/frontend/src` (fork manual) |
| Backend | `src/api/connectorClient.ts` → HTTP `psrt-web-connector` |
| Rascunho | IndexedDB (`documentStore.ts`) — texto do documento apenas |
| Assets locais | `GET /image` via `fetch` autenticado → `blob:` URL |

## Paths locais

Referências locais usam URLs `file://...` ou caminhos absolutos do filesystem. O conector recebe o path em `GET /image` e resolve o arquivo em disco; `base_dir` é configurado na aba **Configuração** do modal Local Connector.

Imagens locais **não** usam `<img src="http://127.0.0.1/...">` — o browser não envia `Authorization` em tags `<img>`. O fluxo é `fetch` autenticado + `blob:` URL.

## Estados do conector

| Status | Significado |
|--------|-------------|
| Online (verde) | Conector responde e token válido |
| Não pareado (amarelo) | Conector ativo, mas sem token |
| Offline (vermelho) | Conector não responde |

## Sync com desktop

Melhorias em `cmd/psrt-gui/frontend` devem ser copiadas manualmente para `cmd/psrt-gui-web/src`.
