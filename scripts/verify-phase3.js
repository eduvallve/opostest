const fs = require('fs');
const path = require('path');
const app = require('../app');
const { deduplicateQuestions, calculateScore } = require('../app');

const EXPECTED_ROUTES = [
  { method: 'get', path: '/' },
  { method: 'post', path: '/courses' },
  { method: 'get', path: '/course/:id' },
  { method: 'post', path: '/course/:id/lessons' },
  { method: 'get', path: '/lesson/:id' },
  { method: 'post', path: '/lesson/:id/toggle' },
  { method: 'post', path: '/lesson/:id/notes' },
  { method: 'get', path: '/questions' },
  { method: 'get', path: '/questions/new' },
  { method: 'post', path: '/questions' },
  { method: 'get', path: '/questions/:id/edit' },
  { method: 'post', path: '/questions/:id' },
  { method: 'post', path: '/questions/:id/delete' },
  { method: 'post', path: '/lesson/:id/questions/attach' },
  { method: 'post', path: '/lesson/:id/questions/:questionId/detach' },
  { method: 'get', path: '/lesson/:id/quiz' },
  { method: 'get', path: '/course/:id/quiz' },
  { method: 'post', path: '/quiz/submit' },
  { method: 'get', path: '/quiz/attempts/:id' }
];

async function verifyPhase3() {
  console.log('--- Iniciant Verificació Fase 3: Rutes, Controlador i Serverless ---');

  // V3.2 - Validació de vercel.json
  console.log('1. Verificant vercel.json (V3.2)...');
  const vercelPath = path.join(__dirname, '..', 'vercel.json');
  if (!fs.existsSync(vercelPath)) {
    throw new Error('Fitxer vercel.json no trobat');
  }
  const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, 'utf8'));
  const build = vercelConfig.builds?.find(b => b.src === 'api/index.js');
  if (!build) {
    throw new Error('vercel.json no té build configurat per api/index.js');
  }
  const includeFiles = build.config?.includeFiles || [];
  if (!includeFiles.includes('views/**') || !includeFiles.includes('public/**')) {
    throw new Error('includeFiles no conté ["views/**", "public/**"]');
  }
  console.log('✅ vercel.json és vàlid i conté includeFiles: ["views/**", "public/**"] (V3.2 OK).');

  // V3.3 - Mapatge exhaustiu de rutes
  console.log('2. Verificant les 19 rutes d\'Express (V3.3)...');
  const registeredRoutes = [];

  // Express 4/5 router stack extraction
  const stack = app._router ? app._router.stack : (app.router ? app.router.stack : []);
  if (stack && stack.length > 0) {
    stack.forEach(layer => {
      if (layer.route && layer.route.path) {
        const routePath = layer.route.path;
        const methods = Object.keys(layer.route.methods).filter(m => layer.route.methods[m]);
        methods.forEach(m => {
          registeredRoutes.push({ method: m.toLowerCase(), path: routePath });
        });
      }
    });
  }

  console.log(`  S'han trobat ${registeredRoutes.length} rutes registrades a Express.`);

  for (const expected of EXPECTED_ROUTES) {
    const found = registeredRoutes.some(
      r => r.method === expected.method && r.path === expected.path
    );
    if (!found) {
      throw new Error(`Ruta obligatòria no trobada: ${expected.method.toUpperCase()} ${expected.path}`);
    }
    console.log(`  ✓ ${expected.method.toUpperCase().padEnd(4)} ${expected.path}`);
  }
  console.log(`✅ Les 19 rutes estan correctament definides i registrades a Express (V3.3 OK).`);

  // V3.4 - Test de desduplicació de preguntes
  console.log('3. Verificant desduplicació de preguntes (V3.4)...');
  const mockDuplicatedData = [
    { questions: { id: 101, question_text: 'Pregunta compartida 1' } },
    { questions: { id: 102, question_text: 'Pregunta única' } },
    { questions: { id: 101, question_text: 'Pregunta compartida 1 (duplicada per estar a lliçó 2)' } }
  ];

  const deduplicated = deduplicateQuestions(mockDuplicatedData);
  if (deduplicated.length !== 2) {
    throw new Error(`La desduplicació ha fallat: esperades 2 preguntes, obtingudes ${deduplicated.length}`);
  }
  if (deduplicated[0].id !== 101 || deduplicated[1].id !== 102) {
    throw new Error('Els IDs de les preguntes desduplicades no coincideixen');
  }
  console.log('✅ Desduplicació de preguntes correcta per al quiz global (V3.4 OK).');

  // V3.5 - Test de càlcul de qualificació
  console.log('4. Verificant càlcul de qualificacions (V3.5)...');
  const qMap = new Map([
    [1, 'A'],
    [2, 'B'],
    [3, 'C'],
    [4, 'D']
  ]);

  // Test 1: 4 de 4 = 100%
  const res100 = calculateScore({ 1: 'A', 2: 'B', 3: 'C', 4: 'D' }, qMap);
  if (res100.score !== 100 || res100.correct !== 4 || res100.incorrect !== 0) {
    throw new Error(`Càlcul 100% incorrecte: ${JSON.stringify(res100)}`);
  }

  // Test 2: 3 de 4 = 75%
  const res75 = calculateScore({ 1: 'A', 2: 'B', 3: 'C', 4: 'A' }, qMap);
  if (res75.score !== 75 || res75.correct !== 3 || res75.incorrect !== 1) {
    throw new Error(`Càlcul 75% incorrecte: ${JSON.stringify(res75)}`);
  }

  // Test 3: 1 de 3 = 33.33%
  const qMap3 = new Map([[1, 'A'], [2, 'B'], [3, 'C']]);
  const res33 = calculateScore({ 1: 'A', 2: 'A', 3: 'A' }, qMap3);
  if (res33.score !== 33.33 || res33.correct !== 1 || res33.incorrect !== 2) {
    throw new Error(`Càlcul 33.33% incorrecte: ${JSON.stringify(res33)}`);
  }

  console.log('✅ Lògica de càlcul de percentatges i desglossament verificada (V3.5 OK).');
  console.log('\n🎉 Totes les verificacions de la Fase 3 han estat superades!');
}

verifyPhase3().catch(err => {
  console.error('❌ Error en la verificació de Fase 3:', err.message);
  process.exit(1);
});

