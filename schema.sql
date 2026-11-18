-- 1. Taula de Cursos / Convocatòries
CREATE TABLE IF NOT EXISTS courses (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Taula de Lliçons / Temes
CREATE TABLE IF NOT EXISTS lessons (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,                             -- Contingut teòric en Markdown
  video_url TEXT,                           -- Enllaç a YouTube o recurs de vídeo
  order_index INTEGER DEFAULT 0,            -- Ordre dins del curs
  completed BOOLEAN DEFAULT FALSE,          -- Estat d'estudi
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Taula d'Apunts Personals per Lliçó
CREATE TABLE IF NOT EXISTS notes (
  id BIGSERIAL PRIMARY KEY,
  lesson_id BIGINT NOT NULL UNIQUE REFERENCES lessons(id) ON DELETE CASCADE,
  note_text TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Taula de Preguntes (Banc Centralitzat)
CREATE TABLE IF NOT EXISTS questions (
  id BIGSERIAL PRIMARY KEY,
  question_text TEXT NOT NULL,               -- Enunciat de la pregunta
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT,                             -- Opcional (tests de 3 o 4 opcions)
  correct_option VARCHAR(1) NOT NULL,        -- 'A', 'B', 'C' o 'D'
  explanation TEXT,                          -- Justificació legal o explicació
  difficulty TEXT DEFAULT 'mitjana',         -- 'facil', 'mitjana', 'dificil'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Taula d'Associació N:M (Lliçons <-> Preguntes)
CREATE TABLE IF NOT EXISTS lesson_questions (
  lesson_id BIGINT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (lesson_id, question_id)
);

-- 6. Taula d'Intents de Test (Qualificacions)
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id BIGSERIAL PRIMARY KEY,
  course_id BIGINT REFERENCES courses(id) ON DELETE SET NULL,
  lesson_id BIGINT REFERENCES lessons(id) ON DELETE SET NULL,
  total_questions INTEGER NOT NULL,
  correct_answers INTEGER NOT NULL,
  incorrect_answers INTEGER NOT NULL,
  score NUMERIC(5,2) NOT NULL,                    -- Qualificació / percentatge (ex: 85.00)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Taula de Respostes del Test per Intent (Desglossament per pregunta)
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id BIGSERIAL PRIMARY KEY,
  attempt_id BIGINT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_option VARCHAR(1),                     -- 'A', 'B', 'C', 'D' o NULL si no contestada
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índexs de rendiment per a consultes creuades
CREATE INDEX IF NOT EXISTS idx_lq_lesson ON lesson_questions(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lq_question ON lesson_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_attempts_course ON quiz_attempts(course_id);
CREATE INDEX IF NOT EXISTS idx_attempts_lesson ON quiz_attempts(lesson_id);
CREATE INDEX IF NOT EXISTS idx_answers_attempt ON quiz_attempt_answers(attempt_id);

