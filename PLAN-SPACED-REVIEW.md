# PLAN-SPACED-REVIEW.md — Repàs espaiat i repetició dels errors

## Objectiu MVP

Crear sessions de repàs basades en les preguntes fallades i programar la propera revisió amb intervals fixes senzills.

## Decisions de solució mínima

- Cada parella usuari-pregunta té un registre d'aprenentatge.
- MVP usa 5 intervals fixes: 1, 3, 7, 14 i 30 dies.
- La primera fallada entra a la etapa 0 i queda pendent immediatament o un dia després.
- Una resposta correcta avança un nivell i una errònia reinicia el nivell.
- Sense autenticació, l'adaptació queda preparada per associar les dades a `user_id` en integrar el pla AUTH.

## Fases internes

### Fase 1 — Model de repàs

1. Afegir `question_progress` amb `user_id`, `question_id`, `stage`, `correct_count`, `incorrect_count`, `last_answered_at`, `next_review_at` i `updated_at`.
2. Crear una clau única per `(user_id, question_id)` i índex per `next_review_at`.
3. Crear també índex per `question_id` i, si és necessari, per `difficulty`.
4. Definir intervals constants centralitzats dins una utilitat server.

### Fase 2 — Actualització després d'un intent

1. Repassar totes les files de `quiz_attempt_answers` quan s'acaba el simulacre.
2. Crear o actualitzar el registre de repàs de cada pregunta contestada.
3. Augmentar el comptador d'encerts o errors.
4. Reiniciar a l'etapa 0 i programar 1 dia si la resposta és incorrecta o sense resposta.
5. Avançar de l'etapa actual i calcular `next_review_at` si és correcta.
6. Executar l'actualització amb l'intent en un flux servidor tolerant a errors parcials.

### Fase 3 — Selecció de repàs

1. Crear `GET /review` i seleccionar preguntes amb `next_review_at <= now()`.
2. Afegir una prioritat: abans les fallades, després les més antigues i finalment les de dificultat més alta.
3. Limitar el repàs MVP a 10 o 20 preguntes.
4. Si no hi ha preguntes pendents, mostrar una pantalla «No tens repàs pendent» i suggerir un simulacre normal.
5. Reutilitzar el formulari `quiz.ejs` en una vista de mode `review`.

### Fase 4 — Repàs dels errors

1. Afegir un botó «Repetir només els errors» a la pàgina de resultats.
2. Crear `GET /quiz/attempts/:id/errors` o `POST /review/errors` que obtingui les respostes incorrectes i sense resposta.
3. Deduplicar les preguntes si apareixen diverses vegades.
4. Renderitzar el test com a modalitat temporal sense mesclar-lo amb el simulacre global.
5. Opcionalment ometre l'explicació abans de respondre i tornar-la a mostrar després del resultat.

### Fase 5 — Interfície i proves

1. Mostrar a la capçalera o pàgina d'inici el nombre de preguntes pendents.
2. Mostrar a cada curs quantes preguntes de repàs hi pertanyen.
3. Afegir un script E2E que crea fallades i acerts i comprova els intervals.
4. Afegir un script que comprova que les preguntes de data futura no apareixen al repàs.

## Fitxers previsiblement afectats

- `schema.sql`
- `app.js`
- `public/js/quiz.js`
- `views/pages/quiz_result.ejs`
- `views/pages/quiz.ejs`
- `views/pages/index.ejs` o una nova `views/pages/review.ejs`
- Nous scripts `scripts/verify-review.js` i unitats de càlcul d'interval

## Verificacions internes d'assoliment

- Una pregunta fallada queda amb etapa 0 i `next_review_at` dins de la finestra d'un dia.
- Una resposta correcta des d'etapa 0 avança a etapa 1 i més endavant a etapa 2.
- Una errada després d'encertades diverses vegades reinicia l'etapa a 0.
- Una resposta sense contestar té el mateix comportament que una errada.
- `/review` retorna només preguntes amb revisió vencuda de l'usuari actual.
- Una pregunta futura no apareix encara que pertanyi al mateix curs.
- `Repetir només els errors` inclou totes les respostes incorrectes i no duplicades.
- Completar el repàs no introdueix una entrada falsa a la pàgina d'historial si es considera provisional.
- Hi ha un límit superior de preguntes per prevenir sessions excessivament llargues.
- Els càlculs d'interval són deterministes i passen les proves de frontera de data.

## Criteri de finalització

El MVP és vàlid quan una pregunta fallada torna al repàs, una resposta correcta la separa més en el temps i una resposta errònia la torna a prioritzar.