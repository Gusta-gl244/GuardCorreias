import express from 'express';
import archiver from 'archiver';
import * as XLSX from 'xlsx';
import { PassThrough } from 'stream';
import * as queries from '../database/queries-postgres.js';
import { requirePermission } from '../middleware/auth.js';

const RESULT_LABELS = { ok: 'OK', nok: 'NOK', co: 'CO (com observação)', na: 'NA' };

/** Monta a planilha (.xlsx) do relatório de inspeção — layout organizado em
 * seções (identificação, os 10 itens do checklist, observações gerais,
 * assinatura), pra ser um documento legível por conta própria, não só o
 * JSON cru que já ia no ZIP. */
function buildReportWorkbook(inspection, belt) {
  const rows = [
    ['Relatório de Inspeção de Correia Transportadora'],
    [],
    ['TAG da Correia', inspection.beltTag || ''],
    ['Nome da Correia', inspection.beltName || ''],
    ['Tipo de Correia', belt?.tipoCorreia || ''],
    ['Nº da OM', inspection.omNumero || ''],
    ['Técnico', inspection.tecnicoNome || ''],
    ['Supervisor', inspection.supervisorNome || ''],
    ['Data/Hora de Abertura', inspection.dataHoraAbertura || ''],
    ['Data/Hora de Conclusão', inspection.dataHoraFim || ''],
    ['ID da Inspeção', inspection.id],
    [],
    ['ITEM', 'DESCRIÇÃO', 'RESULTADO', 'Nº OM DO ITEM', 'OBSERVAÇÃO'],
  ];

  const checklist = inspection.checklist || [];
  checklist.forEach((item, i) => {
    rows.push([
      i + 1,
      item.label,
      item.result ? RESULT_LABELS[item.result] || item.result : '—',
      item.omNumero || '',
      item.observation || '',
    ]);
  });

  rows.push([]);
  rows.push(['OBSERVAÇÕES GERAIS']);
  rows.push([inspection.observacoesGerais || '—']);

  if (inspection.assinatura) {
    rows.push([]);
    rows.push(['ASSINATURA']);
    rows.push(['Responsável', inspection.assinatura.nome || '']);
    rows.push(['Data/Hora', inspection.assinatura.dataHora || '']);
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 18 }, { wch: 45 }, { wch: 20 }, { wch: 16 }, { wch: 45 }];
  sheet['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 12 + checklist.length + 1, c: 0 }, e: { r: 12 + checklist.length + 1, c: 4 } },
    { s: { r: 12 + checklist.length + 2, c: 0 }, e: { r: 12 + checklist.length + 2, c: 4 } },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Relatório');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

const router = express.Router();

// GET /api/inspections - Obter todas as inspeções
router.get('/', requirePermission('inspections', 'view'), async (req, res) => {
  try {
    res.json(await queries.getAllInspections());
  } catch (error) {
    console.error('❌ Erro ao buscar inspeções:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/inspections/:id - Obter inspeção por ID
router.get('/:id', requirePermission('inspections', 'view'), async (req, res) => {
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
router.get('/:id/media', requirePermission('inspections', 'view'), async (req, res) => {
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
router.get('/:id/export', requirePermission('inspections', 'view'), async (req, res) => {
  try {
    const inspection = await queries.getInspectionById(req.params.id);
    if (!inspection) return res.status(404).json({ error: 'Inspeção não encontrada' });
    const media = await queries.getMediaByInspection(inspection.id);
    const belt = await queries.getBeltById(inspection.beltId);

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

    archive.append(buildReportWorkbook(inspection, belt), { name: `${root}/relatorio.xlsx` });
    archive.append(JSON.stringify(inspection.checklist || [], null, 2), { name: `${root}/checklist.json` });
    archive.append(
      JSON.stringify(
        {
          id: inspection.id,
          beltId: inspection.beltId,
          beltTag: inspection.beltTag,
          beltName: inspection.beltName,
          omNumero: inspection.omNumero,
          tecnicoNome: inspection.tecnicoNome,
          supervisorNome: inspection.supervisorNome,
          dataHoraAbertura: inspection.dataHoraAbertura,
          dataHoraFim: inspection.dataHoraFim,
          status: inspection.status,
          observacoesGerais: inspection.observacoesGerais,
          assinatura: inspection.assinatura,
          totalItensNok: (inspection.checklist || []).filter((c) => c.result === 'nok').length,
          totalItensCo: (inspection.checklist || []).filter((c) => c.result === 'co').length,
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
router.post('/', requirePermission('inspections', 'create'), async (req, res) => {
  try {
    const inspection = await queries.createInspection(req.body);
    res.status(201).json(inspection);
  } catch (error) {
    console.error('❌ Erro ao criar inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/inspections/:id - Atualizar inspeção
router.put('/:id', requirePermission('inspections', 'edit'), async (req, res) => {
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
router.delete('/:id', requirePermission('inspections', 'delete'), async (req, res) => {
  try {
    await queries.deleteInspection(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Erro ao excluir inspeção:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
