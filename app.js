const express = require('express');
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const supabase = require('./db');

const app = express();

// Middlewares per a parsers
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configuració de camins estàtics resolts (compatibilitat local i serverless)
const publicDir = fs.existsSync(path.join(process.cwd(), 'public'))
  ? path.join(process.cwd(), 'public')
  : path.join(__dirname, 'public');

app.use(express.static(publicDir));
app.use('/css', express.static(path.join(publicDir, 'css')));
app.use('/js', express.static(path.join(publicDir, 'js')));

// Motor de plantilles EJS amb camins resolts
const viewsDir = fs.existsSync(path.join(process.cwd(), 'views'))
  ? path.join(process.cwd(), 'views')
  : path.join(__dirname, 'views');

app.set('views', viewsDir);
app.set('view engine', 'ejs');

// Health check / diagnòstic de desplegament
app.get('/healthz', (req, res) => {
  res.status(200).json({
    ok: true,
    env: process.env.NODE_ENV || 'development',
    vercel: !!process.env.VERCEL,
    supabaseUrl: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'NOT SET',
    supabaseKey: (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY) ? 'SET' : 'NOT SET',
    viewsDir,
    publicDir,
    viewsDirExists: fs.existsSync(viewsDir),
    publicDirExists: fs.existsSync(publicDir),
  });
});

// Funció auxiliar per desduplicar preguntes per ID
function deduplicateQuestions(records) {
  const map = new Map();
  (records || []).forEach(record => {
    const q = record.questions || record;
    if (q && q.id && !map.has(q.id)) {
      map.set(q.id, q);
    }
  });
  return Array.from(map.values());
}

// Funció auxiliar per calcular qualificació
function calculateScore(submittedAnswers, questionsMap) {
  const qIds = Object.keys(submittedAnswers)
    .map(id => parseInt(id, 10))
    .filter(id => !isNaN(id) && (!questionsMap || questionsMap.has(id)));
  let correct = 0;
  let incorrect = 0;
  const details = [];

  for (const qId of qIds) {
    const selected = (submittedAnswers[qId] || '').toString().trim().toUpperCase();
    const correctOpt = questionsMap ? (questionsMap.get(qId) || '').toString().trim().toUpperCase() : '';
    const isCorrect = selected === correctOpt && selected !== '';
    if (isCorrect) {
      correct++;
    } else {
      incorrect++;
    }
    details.push({
      question_id: qId,
      selected_option: selected || null,
      is_correct: isCorrect
    });
  }

  const total = qIds.length;
  const score = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : 0;

  return { total, correct, incorrect, score, details };
}

// ==========================================
// 7.1. Cursos i Lliçons
// ==========================================

// 1. GET / - Llistat de cursos amb progrés
app.get('/', async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select('*, lessons(*)');

    if (error) throw error;

    const coursesWithStats = (courses || []).map(course => {
      const lessons = course.lessons || [];
      const totalLessons = lessons.length;
      const completedLessons = lessons.filter(l => l.completed).length;
      const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
      return {
        ...course,
        totalLessons,
        completedLessons,
        progressPercent
      };
    });

    res.render('pages/index', { courses: coursesWithStats });
  } catch (err) {
    console.error('Error GET /:', err.message);
    res.status(500).send('Error carregant cursos: ' + err.message);
  }
});

// 2. POST /courses - Crear nou curs
app.post('/courses', async (req, res) => {
  try {
    const { title, description } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).send('El títol del curs és obligatori');
    }

    const { error } = await supabase
      .from('courses')
      .insert({ title: title.trim(), description: description ? description.trim() : null });

    if (error) throw error;
    res.redirect('/');
  } catch (err) {
    console.error('Error POST /courses:', err.message);
    res.status(500).send('Error creant curs: ' + err.message);
  }
});

// 3. GET /course/:id - Detall del curs amb lliçons ordenades
app.get('/course/:id', async (req, res) => {
  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select('*, lessons(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !course) {
      return res.status(404).send('Curs no trobat');
    }

    if (course.lessons) {
      course.lessons.sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
    }

    const totalLessons = course.lessons.length;
    const completedLessons = course.lessons.filter(l => l.completed).length;
    const progressPercent = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    // Recents intents del curs
    const { data: attempts } = await supabase
      .from('quiz_attempts')
      .select('*')
      .eq('course_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(5);

    res.render('pages/course', {
      course: {
        ...course,
        totalLessons,
        completedLessons,
        progressPercent
      },
      attempts: attempts || []
    });
  } catch (err) {
    console.error('Error GET /course/:id:', err.message);
    res.status(500).send('Error carregant el curs: ' + err.message);
  }
});

// 4. POST /course/:id/lessons - Afegir lliçó al curs
app.post('/course/:id/lessons', async (req, res) => {
  try {
    const { title, content, video_url, order_index } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).send('El títol de la lliçó és obligatori');
    }

    const { error } = await supabase
      .from('lessons')
      .insert({
        course_id: req.params.id,
        title: title.trim(),
        content: content ? content.trim() : '',
        video_url: video_url ? video_url.trim() : null,
        order_index: parseInt(order_index, 10) || 0
      });

    if (error) throw error;
    res.redirect(`/course/${req.params.id}`);
  } catch (err) {
    console.error('Error POST /course/:id/lessons:', err.message);
    res.status(500).send('Error creant lliçó: ' + err.message);
  }
});

// 5. GET /lesson/:id - Contingut Markdown, apunts personals i preguntes associades
app.get('/lesson/:id', async (req, res) => {
  try {
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('*, courses(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !lesson) {
      return res.status(404).send('Lliçó no trobada');
    }

    // Nota personal
    const { data: note } = await supabase
      .from('notes')
      .select('*')
      .eq('lesson_id', req.params.id)
      .maybeSingle();

    // Preguntes associades
    const { data: lessonQuestions } = await supabase
      .from('lesson_questions')
      .select('question_id, questions(*)')
      .eq('lesson_id', req.params.id);

    const questionsAttached = (lessonQuestions || [])
      .map(lq => lq.questions)
      .filter(Boolean);

    // Comptar a quantes altres lliçons està associada cadascuna
    const questionIds = questionsAttached.map(q => q.id);
    if (questionIds.length > 0) {
      const { data: allAttachments } = await supabase
        .from('lesson_questions')
        .select('question_id')
        .in('question_id', questionIds);

      const countMap = {};
      (allAttachments || []).forEach(row => {
        countMap[row.question_id] = (countMap[row.question_id] || 0) + 1;
      });

      questionsAttached.forEach(q => {
        q.otherLessonsCount = Math.max(0, (countMap[q.id] || 1) - 1);
      });
    }

    // Preguntes disponibles per al Quick Attach
    const { data: allQuestions } = await supabase
      .from('questions')
      .select('id, question_text, difficulty')
      .order('id', { ascending: false });

    const attachedSet = new Set(questionIds);
    const availableQuestions = (allQuestions || []).filter(q => !attachedSet.has(q.id));

    // Renderitzar Markdown amb marked
    const contentHtml = lesson.content ? marked.parse(lesson.content) : '';

    res.render('pages/lesson', {
      lesson,
      contentHtml,
      note: note ? note.note_text : '',
      questions: questionsAttached,
      availableQuestions
    });
  } catch (err) {
    console.error('Error GET /lesson/:id:', err.message);
    res.status(500).send('Error carregant lliçó: ' + err.message);
  }
});

// 6. POST /lesson/:id/toggle - Commutar estat completat
app.post('/lesson/:id/toggle', async (req, res) => {
  try {
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('completed')
      .eq('id', req.params.id)
      .single();

    if (error || !lesson) {
      return res.status(404).send('Lliçó no trobada');
    }

    const { error: updateErr } = await supabase
      .from('lessons')
      .update({ completed: !lesson.completed })
      .eq('id', req.params.id);

    if (updateErr) throw updateErr;
    res.redirect(`/lesson/${req.params.id}`);
  } catch (err) {
    console.error('Error POST /lesson/:id/toggle:', err.message);
    res.status(500).send('Error commutant estat de la lliçó: ' + err.message);
  }
});

// 7. POST /lesson/:id/notes - Desar o actualitzar apunts personals (upsert)
app.post('/lesson/:id/notes', async (req, res) => {
  try {
    const { note_text } = req.body;
    const { error } = await supabase
      .from('notes')
      .upsert(
        {
          lesson_id: req.params.id,
          note_text: note_text || '',
          updated_at: new Date().toISOString()
        },
        { onConflict: 'lesson_id' }
      );

    if (error) throw error;
    res.redirect(`/lesson/${req.params.id}`);
  } catch (err) {
    console.error('Error POST /lesson/:id/notes:', err.message);
    res.status(500).send('Error desant nota: ' + err.message);
  }
});

// ==========================================
// 7.2. Preguntes i Associacions N:M
// ==========================================

// 8. GET /questions - Banc global de preguntes amb filtres
app.get('/questions', async (req, res) => {
  try {
    const { search, course_id, lesson_id, difficulty } = req.query;

    let query = supabase
      .from('questions')
      .select('*, lesson_questions(lesson_id, lessons(id, title, course_id, courses(id, title)))')
      .order('id', { ascending: false });

    if (difficulty) {
      query = query.eq('difficulty', difficulty);
    }
    if (search && search.trim()) {
      query = query.ilike('question_text', `%${search.trim()}%`);
    }

    const { data: questions, error } = await query;
    if (error) throw error;

    let filteredQuestions = questions || [];

    if (lesson_id) {
      filteredQuestions = filteredQuestions.filter(q =>
        (q.lesson_questions || []).some(lq => String(lq.lesson_id) === String(lesson_id))
      );
    } else if (course_id) {
      filteredQuestions = filteredQuestions.filter(q =>
        (q.lesson_questions || []).some(lq => lq.lessons && String(lq.lessons.course_id) === String(course_id))
      );
    }

    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, lessons(id, title)');

    res.render('pages/questions/index', {
      questions: filteredQuestions,
      courses: courses || [],
      search: search || '',
      course_id: course_id || '',
      lesson_id: lesson_id || '',
      difficulty: difficulty || ''
    });
  } catch (err) {
    console.error('Error GET /questions:', err.message);
    res.status(500).send('Error carregant preguntes: ' + err.message);
  }
});

// 9. GET /questions/new - Formulari de creació de pregunta
app.get('/questions/new', async (req, res) => {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select('id, title, lessons(id, title, order_index)')
      .order('id', { ascending: true });

    if (error) throw error;

    (courses || []).forEach(c => {
      if (c.lessons) {
        c.lessons.sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
      }
    });

    const preselectedLessonId = req.query.lesson_id ? parseInt(req.query.lesson_id, 10) : null;

    res.render('pages/questions/form', {
      question: null,
      courses: courses || [],
      assignedLessonIds: preselectedLessonId ? [preselectedLessonId] : [],
      isEdit: false
    });
  } catch (err) {
    console.error('Error GET /questions/new:', err.message);
    res.status(500).send('Error carregant formulari: ' + err.message);
  }
});

// 10. POST /questions - Inserir pregunta i crear vincles N:M
app.post('/questions', async (req, res) => {
  try {
    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      difficulty,
      lesson_ids
    } = req.body;

    if (!question_text || !option_a || !option_b || !option_c || !correct_option) {
      return res.status(400).send('Enunciat, opcions A, B, C i opció correcta són obligatòries');
    }

    const { data: question, error } = await supabase
      .from('questions')
      .insert({
        question_text: question_text.trim(),
        option_a: option_a.trim(),
        option_b: option_b.trim(),
        option_c: option_c.trim(),
        option_d: option_d ? option_d.trim() : null,
        correct_option: correct_option.trim().toUpperCase(),
        explanation: explanation ? explanation.trim() : null,
        difficulty: difficulty || 'mitjana'
      })
      .select()
      .single();

    if (error) throw error;

    const selectedLessonIds = Array.isArray(lesson_ids)
      ? lesson_ids
      : (lesson_ids ? [lesson_ids] : []);

    if (selectedLessonIds.length > 0 && question) {
      const rows = selectedLessonIds
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id))
        .map(lesson_id => ({ lesson_id, question_id: question.id }));

      if (rows.length > 0) {
        await supabase.from('lesson_questions').insert(rows);
      }
    }

    res.redirect('/questions');
  } catch (err) {
    console.error('Error POST /questions:', err.message);
    res.status(500).send('Error creant pregunta: ' + err.message);
  }
});

// 11. GET /questions/:id/edit - Formulari d'edició
app.get('/questions/:id/edit', async (req, res) => {
  try {
    const { data: question, error } = await supabase
      .from('questions')
      .select('*, lesson_questions(lesson_id)')
      .eq('id', req.params.id)
      .single();

    if (error || !question) {
      return res.status(404).send('Pregunta no trobada');
    }

    const { data: courses } = await supabase
      .from('courses')
      .select('id, title, lessons(id, title, order_index)')
      .order('id', { ascending: true });

    (courses || []).forEach(c => {
      if (c.lessons) {
        c.lessons.sort((a, b) => (a.order_index - b.order_index) || (a.id - b.id));
      }
    });

    const assignedLessonIds = (question.lesson_questions || []).map(lq => lq.lesson_id);

    res.render('pages/questions/form', {
      question,
      courses: courses || [],
      assignedLessonIds,
      isEdit: true
    });
  } catch (err) {
    console.error('Error GET /questions/:id/edit:', err.message);
    res.status(500).send('Error carregant pregunta: ' + err.message);
  }
});

// 12. POST /questions/:id - Actualitzar pregunta i sincronitzar N:M
app.post('/questions/:id', async (req, res) => {
  try {
    const {
      question_text,
      option_a,
      option_b,
      option_c,
      option_d,
      correct_option,
      explanation,
      difficulty,
      lesson_ids
    } = req.body;

    const { error } = await supabase
      .from('questions')
      .update({
        question_text: question_text.trim(),
        option_a: option_a.trim(),
        option_b: option_b.trim(),
        option_c: option_c.trim(),
        option_d: option_d ? option_d.trim() : null,
        correct_option: correct_option.trim().toUpperCase(),
        explanation: explanation ? explanation.trim() : null,
        difficulty: difficulty || 'mitjana'
      })
      .eq('id', req.params.id);

    if (error) throw error;

    // Sincronització de lliçons
    await supabase.from('lesson_questions').delete().eq('question_id', req.params.id);

    const selectedLessonIds = Array.isArray(lesson_ids)
      ? lesson_ids
      : (lesson_ids ? [lesson_ids] : []);

    if (selectedLessonIds.length > 0) {
      const rows = selectedLessonIds
        .map(id => parseInt(id, 10))
        .filter(id => !isNaN(id))
        .map(lesson_id => ({ lesson_id, question_id: parseInt(req.params.id, 10) }));

      if (rows.length > 0) {
        await supabase.from('lesson_questions').insert(rows);
      }
    }

    res.redirect('/questions');
  } catch (err) {
    console.error('Error POST /questions/:id:', err.message);
    res.status(500).send('Error actualitzant pregunta: ' + err.message);
  }
});

// 13. POST /questions/:id/delete - Esborrar pregunta
app.post('/questions/:id/delete', async (req, res) => {
  try {
    const { error } = await supabase
      .from('questions')
      .delete()
      .eq('id', req.params.id);

    if (error) throw error;
    res.redirect('/questions');
  } catch (err) {
    console.error('Error POST /questions/:id/delete:', err.message);
    res.status(500).send('Error eliminant pregunta: ' + err.message);
  }
});

// 14. POST /lesson/:id/questions/attach - Quick Attach
app.post('/lesson/:id/questions/attach', async (req, res) => {
  try {
    const { question_id } = req.body;
    if (question_id) {
      await supabase
        .from('lesson_questions')
        .insert({
          lesson_id: parseInt(req.params.id, 10),
          question_id: parseInt(question_id, 10)
        });
    }
    res.redirect(`/lesson/${req.params.id}`);
  } catch (err) {
    console.error('Error POST /lesson/:id/questions/attach:', err.message);
    res.status(500).send('Error vinculant pregunta: ' + err.message);
  }
});

// 15. POST /lesson/:id/questions/:questionId/detach - Quick Detach
app.post('/lesson/:id/questions/:questionId/detach', async (req, res) => {
  try {
    const { error } = await supabase
      .from('lesson_questions')
      .delete()
      .match({
        lesson_id: parseInt(req.params.id, 10),
        question_id: parseInt(req.params.questionId, 10)
      });

    if (error) throw error;
    res.redirect(`/lesson/${req.params.id}`);
  } catch (err) {
    console.error('Error POST /lesson/:id/questions/:questionId/detach:', err.message);
    res.status(500).send('Error desvinculant pregunta: ' + err.message);
  }
});

// ==========================================
// 7.3. Mode Test, Simulacres i Qualificacions
// ==========================================

// 16. GET /lesson/:id/quiz - Test per lliçó
app.get('/lesson/:id/quiz', async (req, res) => {
  try {
    const { data: lesson, error } = await supabase
      .from('lessons')
      .select('*, courses(*)')
      .eq('id', req.params.id)
      .single();

    if (error || !lesson) {
      return res.status(404).send('Lliçó no trobada');
    }

    const { data: lq } = await supabase
      .from('lesson_questions')
      .select('questions(*)')
      .eq('lesson_id', req.params.id);

    const questions = (lq || []).map(r => r.questions).filter(Boolean);

    res.render('pages/quiz', {
      title: `Simulacre: ${lesson.title}`,
      mode: 'lesson',
      targetId: req.params.id,
      courseId: lesson.course_id,
      lessonId: req.params.id,
      questions
    });
  } catch (err) {
    console.error('Error GET /lesson/:id/quiz:', err.message);
    res.status(500).send('Error preparant el quiz: ' + err.message);
  }
});

// 17. GET /course/:id/quiz - Test global de curs (amb desduplicació!)
app.get('/course/:id/quiz', async (req, res) => {
  try {
    const { data: course, error } = await supabase
      .from('courses')
      .select('*, lessons(id)')
      .eq('id', req.params.id)
      .single();

    if (error || !course) {
      return res.status(404).send('Curs no trobat');
    }

    const lessonIds = (course.lessons || []).map(l => l.id);
    let questions = [];

    if (lessonIds.length > 0) {
      const { data: lq } = await supabase
        .from('lesson_questions')
        .select('questions(*)')
        .in('lesson_id', lessonIds);

      questions = deduplicateQuestions(lq || []);
    }

    res.render('pages/quiz', {
      title: `Simulacre Global: ${course.title}`,
      mode: 'course',
      targetId: req.params.id,
      courseId: req.params.id,
      lessonId: null,
      questions
    });
  } catch (err) {
    console.error('Error GET /course/:id/quiz:', err.message);
    res.status(500).send('Error preparant el quiz de curs: ' + err.message);
  }
});

// 18. POST /quiz/submit - Càlcul de qualificació i inserció atòmica
app.post('/quiz/submit', async (req, res) => {
  try {
    const { course_id, lesson_id } = req.body;

    // Extreure respostes
    let submittedAnswers = {};
    if (req.body.answers && typeof req.body.answers === 'object') {
      submittedAnswers = req.body.answers;
    } else {
      // Cerca claus tipus answers[12] o answer_12
      Object.keys(req.body).forEach(key => {
        const matchBracket = key.match(/^answers\[(\d+)\]$/);
        const matchUnderscore = key.match(/^answer_(\d+)$/);
        if (matchBracket) {
          submittedAnswers[matchBracket[1]] = req.body[key];
        } else if (matchUnderscore) {
          submittedAnswers[matchUnderscore[1]] = req.body[key];
        }
      });
    }

    const qIds = Object.keys(submittedAnswers).map(id => parseInt(id, 10)).filter(id => !isNaN(id));

    if (qIds.length === 0) {
      return res.redirect(lesson_id ? `/lesson/${lesson_id}` : (course_id ? `/course/${course_id}` : '/'));
    }

    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('id, correct_option')
      .in('id', qIds);

    if (qErr) throw qErr;

    const questionsMap = new Map((questions || []).map(q => [q.id, q.correct_option]));
    const { total, correct, incorrect, score, details } = calculateScore(submittedAnswers, questionsMap);

    // Inserció de l'intent
    const { data: attempt, error: aErr } = await supabase
      .from('quiz_attempts')
      .insert({
        course_id: course_id ? parseInt(course_id, 10) : null,
        lesson_id: lesson_id ? parseInt(lesson_id, 10) : null,
        total_questions: total,
        correct_answers: correct,
        incorrect_answers: incorrect,
        score: score
      })
      .select()
      .single();

    if (aErr) throw aErr;

    if (attempt && details.length > 0) {
      const rows = details.map(d => ({
        attempt_id: attempt.id,
        question_id: d.question_id,
        selected_option: d.selected_option,
        is_correct: d.is_correct
      }));

      const { error: ansErr } = await supabase.from('quiz_attempt_answers').insert(rows);
      if (ansErr) throw ansErr;
    }

    res.redirect(`/quiz/attempts/${attempt.id}`);
  } catch (err) {
    console.error('Error POST /quiz/submit:', err.message);
    res.status(500).send('Error processant l\'intent de quiz: ' + err.message);
  }
});

// 19. GET /quiz/attempts/:id - Resultats i revisió
app.get('/quiz/attempts/:id', async (req, res) => {
  try {
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .select('*, courses(title), lessons(title)')
      .eq('id', req.params.id)
      .single();

    if (error || !attempt) {
      return res.status(404).send('Intent no trobat');
    }

    const { data: answers, error: ansErr } = await supabase
      .from('quiz_attempt_answers')
      .select('*, questions(*)')
      .eq('attempt_id', req.params.id);

    if (ansErr) throw ansErr;

    res.render('pages/quiz_result', {
      attempt,
      answers: answers || []
    });
  } catch (err) {
    console.error('Error GET /quiz/attempts/:id:', err.message);
    res.status(500).send('Error carregant resultats: ' + err.message);
  }
});

// Middleware global de gestió d'errors
app.use((err, req, res, next) => {
  console.error('Error global d\'Express:', err);
  if (res.headersSent) {
    return next(err);
  }
  res.status(500).send(`
    <!DOCTYPE html>
    <html lang="ca">
    <head><meta charset="UTF-8"><title>Error del Servidor</title></head>
    <body style="font-family: system-ui, sans-serif; padding: 2rem; max-width: 800px; margin: 0 auto;">
      <h1 style="color: #dc2626;">Error del Servidor</h1>
      <p><strong>Missatge:</strong> ${err.message}</p>
      <pre style="background: #f1f5f9; padding: 1rem; border-radius: 8px; overflow-x: auto;">${err.stack}</pre>
      <a href="/" style="color: #2563eb;">&larr; Tornar a l'inici</a>
    </body>
    </html>
  `);
});

// Exportar app i funcions auxiliars per a proves
module.exports = app;
module.exports.deduplicateQuestions = deduplicateQuestions;
module.exports.calculateScore = calculateScore;
