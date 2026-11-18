# PLAN-UNANSWERED.md — Preguntes sense respondre

## Objectiu MVP

Fer que una resposta no enviada sigui un resultat real i coherent dins el simulacre, en comptes d'ometre-la del càlcul i del desglossament.

## Decisions de solució mínima

- El nombre total és el nombre de preguntes presentades, no només les que tenen resposta.
- Les respostes sense valor es representen com `selected_option = NULL` i `is_correct = false`.
- El servidor determina les preguntes pertanyents al simulacre i no confia exclusivament en les claus rebudes.
- Les preguntes sense respondre es compten com a incorrectes en el percentatge MVP.

## Fases internes

### Fase 1 — Identificació canònica del simulacre

1. Afegir al formulari `quiz.ejs` una llista o camp ocult amb tots els identificadors presentats.
2. Actualitzar `GET /lesson/:id/quiz` i `GET /course/:id/quiz` per conservar el conjunt real de preguntes.
3. Definir una funció única al servidor que obté les preguntes per `lesson_id` o `course_id` i elimina duplicats globals.
4. Rebutjar un enviament que faci referència a identificadors fora del simulacre actiu.

### Fase 2 — Càlcul correcte

1. Modificar `calculateScore(submittedAnswers, questionsMap, presentedQuestionIds)` perquè recorrera tots els IDs presentats.
2. Crear `selectedOption = submittedAnswers[qId] || null`.
3. Classificar com a correcta quan existeix resposta i coincideix amb `correct_option`.
4. Classificar com a incorrecta tota resposta diferent i tota resposta absent.
5. Calcular `total`, `correct`, `incorrect` i `score` sobre el mateix conjunt presentat.

### Fase 3 — Persistència completa

1. Crear una fila a `quiz_attempt_answers` per a cada pregunta presentada.
2. Guardar `selected_option = NULL` i `is_correct = false` per a les pendents.
3. Mantenir `total_questions`, `correct_answers`, `incorrect_answers` i `score` coherents amb les files detallades.
4. Crear el registre d'intent encara quan l'usuari no hagi contestat cap pregunta.
5. Evitar l'actual comportament que redirigeix directament sense guardar quan no arriba cap resposta.

### Fase 4 — Interfície i feedback

1. Enviar el formulari sense preguntar confirmació només quan totes les preguntes estiguin contestades.
2. En el cas d'intervencions pendents, indicar-ne clarament el nombre i que comptaran com a incorrectes.
3. Distingir visualment a la pàgina de resultats: correcta, errònia i sense resposta.
4. Mostrar el text «Sense resposta» quan `selected_option` sigui nul.
5. Ajustar els textos de resultats perquè no diguin «Errors» quan hi ha una categoria separada d'impreses sense resposta.

### Fase 5 — Verificació i compatibilitat

1. Actualitzar les proves E2E actuals perquè cobreixin enviaments parcials.
2. Afegir un script de verificació per a 0, 1 i totes les respostes.
3. Comprovar que no es pot augmentar el total enviant IDs manipulats.

## Fitxers previsiblement afectats

- `app.js`
- `public/js/quiz.js`
- `views/pages/quiz.ejs`
- `views/pages/quiz_result.ejs`
- `scripts/verify-phase5-e2e.js`
- Possiblement un nou script `scripts/verify-unanswered.js`

## Verificacions internes d'assoliment

- Un test amb 10 preguntes i 7 respostes correctes sense les altres 3 té `total = 10`, `correct = 7`, `incorrect = 3`.
- Cada una de les 3 preguntes pendents genera una fila amb `selected_option = NULL` i `is_correct = false`.
- Un test enviat sense respostes crea un intent vàlid amb el total real i 0 encerts.
- L'execució de totes les respostes correctes manté el resultat i el percentatge actual.
- Una resposta Z o invàlida es registra com a incorrecta sense trencar el servei.
- El formulari només pot enviar preguntes pertanyents al curs o lliçó activa.
- La pàgina de revisió diferencia resposta correcta, incorrecta i sense resposta.
- Les proves unitàries de `calculateScore` inclouen casos total=0, parcial i complet.
- No apareixen respostes detallades que no corresponen al conjunt real del test.

## Criteri de finalització

La solució és completa quan el nombre total, els encerts, els errors i les files detallades descriuen exactament les mateixes preguntes del simulacre.