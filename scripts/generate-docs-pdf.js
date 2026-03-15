/**
 * Generate PDF documentation from Markdown service docs.
 * Requires: npm install md-to-pdf (or run from project root with devDependencies).
 *
 * Usage: node scripts/generate-docs-pdf.js
 *   Or:  npm run docs:pdf
 *
 * Output: docs/output/*.pdf
 */
const fs = require('fs');
const path = require('path');

const DOCS_DIR = path.resolve(__dirname, '../docs/services');
const OUTPUT_DIR = path.resolve(__dirname, '../docs/output');

const MD_FILES = [
  'README.md',
  'gateway.md',
  'user-service.md',
  'product-service.md',
  'order-service.md',
  'messaging-service.md',
  'ai-service.md',
  'pepper-service.md'
];

async function main() {
  let mdToPdf;
  try {
    ({ mdToPdf } = require('md-to-pdf'));
  } catch {
    console.error('md-to-pdf not found. Install with: npm install md-to-pdf');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Generating PDFs from docs/services/...\n');

  for (const file of MD_FILES) {
    const mdPath = path.join(DOCS_DIR, file);
    if (!fs.existsSync(mdPath)) {
      console.warn(`  Skip (not found): ${file}`);
      continue;
    }

    const baseName = path.basename(file, '.md');
    const pdfPath = path.join(OUTPUT_DIR, `${baseName}.pdf`);

    try {
      await mdToPdf(
        { path: mdPath },
        {
          dest: pdfPath,
          pdf_options: { format: 'A4', margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' } }
        }
      );
      console.log(`  ${file} -> ${path.relative(path.resolve(__dirname, '..'), pdfPath)}`);
    } catch (err) {
      console.error(`  Failed ${file}:`, err.message);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
