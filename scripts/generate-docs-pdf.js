/**
 * Generate PDFs from Markdown across the repo.
 * Requires: md-to-pdf (devDependency at Amaz_back root).
 *
 * Usage (from Amaz_back): npm run docs:pdf
 *
 * Output: <repo>/docs/pdf/*.pdf  (repo = parent of Amaz_back)
 */
const fs = require('fs');
const path = require('path');

const AMAZ_BACK = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(AMAZ_BACK, '..');
const DOCS = path.join(AMAZ_BACK, 'docs');
const OUTPUT_DIR = path.join(REPO_ROOT, 'docs', 'pdf');

/** @type {{ md: string, pdf: string }[]} */
const DOC_JOBS = [
  { md: path.join(DOCS, 'PLAN_MEMOIRE_DOCUMENTATION.md'), pdf: 'PLAN_MEMOIRE_DOCUMENTATION.pdf' },
  { md: path.join(DOCS, 'MANUEL_UTILISATEUR.md'), pdf: 'MANUEL_UTILISATEUR.pdf' },
  { md: path.join(DOCS, 'MICROSERVICES_FRONTEND_MAP.md'), pdf: 'MICROSERVICES_FRONTEND_MAP.pdf' },
  { md: path.join(DOCS, 'VERIFY.md'), pdf: 'VERIFY.pdf' },
  { md: path.join(DOCS, 'services', 'README.md'), pdf: 'services-index.pdf' },
  { md: path.join(DOCS, 'services', 'gateway.md'), pdf: 'service-gateway.pdf' },
  { md: path.join(DOCS, 'services', 'user-service.md'), pdf: 'service-user.pdf' },
  { md: path.join(DOCS, 'services', 'product-service.md'), pdf: 'service-product.pdf' },
  { md: path.join(DOCS, 'services', 'order-service.md'), pdf: 'service-order.pdf' },
  { md: path.join(DOCS, 'services', 'messaging-service.md'), pdf: 'service-messaging.pdf' },
  { md: path.join(DOCS, 'services', 'ai-service.md'), pdf: 'service-ai.pdf' },
  { md: path.join(DOCS, 'services', 'pepper-service.md'), pdf: 'service-pepper.pdf' },
  { md: path.join(DOCS, 'services', 'admin-service.md'), pdf: 'service-admin.pdf' },
  { md: path.join(DOCS, 'apps', 'users-app.md'), pdf: 'app-users.pdf' },
  { md: path.join(DOCS, 'apps', 'vendors-app.md'), pdf: 'app-vendors.pdf' },
  { md: path.join(DOCS, 'apps', 'qa-lab.md'), pdf: 'app-qa-lab.pdf' },
  { md: path.join(REPO_ROOT, 'users', 'DOCUMENTATION.md'), pdf: 'folder-users-DOCUMENTATION.pdf' },
  { md: path.join(REPO_ROOT, 'vendors', 'DOCUMENTATION.md'), pdf: 'folder-vendors-DOCUMENTATION.pdf' },
  { md: path.join(REPO_ROOT, 'qa-lab', 'DOCUMENTATION.md'), pdf: 'folder-qa-lab-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'gateway', 'DOCUMENTATION.md'), pdf: 'folder-gateway-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'services', 'user-service', 'DOCUMENTATION.md'), pdf: 'folder-user-service-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'services', 'product-service', 'DOCUMENTATION.md'), pdf: 'folder-product-service-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'services', 'order-service', 'DOCUMENTATION.md'), pdf: 'folder-order-service-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'services', 'messaging-service', 'DOCUMENTATION.md'), pdf: 'folder-messaging-service-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'services', 'ai-service', 'DOCUMENTATION.md'), pdf: 'folder-ai-service-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'services', 'pepper-service', 'DOCUMENTATION.md'), pdf: 'folder-pepper-service-DOCUMENTATION.pdf' },
  { md: path.join(AMAZ_BACK, 'admin-service', 'DOCUMENTATION.md'), pdf: 'folder-admin-service-DOCUMENTATION.pdf' }
];

const PDF_OPTIONS = {
  format: 'A4',
  margin: { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' }
};

async function main() {
  let mdToPdf;
  try {
    ({ mdToPdf } = require('md-to-pdf'));
  } catch {
    console.error('md-to-pdf not found. From Amaz_back run: npm install');
    process.exitCode = 1;
    return;
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log('Output directory: ' + (path.relative(process.cwd(), OUTPUT_DIR) || OUTPUT_DIR) + '\n');

  for (const { md, pdf } of DOC_JOBS) {
    if (!fs.existsSync(md)) {
      console.warn('  Skip (missing): ' + path.relative(REPO_ROOT, md));
      continue;
    }

    const dest = path.join(OUTPUT_DIR, pdf);
    try {
      await mdToPdf({ path: md }, { dest: dest, pdf_options: PDF_OPTIONS });
      console.log('  OK  ' + pdf);
    } catch (err) {
      console.error('  FAIL ' + pdf + ':', err.message);
    }
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
