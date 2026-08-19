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

try {
  // Ler version.json existente
  const versionContent = fs.readFileSync(versionFilePath, 'utf8');
  const versionData = JSON.parse(versionContent);

  // Atualizar buildDate com timestamp atual
  const now = new Date();
  versionData.buildDate = now.toISOString();

  // Incrementar versão patch
  const versionParts = versionData.version.split('.');
  const datePart = versionParts[1]; // 20260602
  const patchPart = parseInt(versionParts[2] || 0);
  
  // Checar se é um novo dia
  const currentDate = now.toISOString().split('T')[0].replace(/-/g, '');
  const lastDate = datePart.substring(0, 8);
  
  if (currentDate !== lastDate) {
    // Novo dia, resetar patch
    versionData.version = `2.1.${currentDate}001`;
  } else {
    // Mesmo dia, incrementar patch
    versionData.version = `2.1.${datePart}${String(patchPart + 1).padStart(3, '0')}`;
  }

  // Escrever version.json atualizado
  fs.writeFileSync(versionFilePath, JSON.stringify(versionData, null, 2) + '\n');

  console.log(`✅ version.json atualizado:`);
  console.log(`   Versão: ${versionData.version}`);
  console.log(`   Build Date: ${versionData.buildDate}`);
} catch (error) {
  console.error(`❌ Erro ao atualizar version.json:`, error.message);
  process.exit(1);
}
