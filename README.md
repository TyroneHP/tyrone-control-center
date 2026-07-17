# Tyrone Control Center

Das Repository enthält den Foundation-Meilenstein des Tyrone Control Center: eine
deutsche, responsive Slate-PWA mit E-Mail-/Passwort-Anmeldung, ausschließlich
administrativen Einladungen, maximal vier reservierten oder aktiven Konten und
einer Supabase-Sicherheitsbasis mit Row Level Security.

Kalender, Aufgaben, KI-Anbieter, Dateien und Push-Versand sind in diesem
Meilenstein nur als deaktivierte Platzhalter vorhanden.

## Voraussetzungen

- Node.js 22.12.0 oder neuer
- npm
- Docker Desktop für die lokale Supabase-Umgebung
- Supabase CLI über die lokale npm-Abhängigkeit
- Deno 2.9.3 für die Edge-Function-Tests (alternativ über den unten gepinnten
  `npx`-Aufruf)
- Chromium und WebKit für die Playwright-Prüfungen

## Lokaler Start

1. Abhängigkeiten reproduzierbar installieren:

   ```bash
   npm ci
   ```

2. `.env.example` als Vorlage für lokale, nicht eingecheckte Umgebungswerte
   verwenden. Niemals echte Schlüssel committen.
3. Supabase nach [docs/setup-supabase.md](docs/setup-supabase.md) einrichten.
4. Entwicklungsserver starten:

   ```bash
   npm run dev
   ```

Die App ist anschließend unter `http://127.0.0.1:5173/` erreichbar. Keine öffentliche Registrierung.
Das erste Administratorkonto wird nur über
`BOOTSTRAP_ADMIN_EMAIL` angefordert; weitere Konten entstehen nur durch eine
Admin-Einladung. Insgesamt sind maximal vier Konten aktiv oder reserviert.

## Prüfungen

```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
npm run check
```

Mit laufendem Docker Desktop und lokaler Supabase-Umgebung zusätzlich:

```bash
npx supabase db reset
npx supabase test db
npx deno@2.9.3 test supabase/functions
npm run test:e2e
```

Falls die Playwright-Browser noch fehlen:

```bash
npx playwright install chromium webkit
```

Der reine Navigationslauf benötigt keine aktive Datenbank. Der vollständige
Einladungs- und Konten-Lebenszyklus wird bewusst nur mit
`E2E_LOCAL_SUPABASE=true` aktiviert; die notwendigen lokalen Werte stehen in
der Supabase-Anleitung.

## Wichtige npm-Skripte

- `npm run dev` – Vite-Entwicklungsserver
- `npm run check` – Lint, Typprüfung, Unit-Tests und Produktions-Build
- `npm run security:scan` – Secret-Wert-Prüfung für Git-Dateien und `dist/`
- `npm run test:e2e` – Playwright auf Desktop Chromium und iPhone WebKit
- `npm run supabase:reset` – lokale Datenbank neu aufbauen
- `npm run supabase:test` – pgTAP-Datenbanktests ausführen

## Deployment

GitHub Actions prüft Pushes und Pull Requests. Pushes auf `main` bauen die App
mit dem Produktions-Basispfad `/tyrone-control-center/` und veröffentlichen
`dist/` über GitHub Pages. Die hierfür erforderlichen öffentlichen
Supabase-Buildwerte werden ausschließlich als GitHub-Secrets gesetzt.
