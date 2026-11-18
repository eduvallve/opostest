## 9. Fases d'Implementació Pas a Pas i Verificacions de l'Agent

A continuació es detalla el pla d'implementació fase a fase, garantint la cobertura total de totes les funcionalitats definides a les seccions anteriors (cursos, lliçons Markdown amb `marked`, apunts personals, banc N:M amb arbre jeràrquic i quick attach/detach, simulacre de quiz amb respostes detallades a `quiz_attempts` i `quiz_attempt_answers`, arquitectura Atomic Design EJS, SCSS i desplegament serverless a Vercel). Per a cada fase s'estableixen les **verificacions objectives i executables per part de l'agent** com a condició indispensable per donar la fase per completada (*Definition of Done*).

---

### Fase 1: Inicialització de l'Entorn, Dependències i Tooling
1. **Inicialització del projecte:**
   - Executar `npm init -y` per generar el `package.json`.
2. **Instal·lació de dependències de producció:**
   - `npm install express @supabase/supabase-js ejs marked dotenv`
3. **Instal·lació de dependències de desenvolupament:**
   - `npm install --save-dev nodemon sass`
4. **Configuració de scripts a `package.json`:**
   - `"start": "node api/index.js"`
   - `"dev": "nodemon api/index.js"`
   - `"scss": "sass --watch public/css/scss:public/css"`
   - `"build:css": "sass public/css/scss/main.scss public/css/style.css --style compressed"`
5. **Configuració de Git i Entorn:**
   - Crear `.gitignore` (amb `node_modules/`, `.env`, `.DS_Store`).
   - Crear `.env.example` amb les claus `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

#### Verificacions obligatòries per part de l'agent (Fase 1):
- [ ] **V1.1 - Validació de dependències:** Executar `npm ls` per verificar que no hi ha dependències trencades ni conflictes de versions a `node_modules/`.
- [ ] **V1.2 - Validació de scripts:** Comprovar que `package.json` conté els scripts `start`, `dev`, `scss` i `build:css`.
- [ ] **V1.3 - Protecció de credencials:** Verificar mitjançant comprovació de fitxers que `.gitignore` ignora estrictament `.env` i `node_modules/`.
- [ ] **V1.4 - Plantilla d'entorn:** Comprovar que `.env.example` conté totes les claus necessàries sense exposar valors secrets reals.

---

### Fase 2: Base de Dades Supabase (DDL, Índexs, Integritat) i Client `db.js`
1. **Execució i Verificació de l'Esquema DDL a Supabase:**
   - Assegurar l'execució íntegra de les 7 taules:
     1. `courses`
     2. `lessons`
     3. `notes`
     4. `questions`
     5. `lesson_questions` (taula pivot N:M amb clau primària composta)
     6. `quiz_attempts` (historial d'intents)
     7. `quiz_attempt_answers` (desglossament de respostes per intent)
   - Assegurar la creació dels 6 índexs de rendiment (`idx_lq_lesson`, `idx_lq_question`, `idx_lessons_course`, `idx_attempts_course`, `idx_attempts_lesson`, `idx_answers_attempt`).
2. **Configuració del mòdul `db.js`:**
   - Instanciació del client oficial `@supabase/supabase-js` amb gestió segura de variables d'entorn i `auth: { persistSession: false }`.
3. **Creació d'un script d'inicialització i verificació de la base de dades:**
   - Script automatitzat que comprova la connectivitat i presència de les taules i camps.

#### Verificacions obligatòries per part de l'agent (Fase 2):
- [ ] **V2.1 - Sintaxi de `db.js`:** Executar `node -c db.js` per confirmar que el fitxer no conté errors de sintaxi i que importa `@supabase/supabase-js`.
- [ ] **V2.2 - Diagnòstic de connexió:** Executar un script de test que faci ping a Supabase i comprovi l'autenticació de la clau API.
- [ ] **V2.3 - Introspecció de taules:** Verificar que les 7 taules existeixen fent un `select('*').limit(0)` a cadascuna (`courses`, `lessons`, `notes`, `questions`, `lesson_questions`, `quiz_attempts`, `quiz_attempt_answers`).
- [ ] **V2.4 - Integritat de claus foranes i cascada:** Executar una prova transaccional que verifiqui:
  - Eliminar un curs esborra les seves lliçons (`CASCADE`).
  - Eliminar una lliçó esborra les files a `lesson_questions` però manté la pregunta intacta a `questions`.
  - Eliminar una pregunta esborra les files a `lesson_questions` i `quiz_attempt_answers` (`CASCADE`).
  - Eliminar un curs/lliçó manté l'intent a `quiz_attempts` amb referències a `SET NULL`.

---

### Fase 3: Controlador, Lògica de Negoci i Rutes Serverless (`app.js`, `api/index.js`, `vercel.json`)
1. **Configuració de l'App Express (`app.js`):**
   - Parser de formularis: `express.urlencoded({ extended: true })` i `express.json()`.
   - Configuració de rutes estàtiques (`/css`, `/js`, `public`).
   - Configuració del motor de vistes EJS resolt amb camins absoluts (`path.join(__dirname, 'views')`).
2. **Punt d'entrada Serverless (`api/index.js`):**
   - Exportació de `app` per a Vercel (`module.exports = app`).
   - Condicional per arrencar `app.listen(PORT)` únicament si s'executa en local (`NODE_ENV !== 'production'`).
3. **Configuració de Vercel (`vercel.json`):**
   - Definició del build `@vercel/node` amb `includeFiles: ["views/**", "public/**"]`.
   - Configuració mínima compatible amb local i Vercel: cap rewite/ruta estàtica separada és necessària per `/css` i `/js`; el catch-all recorre a `/api/index.js` i `express.static` continua servint els recursos.
   - Rutes: un únic catch-all `/(.*) -> /api/index.js`.
4. **Implementació de tots els controladors i rutes:**
   - **Cursos i lliçons (Secció 7.1):** `GET /`, `POST /courses`, `GET /course/:id`, `POST /course/:id/lessons`, `GET /lesson/:id`, `POST /lesson/:id/toggle`, `POST /lesson/:id/notes` (amb `marked` per al contingut teòric i upsert de notes).
   - **Preguntes i N:M àgil (Secció 7.2):** `GET /questions`, `GET /questions/new`, `POST /questions`, `GET /questions/:id/edit`, `POST /questions/:id`, `POST /questions/:id/delete`, `POST /lesson/:id/questions/attach`, `POST /lesson/:id/questions/:questionId/detach`.
   - **Mode Test i Qualificacions (Secció 7.3):**
     - `GET /lesson/:id/quiz` (preguntes de la lliçó).
     - `GET /course/:id/quiz` (preguntes de totes les lliçons del curs sense duplicats).
     - `POST /quiz/submit` (càlcul de nota, inserció atòmica a `quiz_attempts` i inserció detallada de cada resposta a `quiz_attempt_answers`).
     - `GET /quiz/attempts/:id` (revisió del resultat, encerts, errors i explicació legal).

#### Verificacions obligatòries per part de l'agent (Fase 3):
- [ ] **V3.1 - Validació de sintaxi:** Executar `node -c app.js` i `node -c api/index.js`.
- [ ] **V3.2 - Validació de `vercel.json`:** Verificar que el JSON és vàlid i que `includeFiles` té exactament `["views/**", "public/**"]`.
- [ ] **V3.3 - Mapatge exhaustiu de rutes:** Executar un script d'inspecció de l'stack de rutes d'Express (`app._router.stack`) per comprovar que les 19 rutes definides a la Secció 7 estan registrades amb el seu mètode HTTP corresponent.
- [ ] **V3.4 - Test de desduplicació de preguntes:** Executar un test unitari/d'integració per a la consulta de `GET /course/:id/quiz` que asseguri que si una pregunta està associada a dues lliçons del mateix curs, només apareix una única vegada al test global.
- [ ] **V3.5 - Test de càlcul de qualificació:** Verificar que la lògica de `POST /quiz/submit` calcula correctament el percentatge i emmagatzema les respostes a `quiz_attempts` i `quiz_attempt_answers`.

---

### Fase 4: Sistema de Disseny (SCSS), Vistes EJS (Atomic Design) i JS Interactiu Client
1. **Arquitectura d'Estils SCSS:**
   - Crear `public/css/scss/`: `main.scss`, `_variables.scss`, `_components.scss`, `_quiz.scss`.
   - Compilar amb Sass a `public/css/style.css`.
2. **Jerarquia de Vistes EJS (Atomic Design):**
   - **Àtoms (`views/atoms/`):** botons, badges de lliçons, barres de progrés, inputs.
   - **Molècules (`views/molecules/`):** camp de cerca amb filtre en viu, targeta de curs, selector ràpid de preguntes.
   - **Organismes (`views/organisms/`):** `header.ejs`, `footer.ejs`, bloc d'apunts personals, arbre jeràrquic de selecció de lliçons, taula del banc de preguntes.
   - **Plantilles (`views/templates/`):** layout base.
   - **Pàgines (`views/pages/`):**
     - `index.ejs` (cursos + barra de progrés acumulada).
     - `course.ejs` (detall del curs + llista de lliçons ordenades).
     - `lesson.ejs` (visor de lliçó en Markdown amb `marked`, vídeo, estat completat, bloc de notes i gestió in situ de preguntes associades).
     - `questions/index.ejs` (banc global de preguntes amb filtres i badges).
     - `questions/form.ejs` (formulari de pregunta amb arbre jeràrquic i cerca en viu).
     - `quiz.ejs` (interfície interactiva del test).
     - `quiz_result.ejs` (desglossament de resultat, nota i explicacions legals).
3. **Scripts JavaScript Client:**
   - `public/js/main.js`:
     - Filtre instantani sense recàrrega de l'arbre de lliçons a `form.ejs`.
     - Botons ràpids per bloc (*"Seleccionar tot el curs"* / *"Desmarcar tot"*).
     - Modal o desplegable de cerca ràpida per al Quick Attach a `lesson.ejs`.
   - `public/js/quiz.js`:
     - Gestió interactiva del simulacre (avanç de preguntes, selecció d'opcions i confirmació d'enviament).

#### Verificacions obligatòries per part de l'agent (Fase 4):
- [ ] **V4.1 - Compilació neta de SCSS:** Executar `npx sass public/css/scss/main.scss public/css/style.css` i comprovar que s'ha generat `public/css/style.css` sense errors ni avisos.
- [ ] **V4.2 - Comprovació d'existència de plantilles EJS:** Comprovar programàticament que tots els fitxers de `views/pages/`, `views/organisms/`, `views/molecules/` i `views/atoms/` existeixen i són sintàcticament vàlids.
- [ ] **V4.3 - Renderització de Markdown amb `marked`:** Verificar que `marked` transforma correctament elements de bloc, llistes, negretes i títols a HTML sense trencar el layout.
- [ ] **V4.4 - Validació de scripts de client:** Comprovar la sintaxi dels fitxers `public/js/main.js` i `public/js/quiz.js` mitjançant eina de lint o `node -c`.
- [ ] **V4.5 - Accessibilitat i disseny responsive:** Comprovar que els formularis i les taules inclouen etiquetes (`labels`, atributs `name`) i que el CSS compta amb media queries per a dispositius mòbils.

---

### Fase 5: Banc de Proves Integrat i Validació E2E en Local
1. **Dades de prova (Seed automatitzat):**
   - Crear script `scripts/seed.js` per carregar:
     - 2 cursos diferents (ex. *Tècnic de Gestió* i *Administratiu Educatiu*).
     - 4 lliçons (amb contingut Markdown de prova).
     - 6 preguntes test, algunes associades a múltiples lliçons (relació N:M).
2. **Execució del servidor en local:**
   - Arrencar l'aplicació en mode local via `npm run dev` o `node api/index.js`.
3. **Execució de la bateria de proves de flux d'usuari:**
   - Validar el cicle complet de navegació, creació, edició, vinculació/desvinculació i realització de tests.

#### Verificacions obligatòries per part de l'agent (Fase 5):
- [ ] **V5.1 - Arrencada local i HTTP 200 a l'arrel:** Fer petició HTTP a `GET http://localhost:3000/` i verificar que retorna status `200 OK` i renderitza el llistat de cursos.
- [ ] **V5.2 - Prova de Lliçó (Markdown + Notes):**
  - Fer petició `GET /lesson/:id` i verificar que el Markdown es renderitza en HTML.
  - Fer petició `POST /lesson/:id/notes` amb una nota personal i verificar que es desa correctament a la base de dades.
  - Fer petició `POST /lesson/:id/toggle` i comprovar que commuta l'estat `completed`.
- [ ] **V5.3 - Prova de Gestió N:M (Quick Attach / Detach):**
  - Vincular una pregunta a una lliçó via `POST /lesson/:id/questions/attach` i comprovar que apareix a `lesson_questions`.
  - Desvincular-la via `POST /lesson/:id/questions/:questionId/detach` i comprovar que desapareix de la lliçó però la pregunta continua existint a `questions`.
- [ ] **V5.4 - Prova de Simulacre de Quiz i Qualificació:**
  - Fer petició `GET /course/:id/quiz` i verificar que retorna preguntes úniques sense duplicats.
  - Fer petició `POST /quiz/submit` enviant un formulari de respostes i verificar que redirigeix a `/quiz/attempts/:id`.
  - Fer petició `GET /quiz/attempts/:id` i verificar que la pàgina mostra la nota calculada, el desglossament d'encerts/errors i l'explicació.
- [ ] **V5.5 - Prova de recursos estàtics servits:** Verificar que `GET /css/style.css` i `GET /js/main.js` responen amb `200 OK` i el tipus MIME adequat (`text/css`, `application/javascript`).

---

### Fase 6: Preparació Git, Repositori GitHub i Desplegament a Vercel
1. **Control de versions local:**
   - Inicialitzar Git (`git init`), afegir fitxers (`git add .`) i realitzar el commit inicial (`git commit -m "feat: implementació inicial OposTest LMS"`).
   - Validar que mai s'ha fet `git add` del fitxer `.env`.
2. **Vinculació amb GitHub:**
   - Crear repositori remot i configurar la branca principal `main`.
3. **Desplegament i Configuració a Vercel:**
   - Importar repositori a Vercel.
   - Configurar variables d'entorn `SUPABASE_URL` i `SUPABASE_ANON_KEY` a l'apartat **Settings > Environment Variables** del tauler de Vercel.
   - Llançar el desplegament de producció.

#### Verificacions obligatòries per part de l'agent (Fase 6):
- [x] **V6.1 - Comprovació d'estat Git:** Executar `git status` per verificar que l'arbre de treball està net i que cap fitxer sensible està tracked.
- [x] **V6.2 - Validació de camins serverless:** Verificar que totes les crides a `res.render` i lectures de fitxers utilitzen rutes resoltes (`path.join(__dirname, ...)` o `process.cwd()`) per garantir compatibilitat amb l'entorn d'execució Serverless de Vercel.
- [x] **V6.3 - Smoke test del desplegament en producció:** Executar peticions `curl -I https://opostest.vercel.app` i verificar que:
  - La pàgina principal respon amb `200 OK`.
  - Els fitxers estàtics (`/css/style.css` i `/js/main.js`) es lliuren amb `200 OK` i els tipus MIME correctes.
  - `/healthz` respon amb `200 OK`; Supabase està configurat i les rutes serverless `/var/task/views` i `/var/task/public` existeixen.

**Desplegament completat:** 18 de novembre de 2026 mitjançant Vercel CLI al projecte `opostest`, accessible a <https://opostest.vercel.app>.