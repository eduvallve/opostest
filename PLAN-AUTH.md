# PLAN-AUTH.md — Autenticació i separació d'usuaris

## Objectiu MVP

Afegir autenticació real perquè cada usuari tingui accés privat al seu progrés i perquè les operacions d'administració només siguin accessibles per usuaris administradors.

## Decisions de solució mínima

- Supabase Auth gestiona compte i contrasenya.
- Express manté una sessió HTTP-only mitjançant `express-session`.
- `SUPABASE_SERVICE_ROLE_KEY` continua sent exclusivament de servidor i mai s'envia al navegador.
- Es crea un perfil amb camp `role` (`student` o `admin`) i relació amb `auth.users`.
- Les dades personals de `notes`, `quiz_attempts` i `quiz_attempt_answers` queden associades a l'usuari.

## Fases internes

### Fase 1 — Migració i model d'usuari

1. Afegir una taula `profiles` amb `id UUID PRIMARY KEY REFERENCES auth.users(id)`, `display_name`, `role`, `created_at` i `updated_at`.
2. Afegir `user_id UUID REFERENCES auth.users(id)` a `notes`, `quiz_attempts` i `quiz_attempt_answers` si cal la propietat directa d'aquesta última.
3. Afegir índexs per `user_id` i per les consultes d'intents.
4. Crear un trigger perquè cada nou usuari registrat generi el seu perfil amb rol `student`.
5. Definir els primers administradors manualment mitjançant Supabase SQL o un script validat.

### Fase 2 — Dependències i sessió

1. Instal·lar `express-session` i el seu adaptador compatible amb Supabase o una implementació equivalent mínima.
2. Afegir variables d'entorn per al secret de sessió i la configuració segura de cookies.
3. Configurar cookies `httpOnly`, `sameSite=lax` i `secure` quan sigui HTTPS.
4. Afegir helpers de sessió: usuari actual, rol i comprovació d'autenticació.

### Fase 3 — Fluxos d'autenticació

1. Crear les pàgines i rutes `GET/POST /login` i `GET/POST /register`.
2. Utilitzar Supabase Auth per validar el compte i obtenir l'usuari.
3. Emmagatzemar només l'identificador i el perfil necessari a la sessió, no els tokens sensibles.
4. Afegir `POST /logout` i redirecció segura.
5. Afegir un middleware `requireAuth` i aplicar-lo a perfils, notes i historial.
6. Afegir un middleware `requireAdmin` i aplicar-lo a totes les operacions de creació, edició i eliminació de curs, lliçó i pregunta.

### Fase 4 — Protecció i propietat de dades

1. Vincular cada nota al sessió actual en crear-se o actualitzar-se.
2. Vincular cada intent de test i cada resposta a l'usuari autenticat.
3. Filtrar cursos, notes i intents segons l'usuari quan les dades siguin personals.
4. Mantenir públic només el contingut teòric i el banc necessari per estudiar.
5. Afegir protecció CSRF als formularis POST, especialment als de mutació.

### Fase 5 — Interfície mínima

1. Mostrar l'usuari i un botó de sortida a la capçalera quan hi hagi sessió.
2. Mostrar botons d'inici i registre quan no hi hagi sessió.
3. Ocultar les accions d'administració als usuaris sense rol admin.
4. Redirigir intent no autoritzat a login o a una pàgina 403 sense revelar dades.

## Fitxers previsiblement afectats

- `schema.sql`
- `app.js`
- `db.js`
- `package.json`
- `views/organisms/header.ejs`
- Noves pàgines `views/pages/login.ejs` i `views/pages/register.ejs`
- Nous scripts o proves d'autenticació i migració

## Verificacions internes d'assoliment

- Un usuari pot registrar-se i iniciar sessió amb credencials vàlides.
- Un intent d'inici de sessió amb credencials incorrectes no crea sessió.
- Les notes i intents creades pertanyen a l'usuari autenticat.
- Un usuari `student` no pot accedir a rutes de creació, edició o eliminació.
- Un usuari `admin` pot realitzar les operacions administratives.
- Tancar sessió elimina l'accés a les pàgines personals.
- Els camps personals no es filtren a través d'identificadors d'altres usuaris.
- La cookie de sessió és HTTP-only i s'envia amb les opcions securitzades configurades.
- `GET /healthz` continua funcionant sense mostrar claus ni secrets.
- Provar amb dues comptes diferents: les dades de cadascuna són aïllades.

## Criteri de finalització

L'acció es considera resolta quan tots els fluxos d'estudi i administració tenen una decisió d'autorització explícita i un usuari no pot modificar dades que no li pertanyen.