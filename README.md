# GuardCorreias

Sistema de inspeção e gestão de correias transportadoras — Mineração Vale
Verde (planta de beneficiamento).

Arquitetura: React + Vite (frontend) · Node/Express + PostgreSQL (backend) ·
sincronização offline-first · PWA. Baseado na arquitetura do INSPEC360, com
domínio próprio (correias/estações/roletes).

Ver [`PROXIMOS_PASSOS.md`](PROXIMOS_PASSOS.md) para o estado completo da
construção, decisões tomadas e o que falta — leia esse arquivo primeiro ao
retomar o projeto.

## Rodar localmente

```powershell
npm install
cd backend; npm install; cd ..
npm run dev:full
```

Acesse `http://localhost:5000`.
