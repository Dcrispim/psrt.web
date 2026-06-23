# psrt.web (PSRT Web)

Editor visual PSRT no browser. Cópia auto-contida da UI do desktop. O conector local `psrt-web-connector` é opcional — só é necessário para carregar imagens referenciadas por URL local (`file://...`).

## Desenvolvimento

```bash
cd web/psrt.web
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

## Offline / PWA

O editor funciona offline após a **primeira visita online** (ou após servir um build local). Um Service Worker cacheia JS, CSS e assets estáticos; rascunhos continuam no IndexedDB.

### Instalar como app

- **Chrome / Edge:** ícone "Instalar app" na barra de endereço (ou menu ⋮ → Instalar)
- **iOS Safari:** Compartilhar → Adicionar à Tela de Início

O manifest está em `public/manifest.webmanifest` (`display: standalone`).

### Testar offline

1. `npm run build && npm run preview`
2. Abra a URL do preview no browser e aguarde o carregamento completo
3. DevTools → **Network** → marque **Offline**
4. Recarregue a página (F5) — o app deve abrir normalmente

Para simular o deploy do GitHub Pages:

```powershell
$env:GITHUB_PAGES='true'; npm run build; npx vite preview --base /psrt.web/
```

### Limitações offline

| Recurso | Offline? |
|---------|----------|
| Editar / salvar PSRT (upload + download) | Sim |
| Rascunho automático (IndexedDB) | Sim |
| Nova página (placeholder local) | Sim |
| Google Fonts (`fonts.googleapis.com`) | Não na 1ª carga |
| Imagens `https://` no documento | Não na 1ª carga |
| Conector local no GitHub Pages | Não (mixed content HTTPS → localhost) |

Um banner amarelo aparece quando `navigator.onLine` é falso — distinto do banner vermelho do conector local.

## Demo online (GitHub Pages)

Editor publicado em: **https://dcrispim.github.io/psrt.web/**

O deploy é automático a cada push na branch `main` via GitHub Actions.

### Configuração inicial (uma vez)

Antes do primeiro deploy, habilite o Pages no repositório:

1. Abra [Settings → Pages](https://github.com/Dcrispim/psrt.web/settings/pages)
2. Em **Build and deployment → Source**, selecione **GitHub Actions**
3. Reexecute o workflow em **Actions → Deploy GitHub Pages → Re-run all jobs**

Se o job `deploy` falhar com `Failed to create deployment (status: 404)`, o Pages ainda não foi habilitado — repita os passos acima.

No ambiente publicado, o upload de arquivos PSRT funciona normalmente. O conector local (`http://127.0.0.1:5278`) não funciona a partir do HTTPS do GitHub Pages (limitação cross-origin/mixed-content).

### Preview local com base path do Pages

PowerShell:

```powershell
$env:GITHUB_PAGES='true'; npm run build; npx vite preview --base /psrt.web/
```

Bash:

```bash
GITHUB_PAGES=true npm run build && npx vite preview --base /psrt.web/
```

## Arquitetura

| Camada | Descrição |
|--------|-----------|
| UI | Cópia de `go/cmd/psrt-gui/frontend/src` (fork manual) |
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

Melhorias em `go/cmd/psrt-gui/frontend` devem ser copiadas manualmente para `web/psrt.web/src`.
