const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ejs = require('ejs');
const { marked } = require('marked');

const REQUIRED_TEMPLATES = [
  // Atoms
  'views/atoms/button.ejs',
  'views/atoms/badge.ejs',
  'views/atoms/progress-bar.ejs',
  'views/atoms/input.ejs',
  // Molecules
  'views/molecules/course-card.ejs',
  'views/molecules/search-field.ejs',
  'views/molecules/quick-attach.ejs',
  // Organisms
  'views/organisms/header.ejs',
  'views/organisms/footer.ejs',
  'views/organisms/personal-notes.ejs',
  'views/organisms/hierarchy-tree.ejs',
  'views/organisms/questions-table.ejs',
  // Templates
  'views/templates/layout.ejs',
  // Pages
  'views/pages/index.ejs',
  'views/pages/course.ejs',
  'views/pages/lesson.ejs',
  'views/pages/questions/index.ejs',
  'views/pages/questions/form.ejs',
  'views/pages/quiz.ejs',
  'views/pages/quiz_result.ejs'
];

async function verifyPhase4() {
  console.log('--- Iniciant Verificació Fase 4: SCSS, EJS i JS Client ---');

  // V4.1 - Compilació neta de SCSS
  console.log('1. Compilant SCSS sense avisos ni errors (V4.1)...');
  const sassCmd = 'npx sass public/css/scss/main.scss public/css/style.css --no-source-map';
  const sassOutput = execSync(sassCmd, { encoding: 'utf8' });
  if (sassOutput.trim().length > 0) {
    console.warn('Avís durant la compilació de Sass:', sassOutput);
  }
  const cssPath = path.join(__dirname, '..', 'public', 'css', 'style.css');
  if (!fs.existsSync(cssPath) || fs.statSync(cssPath).size === 0) {
    throw new Error('El fitxer public/css/style.css no s\'ha generat o està buit.');
  }
  console.log(`✅ SCSS compilat netament a public/css/style.css (${fs.statSync(cssPath).size} bytes) (V4.1 OK).`);

  // V4.2 - Existència i sintaxi de plantilles EJS
  console.log('2. Verificant existència i sintaxi de plantilles EJS (V4.2)...');
  for (const relPath of REQUIRED_TEMPLATES) {
    const fullPath = path.join(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Falta la plantilla requerida: ${relPath}`);
    }
    const templateStr = fs.readFileSync(fullPath, 'utf8');
    try {
      // Validar sintaxi de la plantilla amb ejs.compile
      ejs.compile(templateStr, { filename: fullPath });
    } catch (e) {
      throw new Error(`Error de sintaxi a la plantilla ${relPath}: ${e.message}`);
    }
    console.log(`  ✓ ${relPath}`);
  }
  console.log(`✅ Les ${REQUIRED_TEMPLATES.length} plantilles EJS existeixen i tenen sintaxi vàlida (V4.2 OK).`);

  // V4.3 - Renderització de Markdown amb marked
  console.log('3. Verificant transformació de Markdown amb marked (V4.3)...');
  const markdownSample = [
    '# Títol 1: L\'Estatut',
    'Aquest és un **concepte clau** sobre *competències*:',
    '- Competència exclusiva',
    '- Competència compartida',
    '',
    '> L\'article 110 estableix...',
    '',
    '```javascript',
    'const llei = "Estatut";',
    '```'
  ].join('\n');
  const renderedHtml = marked.parse(markdownSample);
  if (
    !renderedHtml.includes('<h1') ||
    !renderedHtml.includes('<strong>concepte clau</strong>') ||
    !renderedHtml.includes('<ul>') ||
    !renderedHtml.includes('<blockquote>') ||
    !renderedHtml.includes('<code')
  ) {
    throw new Error('La transformació de marked ha fallat en elements bàsics.');
  }
  console.log('✅ marked converteix correctament títols, negretes, llistes, cites i codi (V4.3 OK).');

  // V4.4 - Validació de scripts de client
  console.log('4. Validant sintaxi de fitxers JS client (V4.4)...');
  const jsFiles = ['public/js/main.js', 'public/js/quiz.js'];
  for (const jsFile of jsFiles) {
    const fullPath = path.join(__dirname, '..', jsFile);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`Fitxer JS no trobat: ${jsFile}`);
    }
    execSync(`node -c ${fullPath}`);
    console.log(`  ✓ ${jsFile}`);
  }
  console.log('✅ Scripts client public/js/main.js i public/js/quiz.js vàlids (V4.4 OK).');

  // V4.5 - Accessibilitat i disseny responsive
  console.log('5. Verificant accessibilitat i regles responsive (V4.5)...');
  const compiledCss = fs.readFileSync(cssPath, 'utf8');
  if (!compiledCss.includes('@media') || !compiledCss.includes('max-width')) {
    throw new Error('El CSS compilat no inclou media queries per a dispositius mòbils.');
  }

  // Verificar que form.ejs conté labels amb atribut for
  const formStr = fs.readFileSync(path.join(__dirname, '..', 'views/pages/questions/form.ejs'), 'utf8');
  if (!formStr.includes('<label for=') || !formStr.includes('name="question_text"')) {
    throw new Error('El formulari de preguntes no disposa d\'etiquetes label accessibles.');
  }
  console.log('✅ CSS inclou @media queries responsive i formularis contenen labels associats (V4.5 OK).');

  console.log('\n🎉 Totes les verificacions de la Fase 4 han estat superades!');
}

verifyPhase4().catch(err => {
  console.error('❌ Error en la verificació de Fase 4:', err.message);
  process.exit(1);
});
