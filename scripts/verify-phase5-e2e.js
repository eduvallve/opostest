const http = require('http');
const app = require('../app');
const supabase = require('../db');

const PORT = 3001; // Port de proves per no interferir
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function runE2ETests() {
  console.log('--- Iniciant Verificació Fase 5: Banc de Proves E2E en Local ---');

  // Arrencar servidor HTTP
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  console.log(`Servidor de test arrencat a ${BASE_URL}`);

  try {
    // V5.1 - Arrencada local i HTTP 200 a l'arrel
    console.log('1. Provant GET / (V5.1)...');
    const resHome = await fetch(`${BASE_URL}/`);
    if (resHome.status !== 200) {
      throw new Error(`GET / ha retornat status ${resHome.status}`);
    }
    const htmlHome = await resHome.text();
    if (!htmlHome.includes('Tècnic de Gestió de la Generalitat') || !htmlHome.includes('Administratiu Educatiu')) {
      throw new Error('La pàgina principal no mostra els cursos carregats al seed.');
    }
    console.log('✅ GET / respon 200 OK i renderitza els cursos correctament (V5.1 OK).');

    // Obtenir dades per a proves
    const { data: courses } = await supabase.from('courses').select('id, lessons(id, title)').order('id');
    const c1 = courses[0];
    const l1 = c1.lessons[0];
    const l2 = c1.lessons[1];

    // V5.2 - Prova de Lliçó (Markdown + Notes + Toggle)
    console.log('2. Provant Lliçó: Markdown, Apunts i Toggle (V5.2)...');
    // 2.1 GET /lesson/:id
    const resLesson = await fetch(`${BASE_URL}/lesson/${l1.id}`);
    if (resLesson.status !== 200) {
      throw new Error(`GET /lesson/${l1.id} ha retornat status ${resLesson.status}`);
    }
    const htmlLesson = await resLesson.text();
    if (!htmlLesson.includes('📖 Contingut Teòric') || !htmlLesson.includes('<h1') || !htmlLesson.includes('Principis Fonamentals')) {
      throw new Error('El Markdown de la lliçó no s\'ha renderitzat correctament a HTML.');
    }

    // 2.2 POST /lesson/:id/notes
    const noteContent = 'Aquesta és una nota d\'estudi guardada durant el test E2E.';
    const resNotes = await fetch(`${BASE_URL}/lesson/${l1.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ note_text: noteContent }),
      redirect: 'manual'
    });
    if (resNotes.status !== 302) {
      throw new Error(`POST /lesson/:id/notes ha retornat status ${resNotes.status} en comptes de 302`);
    }

    // Comprovar a BD
    const { data: dbNote } = await supabase.from('notes').select('*').eq('lesson_id', l1.id).single();
    if (!dbNote || dbNote.note_text !== noteContent) {
      throw new Error('La nota personal no s\'ha desat correctament a la base de dades.');
    }

    // 2.3 POST /lesson/:id/toggle
    const { data: prevLesson } = await supabase.from('lessons').select('completed').eq('id', l1.id).single();
    const prevCompleted = prevLesson.completed;

    const resToggle = await fetch(`${BASE_URL}/lesson/${l1.id}/toggle`, {
      method: 'POST',
      redirect: 'manual'
    });
    if (resToggle.status !== 302) {
      throw new Error(`POST /lesson/:id/toggle ha retornat status ${resToggle.status}`);
    }
    const { data: dbLessonToggled } = await supabase.from('lessons').select('completed').eq('id', l1.id).single();
    if (dbLessonToggled.completed === prevCompleted) {
      throw new Error(`L'estat completed no ha commutat (continua sent ${prevCompleted}).`);
    }
    console.log('✅ Markdown renderitzat, notes desades i toggle d\'estat validat (V5.2 OK).');

    // V5.3 - Prova de Gestió N:M (Quick Attach / Detach)
    console.log('3. Provant N:M Quick Attach / Detach (V5.3)...');
    // Cercar una pregunta que no estigui a l2
    const { data: allQuestions } = await supabase.from('questions').select('id').order('id');
    const targetQ = allQuestions[3]; // Q4 (Llei 39/2015)

    // Quick Attach a l2
    const resAttach = await fetch(`${BASE_URL}/lesson/${l2.id}/questions/attach`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ question_id: targetQ.id }),
      redirect: 'manual'
    });
    if (resAttach.status !== 302) throw new Error('Quick Attach no ha redirigit');

    const { data: checkAttach } = await supabase
      .from('lesson_questions')
      .select('*')
      .match({ lesson_id: l2.id, question_id: targetQ.id });
    if (!checkAttach || checkAttach.length === 0) {
      throw new Error('La pregunta no s\'ha vinculat a lesson_questions.');
    }

    // Quick Detach
    const resDetach = await fetch(`${BASE_URL}/lesson/${l2.id}/questions/${targetQ.id}/detach`, {
      method: 'POST',
      redirect: 'manual'
    });
    if (resDetach.status !== 302) throw new Error('Quick Detach no ha redirigit');

    const { data: checkDetach } = await supabase
      .from('lesson_questions')
      .select('*')
      .match({ lesson_id: l2.id, question_id: targetQ.id });
    if (checkDetach && checkDetach.length > 0) {
      throw new Error('La pregunta no s\'ha desvinculat.');
    }

    const { data: checkStillExists } = await supabase
      .from('questions')
      .select('id')
      .eq('id', targetQ.id);
    if (!checkStillExists || checkStillExists.length === 0) {
      throw new Error('La pregunta s\'ha esborrat indegudament en desvincular-la.');
    }
    console.log('✅ Quick Attach i Detach comprovats correctament preservant la pregunta al banc (V5.3 OK).');

    // V5.4 - Prova de Simulacre de Quiz i Qualificació
    console.log('4. Provant Simulacre de Quiz i Qualificació (V5.4)...');
    // GET /course/:id/quiz
    const resQuiz = await fetch(`${BASE_URL}/course/${c1.id}/quiz`);
    if (resQuiz.status !== 200) throw new Error('GET /course/:id/quiz no respon 200');
    const htmlQuiz = await resQuiz.text();

    // Comprovar desduplicació: Q5 està associada a Tema 1 i Tema 2 de Gestió
    // Al formulari només ha d'aparèixer un sol q-card amb id "q-card-ID_DE_Q5"
    const { data: q5 } = await supabase
      .from('questions')
      .select('id')
      .ilike('question_text', '%llei orgànica%')
      .single();

    const matchesQ5 = (htmlQuiz.match(new RegExp(`id="q-card-${q5.id}"`, 'g')) || []).length;
    if (matchesQ5 !== 1) {
      throw new Error(`La pregunta transversal compartida apareix ${matchesQ5} vegades en comptes d'1 sola.`);
    }

    // Obtenir preguntes del curs per fer el POST
    const { data: lqCourse } = await supabase
      .from('lesson_questions')
      .select('questions(id, correct_option)')
      .in('lesson_id', [l1.id, l2.id]);

    const deduplicatedQ = [];
    const seen = new Set();
    lqCourse.forEach(item => {
      if (item.questions && !seen.has(item.questions.id)) {
        seen.add(item.questions.id);
        deduplicatedQ.push(item.questions);
      }
    });

    const submitParams = new URLSearchParams();
    submitParams.append('course_id', c1.id);
    // Contestem totes correctes menys 1
    deduplicatedQ.forEach((q, idx) => {
      if (idx === 0) {
        submitParams.append(`answers[${q.id}]`, 'Z'); // Errada expressament
      } else {
        submitParams.append(`answers[${q.id}]`, q.correct_option);
      }
    });

    const resSubmit = await fetch(`${BASE_URL}/quiz/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: submitParams,
      redirect: 'manual'
    });

    if (resSubmit.status !== 302) {
      throw new Error(`POST /quiz/submit ha retornat status ${resSubmit.status}`);
    }

    const location = resSubmit.headers.get('location');
    if (!location || !location.startsWith('/quiz/attempts/')) {
      throw new Error(`Redirecció inesperada: ${location}`);
    }

    const attemptId = location.split('/').pop();
    const resResult = await fetch(`${BASE_URL}/quiz/attempts/${attemptId}`);
    if (resResult.status !== 200) {
      throw new Error('GET /quiz/attempts/:id no respon 200');
    }
    const htmlResult = await resResult.text();

    if (
      !htmlResult.includes('Qualificació Final del Simulacre') ||
      !htmlResult.includes('Revisió Detallada de Preguntes') ||
      !htmlResult.includes('Justificació Legal')
    ) {
      throw new Error('La pàgina de resultats no mostra la qualificació o el desglossament legal.');
    }
    console.log('✅ Simulacre global desduplicat, qualificació calculada i desglossament legal verificats (V5.4 OK).');

    // V5.5 - Prova de recursos estàtics servits
    console.log('5. Provant lliurament de recursos estàtics (V5.5)...');
    const resCss = await fetch(`${BASE_URL}/css/style.css`);
    if (resCss.status !== 200) throw new Error('GET /css/style.css no respon 200');
    const cssContentType = resCss.headers.get('content-type') || '';
    if (!cssContentType.includes('text/css')) {
      throw new Error(`Content-Type de CSS incorrecte: ${cssContentType}`);
    }

    const resJs = await fetch(`${BASE_URL}/js/main.js`);
    if (resJs.status !== 200) throw new Error('GET /js/main.js no respon 200');
    const jsContentType = resJs.headers.get('content-type') || '';
    if (!jsContentType.includes('javascript')) {
      throw new Error(`Content-Type de JS incorrecte: ${jsContentType}`);
    }

    console.log('✅ /css/style.css (text/css) i /js/main.js (application/javascript) servits correctament (V5.5 OK).');

    console.log('\n🎉 Totes les 5 verificacions de la Fase 5 han estat superades amb èxit!');
  } finally {
    server.close();
  }
}

runE2ETests().catch(err => {
  console.error('❌ Error en el test E2E de Fase 5:', err);
  process.exit(1);
});
