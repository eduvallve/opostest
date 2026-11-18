# Pla de Desenvolupament: OposTest (Node.js + Supabase + Vercel)

Aquest document defineix l'especificació tècnica, l'arquitectura i el pla d'implementació pas a pas per a la creació d'**OposTest**, un **Sistema de Gestió d'Aprenentatge (LMS) i Banc de Preguntes Test** preparat per a entorns de producció al núvol, amb codi a **GitHub**, desplegament continu a **Vercel** i base de dades PostgreSQL gestionada a **Supabase**.

---

## 1. Visió General del Projecte

- **Nom del Projecte:** `OposTest` (directori de treball: `opo-lms`)
- **Objectiu:** Crear una plataforma d'estudi integral per a oposicions que permeti:
  1. Organitzar cursos i temaris amb lliçons estructurades en Markdown, enllaços/vídeos i apunts personals.
  2. Gestionar un **banc de preguntes test compartit i transversal** amb relació de **Molts a Molts (N:M)**: una mateixa pregunta pot estar associada simultàniament a múltiples lliçons de diferents cursos (ex. pregunta sobre la Constitució associada a *Temari General* de *Tècnic de Gestió* i a *Temari Específic* d'*Administratiu Educatiu*).
  3. Oferir una **interfície d'administració àgil** per associar, desvincular i cercar preguntes i lliçons en pocs clics.
  4. Realitzar **simulacres de test interactius** per lliçó o per curs complet (agrupant preguntes de totes les seves lliçons sense duplicats) i **enregistrar les qualificacions i el desglossament de cada intent** (`quiz_attempts` i `quiz_attempt_answers`) per al seguiment de la progressió i el repàs d'errors.
  5. Desplegar l'aplicació en un entorn cloud serverless (**Vercel**) amb persistència robusta a **Supabase (PostgreSQL)** i control de versions a **GitHub**.
- **Arquitectura:** Monòlit basat en Node.js i Express adaptat a arquitectura **Serverless de Vercel**, amb Renderitzat al Servidor (**SSR** amb EJS) i client oficial de Supabase (`@supabase/supabase-js`).
- **Públic Objectiu:** Opositors i estudiants de temaris modulars que necessiten accedir des de qualsevol dispositiu (web a producció) amb alta disponibilitat i sincronització en el núvol.

---

## 2. Stack Tecnològic i Justificació

| Component | Tecnologia | Justificació / Rol |
| :--- | :--- | :--- |
| **Entorn d'Execució** | **Node.js** (v18+) | Entorn estàndard per a backend i funcions serverless. |
| **Framework Web** | **Express.js** (v4.x) | Marc lleuger per a SSR, adaptat per funcionar tant en desenvolupament local com com a funció serverless a Vercel. |
| **Base de Dades al Núvol** | **Supabase (PostgreSQL)** | Base de dades relacional gestionada al núvol. Suport nadiu de claus foranes, transaccions, tipus `BOOLEAN`, `TIMESTAMPTZ`, índexs i connexió serverless-friendly via el SDK `@supabase/supabase-js` (evitant el bloqueig de fitxers locals com SQLite a Vercel). |
| **Client de Base de Dades** | **`@supabase/supabase-js`** | Client HTTP/REST optimitzat per a funcions serverless (sense esgotar el pool de connexions TCP). |
| **Motor de Plantilles** | **EJS (Embedded JavaScript)** | Renderitzat directe al servidor (SSR) amb arquitectura de components basada en **Atomic Design** (àtoms, molècules, organismes, plantilles i pàgines). |
| **Estils i UI** | **SCSS personalitzat** (compilat a `public/css/style.css`) | Disseny propi, modular i adaptat a la lectura de temaris d'oposicions i execució de tests. |
| **Parser de Markdown** | **marked** | Conversió de Markdown a HTML per al contingut teòric de les lliçons. |
| **Control de Versions** | **Git / GitHub** | Dipòsit de codi i integració contínua (CI/CD). |
| **Plataforma de Desplegament** | **Vercel** | Desplegament continu automàtic per cada `git push` amb domini HTTPS gratuït (`opostest.vercel.app`). |

---

## 3. Disseny de la Base de Dades (Esquema PostgreSQL / Supabase)

L'esquema s'executa a l'**SQL Editor** del tauler de control de Supabase o mitjançant migracions.

```
┌─────────────┐       1:N        ┌─────────────┐       1:N        ┌─────────────┐
│   courses   │ ───────────────< │   lessons   │ ───────────────< │    notes    │
└─────────────┘                  └─────────────┘                  └─────────────┘
       │                                │
       │ 1:N (opcional)                 │ 1:N (opcional)
       ▼                                ▼
┌──────────────────────────────────────────────┐
│                quiz_attempts                 │ (Historial d'intents i qualificacions)
└──────────────────────────────────────────────┘
       │ 1:N
       ▼
┌──────────────────────────────────────────────┐        N:1       ┌─────────────┐
│             quiz_attempt_answers             │ ───────────────> │  questions  │
└──────────────────────────────────────────────┘                  └─────────────┘
                                                                         ▲
                                                                         │ M
                                                                         │
                                                                ┌─────────────────┐
                                                                │ lesson_questions│ (Taula Pivot N:M)
                                                                └─────────────────┘
```

### 3.1. DDL PostgreSQL per a Supabase

```sql
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
```

### 3.2. Integritat i Cascada a Supabase
- **Cursos -> Lliçons:** Si s'esborra un curs, s'eliminen automàticament les seves lliçons.
- **Lliçons -> lesson_questions:** Si s'esborra una lliçó, es desvinculen les seves files a `lesson_questions`, però **les preguntes no s'esborren del banc general**.
- **Preguntes -> lesson_questions:** Si s'elimina una pregunta del banc, s'esborren totes les seves assignacions a les lliçons (`ON DELETE CASCADE`).
- **Intents i Qualificacions (`quiz_attempts` / `quiz_attempt_answers`):** Si s'esborra un curs o lliçó, els intents mantenen el registre històric amb `course_id` / `lesson_id` assignats a `SET NULL`. Si s'esborra un intent (`quiz_attempts`), s'eliminen automàticament les seves respostes detallades a `quiz_attempt_answers` (`ON DELETE CASCADE`).

---

## 4. Estratègia d'Interfície per a l'Associació Àgil (UI / UX)

Per garantir una administració intuïtiva i ràpida de les preguntes transversals:

### A. Des del Formulari de Pregunta (`/questions/new` i `/questions/:id/edit`)
- **Arbre Jeràrquic de Lliçons amb Cerca en Temps Real:**
  - Lliçons agrupades per curs (`Nom del Curs > Lliçó`).
  - Quadre de filtre instantani amb JavaScript (en escriure "constitució" o "educatiu", l'arbre es filtra automàticament sense recarregar la pàgina).
  - Checkboxes per marcar ràpidament una o diverses lliçons.
  - Botons ràpids per bloc: *"Seleccionar tot el curs"* / *"Desmarcar tot"*.
  - En desar, el backend sincronitza de manera atòmica les relacions a `lesson_questions`.

### B. Des de la Vista de la Lliçó (`/lesson/:id`) - Gestió In Situ
- **Secció "Preguntes Associades a aquesta Lliçó":**
  1. **Llistat de preguntes vinculades:**
     - Enunciat, opcions i resposta correcta.
     - Indicador visual: *"Associada a X altres lliçons"*.
     - Botó ràpid per desvincular (`POST /lesson/:id/questions/:questionId/detach`) sense esborrar la pregunta de la base de dades.
  2. **Vincular Pregunta Existent (Quick Attach):**
     - Desplegable o selector amb cerca de preguntes del banc general no associades encara a la lliçó actual.
     - Botó `+ Vincular a aquesta lliçó` en 1 sol clic.
  3. **Creació Ràpida in situ:**
     - Botó `+ Nova Pregunta` que obre el formulari amb la lliçó actual ja preseleccionada.

### C. Des del Banc Global de Preguntes (`/questions`)
- Llistat de preguntes amb cercador de text i filtres per curs/lliçó.
- Badges interactius mostrant les lliçons on està present cada pregunta.
- Acció d'edició ràpida d'assignacions.

---

## 5. Arquitectura del Projecte per a Vercel i GitHub

A Vercel, les aplicacions Node.js / Express s'executen com a **Serverless Functions**. L'estructura de fitxers s'organitza de la manera següent:

```text
opo-lms/
├── .env.example                    # Plantilla de variables d'entorn
├── .gitignore                      # Ignora node_modules, .env, etc.
├── package.json                    # Dependències i scripts
├── vercel.json                     # Configuració de rutes serverless per a Vercel
├── api/
│   └── index.js                    # Punt d'entrada per a Vercel (exporta l'app Express)
├── db.js                           # Client de connexió a Supabase (@supabase/supabase-js)
├── app.js                          # Configuració d'Express, middlewares i rutes
├── public/                         # Fitxers estàtics servits públicament
│   ├── css/
│   │   ├── style.css               # CSS compilat
│   │   └── scss/                   # Fitxers SCSS originals
│   │       ├── main.scss
│   │       ├── _variables.scss
│   │       ├── _components.scss
│   │       └── _quiz.scss
│   └── js/
│       ├── main.js                 # JS per a filtres en viu i desplegables
│       └── quiz.js                 # Lògica interactiva per al mode test
└── views/                          # Plantilles EJS (SSR) organitzades segons Atomic Design
    ├── atoms/                      # Elements bàsics (botons, inputs, badges, barres de progrés)
    ├── molecules/                  # Combinacions simples (camps de cerca, targetes de curs, selectors)
    ├── organisms/                  # Blocs complexos (header/navbar, footer, bloc de notes, taula de preguntes)
    ├── templates/                  # Estructures de maquetació base (layouts)
    └── pages/                      # Pàgines finals renderitzades per les rutes
        ├── index.ejs               # Llistat de cursos + formulari curs
        ├── course.ejs              # Detall de curs + llista de lliçons
        ├── lesson.ejs              # Contingut Markdown + Vídeo + Notes + Preguntes de la lliçó
        ├── questions/
        │   ├── index.ejs           # Banc global de preguntes
        │   └── form.ejs            # Formulari amb selector àgil de múltiples lliçons
        ├── quiz.ejs                # Simulacre interactiu de test (per lliçó o per curs)
        └── quiz_result.ejs         # Resultat de l'intent amb qualificació i revisió de respostes
```

### 5.1. Fitxer `vercel.json`
Configuració clau perquè Vercel encamini totes les peticions cap a la funció Express i inclogui les vistes EJS i els recursos estàtics:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/index.js",
      "use": "@vercel/node",
      "config": {
        "includeFiles": ["views/**", "public/**"]
      }
    }
  ],
  "routes": [
    {
      "src": "/css/(.*)",
      "dest": "/public/css/$1"
    },
    {
      "src": "/js/(.*)",
      "dest": "/public/js/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/api/index.js"
    }
  ]
}
```

### 5.2. Adaptació del Servidor (`app.js` i `api/index.js`)
- En desenvolupament local: `app.listen(3000)` arrenca el servidor habitual.
- A Vercel: `api/index.js` importa `app` i l'exporta com a mòdul (`module.exports = app;`).

---

## 6. Mòdul de Connexió a Supabase (`db.js`)

Utilitzem el client oficial de Supabase amb les credencials del projecte obtingudes des del tauler de control (Settings > API):

```javascript
// db.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Falten les variables d'entorn SUPABASE_URL o SUPABASE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false }
});

module.exports = supabase;
```

---

## 7. Rutes i Controlador HTTP (`app.js`)

Totes les crides interactuen amb Supabase mitjançant el client SDK asíncron (`async/await`).

### 7.1. Cursos i Lliçons
| Mètode | Ruta | Descripció de l'Acció | Interacció amb Supabase | Vista / Redirecció |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/` | Llista tots els cursos i calcula el progrés de lliçons completades. | `supabase.from('courses').select('*, lessons(*)')` | `views/index.ejs` |
| `POST` | `/courses` | Crea un nou curs. | `supabase.from('courses').insert(...)` | Redirigeix a `/` |
| `GET` | `/course/:id` | Detall del curs i llista de lliçons ordenades. | `supabase.from('courses').select('*, lessons(*)').eq('id', id)` | `views/course.ejs` |
| `POST` | `/course/:id/lessons` | Afegeix una lliçó al curs. | `supabase.from('lessons').insert(...)` | Redirigeix a `/course/:id` |
| `GET` | `/lesson/:id` | Mostra contingut teòric en Markdown (convertit a HTML amb `marked`), apunts personals i preguntes associades. | Consultes a `lessons`, `notes` i `lesson_questions` | `views/lesson.ejs` |
| `POST` | `/lesson/:id/toggle` | Commuta l'estat de completat (`completed = !completed`). | `supabase.from('lessons').update({ completed: ... })` | Redirigeix a `/lesson/:id` |
| `POST` | `/lesson/:id/notes` | Desa o actualitza la nota personal de la lliçó (upsert). | `supabase.from('notes').upsert(...)` | Redirigeix a `/lesson/:id` |

### 7.2. Preguntes i Associacions N:M
| Mètode | Ruta | Descripció de l'Acció | Interacció amb Supabase |
| :--- | :--- | :--- | :--- |
| `GET` | `/questions` | Llistat del banc global amb filtres de cerca i etiquetes de lliçons vinculades. | Consulta a `questions` amb join a `lesson_questions` i `lessons` |
| `GET` | `/questions/new` | Formulari de creació amb selector d'associació a lliçons (permet `?lesson_id=X`). | Obtenir arbre de cursos i lliçons |
| `POST` | `/questions` | Insereix la pregunta i crea els vincles a `lesson_questions` per a les lliçons seleccionades. | `insert('questions')` + `insert('lesson_questions')` |
| `GET` | `/questions/:id/edit` | Formulari d'edició amb lliçons actuals marcades. | Obtenir pregunta i les seves `lesson_questions` |
| `POST` | `/questions/:id` | Actualitza dades de la pregunta i sincronitza les files a `lesson_questions`. | `update('questions')` + delete/insert a `lesson_questions` |
| `POST` | `/questions/:id/delete` | Esborra la pregunta del banc (cascada automàtica). | `supabase.from('questions').delete().eq('id', id)` |
| `POST` | `/lesson/:id/questions/attach` | **Associació àgil:** Vincula una pregunta existent a la lliçó. | `supabase.from('lesson_questions').insert({ lesson_id, question_id })` |
| `POST` | `/lesson/:id/questions/:questionId/detach` | **Desvinculació àgil:** Desvincula la pregunta d'aquesta lliçó. | `supabase.from('lesson_questions').delete().match({ lesson_id, question_id })` |

### 7.3. Mode Test, Simulacres i Qualificacions
| Mètode | Ruta | Descripció de l'Acció | Interacció amb Supabase | Vista / Redirecció |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/lesson/:id/quiz` | Inicia el test interactiu amb preguntes d'aquesta lliçó. | Obtenir preguntes vinculades a `lesson_id` | `views/pages/quiz.ejs` |
| `GET` | `/course/:id/quiz` | Inicia el test global del curs amb preguntes de totes les seves lliçons sense duplicats. | Obtenir preguntes úniques associades al curs | `views/pages/quiz.ejs` |
| `POST` | `/quiz/submit` | Enregistra l'intent de test amb la qualificació global a `quiz_attempts` i el desglossament de respostes a `quiz_attempt_answers`. | Inserció a `quiz_attempts` i `quiz_attempt_answers` | Redirigeix a `/quiz/attempts/:id` |
| `GET` | `/quiz/attempts/:id` | Mostra la qualificació obtinguda, encerts/errors i revisió detallada de cada pregunta amb explicació legal. | Consulta a `quiz_attempts` amb join a `quiz_attempt_answers` i `questions` | `views/pages/quiz_result.ejs` |

---

## 8. Guia de Desplegament: GitHub + Supabase + Vercel

### Pas 1: Configuració de Supabase
1. Crear un compte gratuït a [supabase.com](https://supabase.com) i crear un nou projecte (ex: `opostest-db`).
2. Anar a la secció **SQL Editor** del tauler de Supabase.
3. Copiar i executar el script DDL definit a la Secció 3.1 per crear les taules i els índexs.
4. Anar a **Project Settings > API** i copiar:
   - **Project URL** (`https://xyzcompany.supabase.co`)
   - **anon / public key** o **service_role key** (recomanada per a operacions de backend).

### Pas 2: Preparació del Repositori a GitHub
1. Inicialitzar Git al directori local:
   ```bash
   git init
   ```
2. Crear el fitxer `.gitignore`:
   ```text
   node_modules/
   .env
   .DS_Store
   ```
3. Crear el fitxer `.env.example`:
   ```text
   PORT=3000
   SUPABASE_URL=https://teu-projecte.supabase.co
   SUPABASE_ANON_KEY=la-teva-clau-anon-o-service-role
   ```
4. Fer el primer commit i pujar el repositori a GitHub:
   ```bash
   git add .
   git commit -m "feat: configuració inicial OposTest amb Supabase i Vercel"
   git branch -M main
   git remote add origin https://github.com/teu-usuari/opo-lms.git
   git push -u origin main
   ```

### Pas 3: Desplegament a Vercel
1. Iniciar sessió a [vercel.com](https://vercel.com) amb el compte de GitHub.
2. Fer clic a **"Add New Project"** i seleccionar el repositori `opo-lms`.
3. A la configuració del projecte, desplegar la secció **Environment Variables** i afegir:
   - `SUPABASE_URL`: La URL del projecte Supabase.
   - `SUPABASE_ANON_KEY`: La clau API de Supabase.
4. Fer clic a **Deploy**.
5. Vercel generarà una URL pública protegida per HTTPS (ex: `https://opo-lms.vercel.app`), que s'actualitzarà automàticament amb cada `git push` a la branca `main`.

---

## 9. Fases d'Implementació Pas a Pas i Verificacions de l'Agent
[implementation-phases.md](./implementation-phases.md)

---

## 10. Checklist de Verificació Global

- [ ] **Base de Dades:** Les 7 taules i els 6 índexs estan creats i verificats a Supabase.
- [ ] **Variables d'Entorn:** `SUPABASE_URL` i `SUPABASE_ANON_KEY` actives tant en local com a Vercel.
- [ ] **Serverless Ready:** `vercel.json` configurat amb `includeFiles` per a `views` i `public`.
- [ ] **Banc N:M i UI Àgil:** Formulari jeràrquic i quick attach/detach in situ funcionals.
- [ ] **Contingut i Apunts:** Renderització de Markdown amb `marked`, vídeo i notes personals per lliçó.
- [ ] **Mode Test i Resultats:** Generació de quiz per lliçó i curs complet (sense duplicats) amb registre d'intents i respostes detallades.
- [ ] **Disseny i Components:** SCSS modular compilat i plantilles organitzades segons Atomic Design.
- [ ] **Desplegament:** Repositori GitHub sincronitzat i desplegament actiu a Vercel amb HTTPS.
