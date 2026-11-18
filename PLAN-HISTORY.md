# PLAN-HISTORY.md — Historial i evolució

## Objectiu MVP

Donar a cada usuari una pàgina d'historial amb els seus simulacres i gràfiques bàsiques de l'evolució, reutilitzant les taules ja existents d'intents i respostes.

## Decisions de solució mínima

- `quiz_attempts` és la font principal de dades.
- Cada intent ha de tenir `user_id` perquè l'historial no pugui exposar dades de tercers.
- La primera versió ofereix llistat, filtre per curs i resum global; les gràfiques resten al navegador amb dades ja processades pel servidor.
- Sense autenticació implementada no es filtra per usuari i es considera només una estructura preparada per integrar-la amb el pla AUTH.

## Fases internes

### Fase 1 — Model i migració

1. Afegir `user_id UUID` a `quiz_attempts` i índex compost per usuari i data.
2. Afegir també `user_id` a `quiz_attempt_answers` si les proves demanen un aïllament complet o es farà analítica directament.
3. Crear una clau de retrocompatibilitat temporal per als intents històrics sense usuari.
4. Definir una política explícita: els intents antics sense propietari no apareixen a perfils nous.

### Fase 2 — Consultes i API HTML

1. Crear `GET /history` amb pàgina d'historial.
2. Filtrar els intents pels camps `course_id`, `lesson_id` i `user_id`.
3. Acceptar els filtres opcionals `course_id`, `lesson_id`, `mode` i `limit`.
4. Ordenar sempre per `created_at DESC` i aplicar paginació simple.
5. Crear una resposta amb resum: intents totals, millor puntuació, puntuació mitjana i últim intent.

### Fase 3 — Detall i navegació

1. Convertir cada fila de l'historial en un enllaç a `/quiz/attempts/:id`.
2. Mostrar tipus de simulacre, curs, lliçó, puntuació, encerts i data.
3. Mostrar només l'intent si pertany a l'usuari autenticat.
4. Afegir una pàgina buida clara quan no hi hagi intents.
5. Afegir una acció «Repetir» segons `lesson_id` o `course_id`.

### Fase 4 — Gràfica i resum mínim

1. Agregar per dia o setmana les puntuacions finals dels darrers 30 intents.
2. Crear una gràfica lleugera amb SVG/CSS, o una integració d'una sola llibreria sense construir un dashboard complex.
3. Mostrar la progressió mitjana i la variació respecte als cinc primers intents.
4. Mostrar l'última nota i el millor resultat per curs a la vista principal.

### Fase 5 — Rendiment i prova

1. Afegir índex `(user_id, created_at)` i `(course_id, created_at)`.
2. Limitar els intents carregats per pàgina a un màxim raonable.
3. Evitar càrregar les respostes detallades a la llista.
4. Afegir proves amb tres usuaris i intents amb dades idèntiques.

## Fitxers previsiblement afectats

- `schema.sql`
- `app.js`
- `public/js/main.js`
- `views/pages/` amb una nova `history.ejs`
- `views/organisms/header.ejs`
- Un nou script `scripts/verify-history.js`

## Verificacions internes d'assoliment

- Un usuari veu només els seus intents.
- Un usuari no pot obrir `/quiz/attempts/:id` d'una altra persona i rep 403 o 404.
- La llista està ordenada del més recent al més antic.
- El filtre per curs exclou intents d'altres cursos.
- El resum mostra el mateix nombre d'intents que la llista filtrada.
- La mitjana i la millor puntuació coincideixen amb les dades originals.
- La pàgina buida no mostra dades falses ni errors.
- La paginació no duplica ni omet intents.
- Els intents de dues persones no poden crear una sèrie gràfica compartida.
- La gràfica representa el percentatge real d'almenys cinc intents de prova.

## Criteri de finalització

L'acció es considera completa quan un usuari pot consultar el detall i la progressió dels seus simulacres i cap accés pot revelar l'historial d'un altre usuari.