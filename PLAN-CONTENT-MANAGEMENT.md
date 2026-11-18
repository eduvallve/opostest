# PLAN-CONTENT-MANAGEMENT.md — Gestió completa de contingut

## Objectiu MVP

Afegir operacions d'edició i eliminació completes per a cursos i lliçons, amb reordenació i protecció contra eliminacions accidentals.

## Decisions de solució mínima

- Els cursos i les lliçons tenen pàgines de formulari reutilitzables.
- Les eliminacions es fan mitjançant POST i confirmació en navegador.
- Una eliminació de curs es confirma encara més perquè elimina en cascada les lliçons i associaccions segons l'esquema actual.
- Les accions requereixen el rol admin quan el pla AUTH estigui integrat.

## Fases internes

### Fase 1 — Edició de curs

1. Afegir `GET /courses/:id/edit` i carregar el curs actual.
2. Afegir `POST /courses/:id/update` amb validació de títol obligatori.
3. Permetre editar nom i descripció.
4. Afegir el botó «Editar curs» a la pàgina de curs i, opcionalment, a la targeta principal.
5. Redirigir a `/course/:id` després de desar i mostrar errors en línia o resposta 400 clara.

### Fase 2 — Eliminació de curs

1. Afegir `POST /courses/:id/delete` i comprovar que existeix.
2. Mostrar confirmació al navegador amb el nom del curs i advertència de cascada.
3. Executar l'eliminació només quan la confirmació del formulari és visible i s'ha rebut la petició.
4. A més de lliçons, comprovar els registres que quedaran afectats: notes, intents i associacions.
5. Redirigir a `/` i evitar intents de cadascuna amb referència orfe gràcies a les claus actuals.

### Fase 3 — Edició i eliminació de lliçó

1. Afegir `GET /lesson/:id/edit` i carregar la lliçó.
2. Afegir `POST /lesson/:id/update` per als camps `title`, `content`, `video_url` i `order_index`.
3. Validar URL de vídeo, títol i índex numèric.
4. Afegir `POST /lesson/:id/delete` amb confirmació i eliminació en cascada controlada.
5. Mostrar botons d'edició i eliminació només a administradors quan hi hagi autenticació.

### Fase 4 — Reordenació

1. Permetre canviar `order_index` des del formulari d'edició.
2. Afegir una validació de rang i evitar valors negatius o decimals.
3. Afegir un botó bàsic «Pujar» i «Baixar» amb dos POST si es busca una operació ràpida.
4. En editar una lliçó, normalitzar opcionalment l'ordre complet del curs.
5. Ordenar sempre per `order_index` i després per `id` per obtenir resultats deterministes.

### Fase 5 — Integritat i UX

1. Afegir pàgines o paràmetres de confirmació per als contenidors amb dades associades.
2. Afegir confirmació addicional quan un curs conté intents o preguntes associades.
3. Gestionar respostes 404 sense revelar si l'element existeix o no a un usuari sense permisos.
4. Afegir missatges breus després d'editar o eliminar i conservar els enllaços de retorn.
5. Afegir tests E2E per a crear, editar, reordenar i eliminar cursos i lliçons.

## Fitxers previsiblement afectats

- `app.js`
- `views/pages/course.ejs`
- `views/pages/lesson.ejs`
- Noves vistes `views/pages/course_form.ejs` i `views/pages/lesson_form.ejs`
- `public/js/main.js`
- `schema.sql` si es modifica alguna restricció
- `scripts/verify-content-management.js`

## Verificacions internes d'assoliment

- Crear un curs i actualitzar-ne el títol i la descripció conserva el mateix ID.
- En editar una lliçó es desenen tots els camps canviats i s'actualitza `order_index`.
- La llista ordenada respecta l'ordre nou i després el `id`.
- Eliminar una lliçó elimina les seves notes i associacions sense esborrar preguntes del banc central.
- Eliminar un curs elimina les seves lliçons i relacions en cascada sense deixar carrers sense resposta.
- Els intents assignats al curs o lliçó es comporten segons les claus `ON DELETE SET NULL` o la política definida.
- Una petició POST sense títol retorna 400 i no modifica la base de dades.
- Els usuaris sense rol admin no poden obrir ni executar les rutes d'edició i eliminació.
- Un ID desconegut retorna 404 i no genera modificacions parcials.
- Les proves E2E recreuen i netegen les dades de prova sense deixar residus al banc real.

## Criteri de finalització

La gestió és completa quan cada curs i lliçó poden crear-se, llegir-se, editar-se, reordenar-se i eliminar-se amb integritat i autorització, sense esborrar accidentalment preguntes independentment utilitzades.