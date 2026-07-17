# Supabase und GitHub Pages einrichten

Diese Anleitung enthält die manuellen Schritte für eine lokale Testumgebung und
ein gehostetes Foundation-Deployment. Keine der genannten Secret-Werte gehört
ins Repository. Es wird keine Produktionsdatenbank automatisch erstellt.

## 1. Lokale Voraussetzungen

1. Docker Desktop installieren und starten.
2. Abhängigkeiten installieren und die lokale Supabase-Umgebung aufbauen:

   ```bash
   npm ci
   npx supabase start
   npx supabase db reset
   npx supabase test db
   npx deno@2.9.3 test supabase/functions
   ```

3. Für lokale Edge Functions eine nicht eingecheckte
   `supabase/functions/.env` aus den passenden Platzhaltern in `.env.example`
   anlegen. Sie muss lokal bleiben. Für den lokalen Auth-E2E-Lauf muss die
   Einladung zur lokalen Vite-App zurückführen:

   ```dotenv
   BOOTSTRAP_ADMIN_EMAIL=admin@example.test
   APP_ORIGIN=http://127.0.0.1:5173/
   ALLOWED_ORIGINS=http://127.0.0.1:5173,http://localhost:5173
   CLEANUP_CRON_SECRET=<lokaler-nur-serverseitiger-wert>
   ```

   Supabase stellt `SUPABASE_URL`, `SUPABASE_ANON_KEY` und
   `SUPABASE_SERVICE_ROLE_KEY` dem lokalen Function Runtime bereit; diese Werte
   nicht in die Datei kopieren. Die Produktions-`APP_ORIGIN` bleibt die
   GitHub-Pages-Adresse.
4. Lokalen Stack prüfen:

   ```bash
   npx supabase status -o env
   ```

Mailpit ist mit dieser Repository-Konfiguration unter
`http://127.0.0.1:54324` erreichbar. Die lokale API verwendet
`http://127.0.0.1:54321`.

Die lokale Auth-Konfiguration hält die öffentliche Registrierung mit
`[auth] enable_signup = false` geschlossen und lässt gleichzeitig den
E-Mail-Provider für eingeladene Konten aktiv (`[auth.email] enable_signup = true`).
Unreservierte Konten werden zusätzlich vom Datenbank-Trigger mit
`INVITATION_REQUIRED` abgewiesen.

## 2. Gehostetes Supabase-Projekt

1. Im Supabase-Dashboard ein neues Projekt erstellen. Keine echten Werte in
   Dateien dieses Repositories kopieren.
2. Unter **Authentication → Providers → Email** Public signup beziehungsweise
   „Allow new users to sign up“ deaktivieren. E-Mail-Bestätigung aktiv lassen
   und eine Mindestlänge von zwölf Zeichen für Passwörter verwenden. Die
   Gültigkeit der E-Mail-OTP beziehungsweise Einladungslinks auf `604800`
   Sekunden (sieben Tage) setzen. Dieser Wert muss zur siebentägigen
   Datenbankreservierung passen.
3. Als Site URL die veröffentlichte Pages-Adresse konfigurieren:
   `https://tyronehp.github.io/tyrone-control-center/`.
4. Folgende Redirect URLs erlauben:

   - `http://127.0.0.1:5173/update-password`
   - `http://localhost:5173/update-password`
   - `https://tyronehp.github.io/tyrone-control-center/update-password`

5. Vor der Produktion einen Produktions-SMTP-Anbieter konfigurieren. Die lokale
   Mailpit-Zustellung ist nur für Entwicklung und Tests bestimmt.

## 3. CLI verbinden und Datenbank migrieren

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

Danach die pgTAP-Prüfungen weiterhin lokal mit `npx supabase test db`
ausführen. Die generierten Datenbanktypen können bei einer Schemaänderung erst
nach erfolgreichem lokalen Reset neu erzeugt werden.

## 4. Edge-Function-Secrets

Folgende Werte im Supabase-Dashboard oder über `supabase secrets set` setzen,
ohne ihre Werte in Shell-Historien, Logs oder Dateien des Repositories zu
übernehmen:

- `BOOTSTRAP_ADMIN_EMAIL` – einzige Adresse für das erste Administratorkonto
- `APP_ORIGIN` – `https://tyronehp.github.io/tyrone-control-center/`
- `ALLOWED_ORIGINS` – Pages-Origin plus ausdrücklich benötigte lokale Origins
- `CLEANUP_CRON_SECRET` – zufälliger, ausschließlich serverseitiger Wert

Die von Supabase bereitgestellten Server-Schlüssel bleiben ausschließlich in
Edge Functions. Ein Supabase-Service-Schlüssel darf niemals als `VITE_`-Wert
oder Frontend-Konfiguration verwendet werden.

## 5. Edge Functions deployen

```bash
npx supabase functions deploy bootstrap-admin
npx supabase functions deploy invite-user
npx supabase functions deploy manage-user
npx supabase functions deploy cleanup-deactivated-users
```

`cleanup-deactivated-users` erwartet einen POST-Aufruf mit dem Header
`x-cron-secret`. Im Supabase-Dashboard unter **Integrations → Cron** einen
täglichen HTTP-Aufruf dieser Function einrichten und den Wert sicher aus Vault
beziehungsweise der geschützten Cron-Konfiguration beziehen. Die Function ist
idempotent, gibt nur Zähler zurück und versendet keine E-Mails.

## 6. GitHub Pages konfigurieren

Im GitHub-Repository unter **Settings → Secrets and variables → Actions** diese
beiden Build-Secrets ohne Anführungszeichen anlegen:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Das ist ausschließlich öffentliche Browser-Konfiguration. Keine
Service-Schlüssel oder SMTP-Zugangsdaten als Vite-Werte anlegen.

Unter **Settings → Pages → Build and deployment** GitHub Actions als Quelle
auswählen. Der Workflow bricht mit einer klaren Meldung ab, wenn einer der
beiden Buildwerte fehlt.

## 7. Erstes Administratorkonto

1. Nach Deployment und Function-Konfiguration
   `https://tyronehp.github.io/tyrone-control-center/setup` öffnen.
2. Exakt die in `BOOTSTRAP_ADMIN_EMAIL` konfigurierte Adresse eingeben.
3. Einladung aus dem Postfach annehmen und ein Passwort mit mindestens zwölf
   Zeichen setzen.
   Eine abgelaufene Bootstrap-Einladung kann ausschließlich mit derselben
   konfigurierten Adresse erneut über `/setup` angefordert werden. Die Function
   entfernt dabei nur das noch nicht aktivierte, abgelaufene Bootstrap-Konto
   und stellt anschließend eine neue Einladung aus. Ein aktives
   Administratorkonto schließt die Ersteinrichtung dauerhaft.
4. Danach weitere Nutzer ausschließlich in **Einstellungen → Kontoverwaltung**
   einladen. Das Administratorkonto und bis zu neun weitere Nutzer belegen
   maximal zehn aktive oder reservierte Kontoplätze. Der zehnte belegte oder
   reservierte Platz sperrt weitere Einladungen serverseitig und im Frontend.

## 8. Vollständiger lokaler Auth-E2E-Lauf

Vor diesem Lauf muss die Datenbank frisch zurückgesetzt sein und die lokale
Function-Umgebung dieselbe Administratoradresse verwenden. Den von
`npx supabase status -o env` ausgegebenen lokalen öffentlichen Schlüssel nur in
der aktuellen Shell setzen, nicht committen.

In einer separaten Shell die Functions mit der lokalen Redirect-Konfiguration
starten und während des Tests laufen lassen:

```bash
npx supabase db reset
npx supabase functions serve --env-file supabase/functions/.env
```

PowerShell-Beispiel mit Platzhaltern:

```powershell
$env:VITE_SUPABASE_URL='http://127.0.0.1:54321'
$env:VITE_SUPABASE_PUBLISHABLE_KEY='<lokaler-oeffentlicher-schluessel>'
$env:E2E_LOCAL_SUPABASE='true'
$env:E2E_ADMIN_EMAIL='admin@example.test'
$env:MAILPIT_URL='http://127.0.0.1:54324'
npm run test:e2e -- --project=desktop-chromium tests/e2e/auth.spec.ts
```

Der Test fordert das konfigurierte Administratorkonto an, liest die lokale
Mailpit-Einladung, setzt das Passwort, lädt acht Mitglieder ein und sendet zwei
weitere Einladungen parallel. Genau eine davon belegt den zehnten Platz; die
andere wird mit `ACCOUNT_CAPACITY_REACHED` abgelehnt. Zusätzlich verweigert der
Test einem Mitglied die Admin-Funktion und deaktiviert beziehungsweise
reaktiviert dieses Mitglied.

## 9. Erforderliche Secrets – Namen, niemals Werte

Supabase Function Secrets:

- `BOOTSTRAP_ADMIN_EMAIL`
- `APP_ORIGIN`
- `ALLOWED_ORIGINS`
- `CLEANUP_CRON_SECRET`

GitHub Actions Secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Produktions-SMTP-Zugangsdaten werden ausschließlich im Supabase-Dashboard nach
Vorgabe des gewählten SMTP-Anbieters hinterlegt.
