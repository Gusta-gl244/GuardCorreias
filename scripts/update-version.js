#!/usr/bin/env node

/**
 * Script para atualizar version.json com data/hora atual de build
 * Executado automaticamente durante build no Render
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const versionFilePath = path.join(__dirname, '../public/version.json');
const swFilePath = path.join(__dirname, '../public/service-worker.js');

try {
  // Ler version.json existente
  const versionContent = fs.readFileSync(versionFilePath, 'utf8');
  const versionData = JSON.parse(versionContent);

  // Atualizar buildDate com timestamp atual
  const now = new Date();
  versionData.buildDate = now.toISOString();

  // Incrementar versão patch. Formato: "2.1.AAAAMMDDNNN" (8 dígitos de data +
  // 3 de patch) — versionParts[2] é essa string combinada; versionParts[1]
  // é só o literal "1" (bug antigo: comparava isso com a data atual, nunca
  // batia, então sempre caía no ramo "novo dia" e o patch nunca incrementava
  // de verdade dentro do mesmo dia).
  const versionParts = versionData.version.split('.');
  const lastDateAndPatch = versionParts[2] || '';
  const lastDate = lastDateAndPatch.substring(0, 8);
  const lastPatch = parseInt(lastDateAndPatch.slice(8) || '0', 10);

  const currentDate = now.toISOString().split('T')[0].replace(/-/g, '');

  versionData.version = currentDate === lastDate
    ? `2.1.${currentDate}${String(lastPatch + 1).padStart(3, '0')}` // mesmo dia, incrementa patch
    : `2.1.${currentDate}001`; // novo dia, reseta patch

  // Escrever version.json atualizado
  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2) + '\n');

  console.log(`✅ version.json atualizado:`);
  console.log(`   Versão: ${versionData.version}`);
  console.log(`   Build Date: ${versionData.buildDate}`);

  // O Service Worker só é redetectado pelo navegador quando o conteúdo do
  // arquivo muda — sem isso, um BUILD_VERSION fixo faz o SW nunca notar que
  // existe uma versão nova, e o app fica preso na versão antiga em cache
  // mesmo depois de um deploy novo (mesmo com F5). Sincroniza o
  // BUILD_VERSION do service-worker.js com a versão gerada aqui, então todo
  // build produz um arquivo diferente do anterior.
  const swContent = fs.readFileSync(swFilePath, 'utf8');
  const buildVersionPattern = /const BUILD_VERSION = '[^']*'/;
  if (!buildVersionPattern.test(swContent)) {
    throw new Error('Não encontrei a linha "const BUILD_VERSION = ..." em service-worker.js — verifique se o arquivo mudou de formato.');
  }
  // Usa o buildDate (timestamp com milissegundos, único por build) em vez do
  // "version" com patch diário — garante que todo build produz um
  // BUILD_VERSION diferente do anterior, mesmo com vários deploys no mesmo
  // dia/minuto.
  const updatedSw = swContent.replace(buildVersionPattern, `const BUILD_VERSION = '${versionData.buildDate}'`);
  fs.writeFileSync(swFilePath, updatedSw);
  console.log(`✅ service-worker.js sincronizado com a versão ${versionData.buildDate}`);
} catch (error) {
  console.error(`❌ Erro ao atualizar version.json:`, error.message);
  process.exit(1);
}
