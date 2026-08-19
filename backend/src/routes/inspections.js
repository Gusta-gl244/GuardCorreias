import express from 'express';
import archiver from 'archiver';
import { PassThrough } from 'stream';
import * as queries from '../database/queries-postgres.js';

const router = express.Router();

// GET /api/inspections - Obter todas as inspeções
router.get('/', async (req, res) => {
  try {
    res.json(await queries.getAllInspections());
  } catch (error) {
    console.error('❌ Erro ao buscar inspeções:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/inspections/:id - Obter inspeção por ID
router.get('/:id', async (req, res) => {
  try {
    const inspection = await queries.getInspectionById(req.params.id);
    if (!inspection) return res.status(404).json({ error: 'Inspeção não encontrada' });
    res.json(inspection);
  } catch (error) {
    console.error('❌ Erro ao buscar inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/inspections/:id/media - Mídias vinculadas a esta inspeção (a "pasta" lógica)
router.get('/:id/media', async (req, res) => {
  try {
    const media = await queries.getMediaByInspection(req.params.id);
    res.json(media.map(({ dataBase64, ...meta }) => meta)); // lista leve, sem o base64
  } catch (error) {
    console.error('❌ Erro ao buscar mídias da inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/inspections/:id/export - ZIP com a estrutura de pastas exigida:
// fotos/videos/audios/checklist.json/metadados.json, tudo dentro de uma
// pasta única com o ID da inspeção — materializada aqui, na hora do
// download, já que não há disco persistente em produção.
router.get('/:id/export', async (req, res) => {
  try {
    const inspection = await queries.getInspectionById(req.params.id);
    if (!inspection) return res.status(404).json({ error: 'Inspeção não encontrada' });
    const media = await queries.getMediaByInspection(inspection.id);

    const archive = archiver('zip', { zlib: { level: 9 } });
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${inspection.id}.zip"`);
    archive.pipe(res);

    const root = inspection.id;
    const folderFor = { foto: 'fotos', video: 'videos', audio: 'audios' };

    for (const m of media) {
      const base64 = (m.dataBase64 || '').replace(/^data:[^;]+;base64,/, '');
      archive.append(Buffer.from(base64, 'base64'), {
        name: `${root}/${folderFor[m.tipo] || 'outros'}/${m.filename}`,
      });
    }

    archive.append(JSON.stringify(inspection.stations || [], null, 2), { name: `${root}/checklist.json` });
    archive.append(
      JSON.stringify(
        {
          id: inspection.id,
          beltId: inspection.beltId,
          beltTag: inspection.beltTag,
          beltName: inspection.beltName,
          tecnicoNome: inspection.tecnicoNome,
          supervisorNome: inspection.supervisorNome,
          dataHoraAbertura: inspection.dataHoraAbertura,
          dataHoraFim: inspection.dataHoraFim,
          status: inspection.status,
          observacoesGerais: inspection.observacoesGerais,
          assinatura: inspection.assinatura,
          totalAnomalias: (inspection.anomalias || []).length,
          totalMidias: media.length,
        },
        null,
        2
      ),
      { name: `${root}/metadados.json` }
    );

    await archive.finalize();
  } catch (error) {
    console.error('❌ Erro ao exportar inspeção:', error.message);
    if (!res.headersSent) res.status(500).json({ error: error.message });
  }
});

// POST /api/inspections - Criar nova inspeção (gera o ID INS-AAAAMMDD-TAG-XXX
// automaticamente quando o cliente não envia um id — o app offline sempre
// envia, gerado localmente com o mesmo formato, para o ID já existir mesmo
// sem rede)
router.post('/', async (req, res) => {
  try {
    const inspection = await queries.createInspection(req.body);
    res.status(201).json(inspection);
  } catch (error) {
    console.error('❌ Erro ao criar inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/inspections/:id - Atualizar inspeção
router.put('/:id', async (req, res) => {
  try {
    const inspection = await queries.updateInspection(req.params.id, req.body);
    if (!inspection) return res.status(404).json({ error: 'Inspeção não encontrada' });
    res.json(inspection);
  } catch (error) {
    console.error('❌ Erro ao atualizar inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/inspections/:id
router.delete('/:id', async (req, res) => {
  try {
    await queries.deleteInspection(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
