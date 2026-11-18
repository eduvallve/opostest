const supabase = require('../db');

const REQUIRED_TABLES = [
  'courses',
  'lessons',
  'notes',
  'questions',
  'lesson_questions',
  'quiz_attempts',
  'quiz_attempt_answers'
];

async function verifyDatabase() {
  console.log('--- Iniciant Verificació Fase 2: Supabase ---');

  if (!process.env.SUPABASE_URL || (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_ANON_KEY)) {
    console.error('❌ Error: Falten les credencials SUPABASE_URL o SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY al fitxer .env');
    process.exit(1);
  }

  // V2.2 - Diagnòstic de connexió
  console.log('1. Provant connexió amb Supabase...');
  const { data: pingData, error: pingError } = await supabase.from('courses').select('id').limit(1);
  if (pingError && pingError.code !== 'PGRST116') {
    // Note: if table is empty, select id returns [] with error null.
    // If auth error or bad url, pingError is populated.
    console.error('❌ Error de connexió amb Supabase:', pingError.message);
    process.exit(1);
  }
  console.log('✅ Connexió amb Supabase establerta correctament (V2.2 OK).');

  // V2.3 - Introspecció de les 7 taules
  console.log('2. Verificant existència de les 7 taules...');
  for (const table of REQUIRED_TABLES) {
    const { error } = await supabase.from(table).select('*').limit(0);
    if (error) {
      console.error(`❌ La taula "${table}" no existeix o no és accessible:`, error.message);
      process.exit(1);
    }
    console.log(`  ✓ Taula "${table}" verificada.`);
  }
  console.log('✅ Les 7 taules existeixen i són accessibles (V2.3 OK).');

  // V2.4 - Integritat de claus foranes i cascada
  console.log('3. Verificant integritat de claus foranes i cascada...');
  try {
    // 3.1. Inserir dades de prova
    const { data: course, error: cErr } = await supabase
      .from('courses')
      .insert({ title: '__TEST_COURSE__', description: 'Test cascada' })
      .select()
      .single();
    if (cErr) throw new Error('Error creant curs de prova: ' + cErr.message);

    const { data: lesson, error: lErr } = await supabase
      .from('lessons')
      .insert({ course_id: course.id, title: '__TEST_LESSON__', content: 'Test' })
      .select()
      .single();
    if (lErr) throw new Error('Error creant lliçó de prova: ' + lErr.message);

    const { data: question, error: qErr } = await supabase
      .from('questions')
      .insert({
        question_text: '__TEST_QUESTION__',
        option_a: 'A',
        option_b: 'B',
        option_c: 'C',
        correct_option: 'A'
      })
      .select()
      .single();
    if (qErr) throw new Error('Error creant pregunta de prova: ' + qErr.message);

    const { error: lqErr } = await supabase
      .from('lesson_questions')
      .insert({ lesson_id: lesson.id, question_id: question.id });
    if (lqErr) throw new Error('Error vinculant lesson_question: ' + lqErr.message);

    const { data: attempt, error: aErr } = await supabase
      .from('quiz_attempts')
      .insert({
        course_id: course.id,
        lesson_id: lesson.id,
        total_questions: 1,
        correct_answers: 1,
        incorrect_answers: 0,
        score: 100
      })
      .select()
      .single();
    if (aErr) throw new Error('Error creant intent de prova: ' + aErr.message);

    const { error: ansErr } = await supabase
      .from('quiz_attempt_answers')
      .insert({
        attempt_id: attempt.id,
        question_id: question.id,
        selected_option: 'A',
        is_correct: true
      });
    if (ansErr) throw new Error('Error creant resposta de prova: ' + ansErr.message);

    // Test: Eliminar el curs -> Lliçó s'elimina en cascada
    await supabase.from('courses').delete().eq('id', course.id);

    const { data: checkLesson } = await supabase.from('lessons').select('id').eq('id', lesson.id);
    if (checkLesson && checkLesson.length > 0) {
      throw new Error('La lliçó no s\'ha eliminat en cascada en esborrar el curs.');
    }
    console.log('  ✓ Curs -> Lliçó: CASCADE verificat.');

    // Test: lesson_questions s'ha eliminat en cascada per a la lliçó esborrada, però la pregunta roman
    const { data: checkLQ } = await supabase
      .from('lesson_questions')
      .select('*')
      .eq('lesson_id', lesson.id);
    if (checkLQ && checkLQ.length > 0) {
      throw new Error('lesson_questions no s\'ha netejat per a la lliçó esborrada.');
    }

    const { data: checkQuestion } = await supabase
      .from('questions')
      .select('id')
      .eq('id', question.id);
    if (!checkQuestion || checkQuestion.length === 0) {
      throw new Error('La pregunta s\'ha esborrat indegudament en eliminar la lliçó.');
    }
    console.log('  ✓ Lliçó -> lesson_questions: CASCADE netejat i pregunta preservada.');

    // Test: quiz_attempts manté el registre amb referències a SET NULL
    const { data: checkAttempt } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('id', attempt.id)
      .single();
    if (!checkAttempt) {
      throw new Error('L\'intent de quiz ha desaparegut.');
    }
    if (checkAttempt.course_id !== null || checkAttempt.lesson_id !== null) {
      throw new Error('L\'intent no té course_id o lesson_id a NULL.');
    }
    console.log('  ✓ Intent: SET NULL verificat.');

    // Test: Eliminar pregunta -> quiz_attempt_answers s'esborra en cascada
    await supabase.from('questions').delete().eq('id', question.id);

    const { data: checkAns } = await supabase
      .from('quiz_attempt_answers')
      .select('id')
      .eq('attempt_id', attempt.id);
    if (checkAns && checkAns.length > 0) {
      throw new Error('quiz_attempt_answers no s\'ha eliminat en cascada en esborrar la pregunta.');
    }
    console.log('  ✓ Pregunta -> quiz_attempt_answers: CASCADE verificat.');

    // Netejar attempt
    await supabase.from('quiz_attempts').delete().eq('id', attempt.id);

    console.log('✅ Proves d\'integritat referencial i cascada superades amb èxit (V2.4 OK).');
  } catch (err) {
    console.error('❌ Error en el test d\'integritat referencial:', err.message);
    process.exit(1);
  }

  console.log('\n🎉 Totes les verificacions de la Fase 2 han estat superades!');
}

verifyDatabase();

