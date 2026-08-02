# Training: sichtbare UI-Foundation

Der sichtbare CoreGrid-Trainingsbereich ist derzeit eine lokale, nicht
persistente UI-Foundation. Er zeigt ausschließlich Dashboard, Pläne,
Übungsbibliothek und den Ablauf eines aktiven Trainings. Abgeschlossene
Trainings, Verlauf, Fortschrittsanalysen, Rekorde, Muskelgruppen-Auswertungen
und Körpergewichtsmessungen sind in diesem Stand nicht sichtbar.

## Sichtbarer Umfang

- `/training` zeigt das Dashboard mit den Tabs Dashboard, Pläne und Bibliothek.
- Plan-Details und der Plan-Assistent verwenden lokale Mock-Pläne.
- Die Bibliothek enthält 50 Mock-Übungen. Suche, Muskelgruppe, Equipment und
  Favoriten lassen sich unabhängig kombinieren; Filteränderungen löschen keine
  Favoriten.
- Freie Einheiten und Einheiten aus einem Plan verwenden denselben fokussierten
  Ablauf für aktive Trainings.
- Frühere Deep Links für Verlauf, Fortschritt, Rekorde, Auswertungen und alte
  Vorlagen leiten auf `/training` um, statt die frühere Oberfläche zu rendern.

## Zustand und vorhandene lokale Daten

Alle Änderungen in dieser Foundation leben nur im React-Speicher. Neu erstellte
oder bearbeitete Mock-Pläne, Favoriten und aktive Trainings werden nach einem
Neuladen auf den Ausgangszustand zurückgesetzt.

Die bestehende IndexedDB-Implementierung und bereits gespeicherte lokale
Trainingsdaten bleiben im Repository beziehungsweise Browserprofil erhalten.
Die neu gestalteten Trainingsrouten lesen, schreiben oder migrieren diese Daten
jedoch nicht. Die beibehaltenen Trainingseinstellungen unter `/settings`
laden und aktualisieren weiterhin ihren bestehenden lokalen Trainingszustand.
Es gibt für die neuen Trainingsrouten ausdrücklich keine IndexedDB-Migration.

## Integrationen und Datenschutz

Die UI-Foundation führt keine Supabase- oder Graphify-Aktion aus und
synchronisiert keine Trainingsdaten mit einem Backend oder anderen Geräten.
Sie benötigt keine zusätzlichen Secrets. Die vorhandenen PWA- und
Authentifizierungsgrenzen des Projekts bleiben unverändert.

## Prüfung

```bash
npm ci
npm run lint
npm run typecheck
npm run test
npm run build
npm run security:scan
npm run test:e2e
```

Die Trainings-E2E-Fälle prüfen die sichtbaren mobilen und Desktop-Abläufe. Die
lokale Supabase-E2E-Suite bleibt ohne `E2E_LOCAL_SUPABASE=true` erwartungsgemäß
übersprungen.
