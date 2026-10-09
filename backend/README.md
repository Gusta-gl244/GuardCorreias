# GuardCorreias Backend

Backend Node.js/Express + PostgreSQL para o GuardCorreias.

## Instalação

```bash
cd backend
npm install
```

## Executar em Desenvolvimento

```bash
npm run dev
```

Sem `DATABASE_URL` definida, sobe um Postgres local embutido sozinho (sem
Docker) na primeira execução. Servidor em `http://localhost:3001`.

## Executar em Produção

```bash
npm start
```

Requer `DATABASE_URL` (Postgres gerenciado, ex.: Neon) e `JWT_SECRET`
definidas via variáveis de ambiente.

## Estrutura de Pastas

```
backend/
├── src/
│   ├── database/
│   │   ├── postgres-connection.js  # Pool de conexão
│   │   ├── init-postgres.js        # Schema (tabelas + índices)
│   │   ├── queries-postgres.js     # Queries + motor de sync genérico
│   │   ├── dev-bootstrap.js        # Postgres embutido em dev local
│   │   └── seed.js                 # Contas de teste + severidades/checklist padrão
│   ├── routes/
│   │   ├── auth.js, users.js
│   │   ├── belts.js, stations.js           # Correias e estações de inspeção
│   │   ├── checklistTemplates.js, severities.js
│   │   ├── inspectionOrders.js, inspections.js, media.js
│   │   ├── sync.js                         # Push/pull offline-first
│   │   ├── backups.js, diagnostics.js
│   ├── middleware/auth.js          # JWT
│   ├── scheduler/backupScheduler.js
│   ├── utils/zip.js                # Backup completo + export por inspeção
│   └── server.js
└── package.json
```

## API Endpoints (principais)

- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/belts`, `/api/stations`
- `GET/POST/PUT/DELETE /api/checklist-templates`, `/api/severities`
- `GET/POST/PUT/DELETE /api/inspection-orders`
- `GET/POST/PUT/DELETE /api/inspections`
  - `GET /api/inspections/:id/media` — mídias vinculadas
  - `GET /api/inspections/:id/export` — ZIP (fotos/videos/audios/checklist.json/metadados.json)
- `GET /api/media/:id`, `POST /api/media`
- `GET /api/sync/pull`, `POST /api/sync/push` — sincronização offline
- `GET /api/backups`, `POST /api/backups/run`
- `GET /api/diagnostics`

## Banco de Dados

PostgreSQL — única fonte de verdade, sem cache duplicado. Tabelas
principais: `users`, `belts`, `beltStations`, `checklistTemplates`,
`severities`, `inspectionOrders`, `inspections`, `media`, `backups`,
`settings`, `systemLogs`.

## Dados Iniciais

Semeado automaticamente no primeiro boot (ver `src/database/seed.js`):
- 3 contas de teste (`tecnico@guardcorreias.com` / `supervisor@guardcorreias.com`
  / `admin@guardcorreias.com`, senha `guardcorreias`)
- Severidades padrão (baixa/média/alta/crítica)
- Um checklist de estação padrão (12 itens)

Correias e estações **não** são semeadas — o cadastro de ativos começa vazio
até a importação dos dados reais da planta.

## Mídias (fotos/vídeos/áudios)

Guardadas na tabela `media`, vinculadas por `inspectionId` — é essa
vinculação que forma a "pasta" da inspeção, materializada como ZIP sob
demanda em `/api/inspections/:id/export` (sem depender de disco persistente
em produção).
