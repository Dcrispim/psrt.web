# psrt-gui-web (PSRT Web)

Editor visual PSRT no browser. Cópia auto-contida da UI do desktop; comunica **somente** com o binário local `psrt-web-connector`.

## Desenvolvimento

```bash
# Terminal 1 — conector local (obrigatório)
cp ../../psrt-connector.ini.example ../../psrt-connector.ini
# Edite base_dir e allowed_origin=http://localhost:5174
go run ../../cmd/psrt-web-connector -config ../../psrt-connector.ini

# Terminal 2 — frontend
cd cmd/psrt-gui-web
npm install
npm run dev
```

Abre em http://localhost:5174

### Pareamento

1. O conector imprime um código de 6 dígitos no terminal
2. Abra **Local Connector** no header
3. Aba **Conexão**: confirme URL, digite o código, clique **Parear**
4. Token fica em `sessionStorage` até fechar a aba ou reiniciar o conector

## Build

```bash
npm run build
npm run preview
```

## Arquitetura

| Camada | Descrição |
|--------|-----------|
| UI | Cópia de `cmd/psrt-gui/frontend/src` (fork manual) |
| Backend | `src/api/connectorClient.ts` → HTTP `psrt-web-connector` |
| Rascunho | IndexedDB (`documentStore.ts`) — texto do documento apenas |
| Assets locais | `GET /image` via `fetch` autenticado → `blob:` URL |

## Paths locais

1. O cliente expande `@const@` com `ExpandConsts`
2. `isLocalAssetRef` no path **completo** expandido
3. O conector recebe `path` já expandido em `GET /image`
4. `base_dir` é configurado no INI do conector (aba **Configuração** do modal)

Imagens locais **não** usam `<img src="http://127.0.0.1/...">` — o browser não envia `Authorization` em tags `<img>`. O fluxo é `fetch` + `blob:` URL.

## Estados do conector

| Status | Significado |
|--------|-------------|
| Online (verde) | Conector responde e token válido |
| Não pareado (amarelo) | Conector ativo, mas sem token |
| Offline (vermelho) | Conector não responde |

## Sync com desktop

Melhorias em `cmd/psrt-gui/frontend` devem ser copiadas manualmente para `cmd/psrt-gui-web/src`.
