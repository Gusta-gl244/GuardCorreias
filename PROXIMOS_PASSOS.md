# GuardCorreias — Estado da construção e próximos passos

Sistema de inspeção e gestão de correias transportadoras para a Mineração
Vale Verde (planta de beneficiamento), construído do zero reaproveitando a
arquitetura comprovada do INSPEC360 (`c:\INSPEC\Inpesc360-atualizado (2)\
Inpesc360-atualizado`), com domínio totalmente reescrito: correias/estações/
roletes no lugar de torres/estruturas.

## Decisões já tomadas com o usuário (não perguntar de novo)

- **Arquitetura**: copiada e adaptada do INSPEC360 — Postgres como única
  fonte de verdade, sync offline-first (outbox no IndexedDB + LWW por
  registro), auth JWT/bcrypt, backup em ZIP guardado no próprio Postgres
  (sem disco persistente, pronto pro Render).
- **Banco**: Postgres embutido localmente em dev (`embedded-postgres`, sobe
  sozinho, sem Docker). Neon só entra na hora do deploy — configurar
  `DATABASE_URL` no Render apontando pra ele; nenhuma migração de dados
  antigos é necessária, tudo nasce do zero.
- **Dados iniciais**: cadastro de correias/estações começa **vazio** — sem
  planilha real do cliente ainda (diferente do INSPEC360, que importou uma
  planilha real de 51 estruturas). O que É semeado automaticamente no
  primeiro boot: 3 contas de teste e um catálogo padrão de severidades +
  checklist de estação (12 itens, baseado em prática comum de inspeção de
  correias — editável pelo admin, ver `backend/src/database/seed.js`).
- **Escopo desta sessão**: fluxo do **Técnico em profundidade** (prioridade
  do usuário) — mapa satélite, seleção de correia, checklist por estação,
  mapa de roletes interativo, mídia (foto/áudio), assinatura digital,
  offline real. Supervisor e Admin ficaram **funcionais mas mais simples**
  (o suficiente pra criar correias/estações/ordens e testar o técnico
  ponta a ponta) — aprofundar depois.

## ✅ Concluído e testado ponta a ponta

- **Backend completo**: schema novo (`belts`, `beltStations`,
  `checklistTemplates`, `severities`, `inspectionOrders`, `inspections`,
  `media`, `users`, `backups`, `settings`, `systemLogs`), motor de sync
  genérico (mesmo padrão do INSPEC360, reaproveitado quase sem alterações),
  rotas REST para cada entidade, backup ZIP completo.
- **ID de inspeção no formato exigido**: `INS-AAAAMMDD-TAGCORREIA-XXX` (ex.:
  `INS-20260819-CV2203-001` gerado pelo servidor quando não há id do
  cliente; sufixo aleatório curto quando gerado offline no app, pra não
  depender de round-trip ao servidor — ver `generateInspectionId` em
  `backend/src/database/queries-postgres.js` e no `store.ts` do frontend).
- **"Pasta por inspeção"**: como não há disco persistente em produção, a
  pasta é lógica (tabela `media` vinculada por `inspectionId`) e
  materializada sob demanda em `GET /api/inspections/:id/export` — ZIP com
  `fotos/videos/audios/checklist.json/metadados.json`. Testado com uma
  inspeção real completa (ver seção de testes abaixo) — `resumo.pdf` **não
  foi implementado ainda** (ver pendências).
- **Fluxo do Técnico**: login → "Minhas Demandas do Dia" → mapa satélite
  (Leaflet + Esri World Imagery, correias como linhas coloridas por saúde,
  estações como pontos, "você está aqui") → seleção de correia por
  TAG/busca ou toque no mapa → checklist por estação (até 12 itens,
  OK/Atenção/Crítico, foto obrigatória em Atenção/Crítico) → mapa de
  roletes interativo (toca no rolete problemático, severidade + descrição +
  foto) → áudio opcional (segurar para gravar) → resumo automático →
  assinatura digital (canvas) → conclusão → saúde da correia recalculada
  automaticamente (verde/amarelo/vermelho).
- **Offline-first real**: mesmo motor do INSPEC360 (outbox no IndexedDB,
  drena antes de qualquer pull, LWW por registro) — herdado sem alterações
  estruturais, só os nomes das entidades mudaram.
- **Teste end-to-end real** (Playwright headless, ver histórico da sessão):
  supervisor cria correia CV2203 + estação "Cabeça" com 4 roletes + ordem de
  inspeção para o técnico → técnico vê a demanda → inicia → marca 1 item
  "Atenção" → sistema **bloqueia avançar sem foto** (confirmado) → anexa
  foto → registra anomalia num rolete → conclui checklist → resumo mostra
  contagens corretas → assina digitalmente (imagem capturada) → conclui →
  confirmado no servidor: inspeção `concluido`, assinatura com imagem,
  correia com `healthStatus: atencao`, ordem `concluido`, mídia vinculada,
  export ZIP com a estrutura de pastas correta.
- **Bug real encontrado e corrigido durante o teste**: a coluna `tag` de
  `belts` tinha `UNIQUE` simples — como exclusão é soft-delete
  (`deletedAt`), reaproveitar uma TAG depois de excluir a correia antiga
  colidia pra sempre. Corrigido para um índice único parcial
  (`WHERE "deletedAt" IS NULL"`), com `ALTER TABLE ... DROP CONSTRAINT IF
  EXISTS` pra corrigir bancos já criados antes desse fix.

## ⚠️ Funcional mas mais simples que o Técnico (aprofundar depois)

- **SupervisorApp**: Visão Geral (KPIs básicos), aba Correias (criar/listar
  correias e estações, gerador simples de roletes por estação), aba Ordens
  de Inspeção (criar/listar/cancelar demandas). Não tem ainda: revisão de
  inspeção concluída com mídias, dashboards de tendência, mapa de calor,
  relatório PDF exportável, redistribuição de demandas.
- **SuperAdmApp**: aba Usuários (criar/listar/excluir), aba Backup (reaproveita
  o `BackupPanel` do INSPEC360, adaptado), aba Status (diagnóstico real via
  `/api/diagnostics`). Não tem ainda: edição de checklist/severidades pela
  UI (só via seed/API por enquanto), logs de auditoria, gestão de
  armazenamento de mídia.

## ❌ Ainda não iniciado

- **`resumo.pdf`** dentro do export por inspeção — o ZIP hoje tem
  `checklist.json` + `metadados.json`, mas não um PDF gerado. O INSPEC360
  tinha um `ReportPanel.tsx` (não portado) que gerava PDF no cliente via
  `jspdf` (já é dependência do projeto) — replicar esse padrão para uma
  inspeção específica é o caminho mais rápido.
- **QR Code / NFC** para seleção de correia em campo — o app hoje cobre
  busca por TAG e toque no mapa; scanner de QR precisaria de uma lib de
  leitura de câmera (não está nas dependências ainda).
- **Login biométrico/PIN/NFC do crachá** — hoje é e-mail+senha (JWT), como
  no INSPEC360. Biometria via WebAuthn é viável depois, não iniciado.
- **Dashboards de gestão do supervisor** (ranking de saúde, aderência de
  inspeções, tendência de deterioração, mapa de calor) — o INSPEC360 tinha
  isso desenvolvido a fundo; aqui só as contagens básicas existem.
- **Feedback de erro de sincronização na UI** — hoje, se uma mutação falha
  no servidor (ex.: violação de constraint), ela fica só nos logs do
  backend; o usuário não vê nenhum aviso. Vale adicionar um toast/alerta
  quando `drainOutbox` reporta `status: 'error'`.
- **Import de dados reais**: sem planilha do cliente ainda. Quando chegar,
  criar um script parecido com o `import-reference-data.js` do INSPEC360
  (removido daqui por não ter o que importar ainda).
- **Ícones da GuardCorreias**: gerados automaticamente a partir do logo
  (`Referencias/Designer__4_-removebg-preview.png`) via script local — dá
  pra trocar por uma exportação oficial do designer depois, se houver uma.
- **Deploy real no Render + Neon** — nunca testado deployado (`render.yaml`
  já configurado, sem disco persistente).

## ⚠️ Bloqueio: git não encontrado nesta máquina

Não consegui rodar `git` (não está no PATH nem em `C:\Program Files\Git`) —
então **o repositório em `C:\GuardCorreias` ainda não foi inicializado**.
Antes do deploy no Render, alguém precisa, na própria máquina:

```powershell
cd C:\GuardCorreias
git init
git add .
git commit -m "GuardCorreias — versão inicial"
# depois: criar repo no GitHub e git push
```

## Como rodar localmente

```powershell
# Instala tudo (raiz + backend) — já feito nesta sessão, mas documentado
# para reinstalação futura
npm install
cd backend; npm install; cd ..

# Sobe os dois juntos (Postgres local embutido sobe sozinho no backend)
npm run dev:full
```

Acesse `http://localhost:5000`. Contas de teste (modo dev,
`VITE_DEV_MODE=true` em `.env.local`):
`tecnico@guardcorreias.com` / `supervisor@guardcorreias.com` /
`admin@guardcorreias.com`, senha `guardcorreias` para todas.

Se a porta 3001/5000 já estiver em uso por outro projeto rodando ao mesmo
tempo (ex.: o INSPEC360), rode com portas alternativas:

```powershell
$env:PORT = "3002"; $env:BACKEND_PORT = "3002"; cd backend; npm run dev
# em outro terminal:
$env:BACKEND_PORT = "3002"; npx vite --port 5001
```
