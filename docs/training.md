# Training: lokale Daten und Analysen

Der CoreGrid-Trainingsbereich speichert alle Pläne, Übungen, aktiven und
abgeschlossenen Trainings, Bilder, Einstellungen und Analysedaten
ausschließlich im Browserprofil. Trainingsdaten werden weder an Supabase noch
an eine andere API übertragen.

## Architektur und Datenquelle

- `src/features/training/TrainingProvider.tsx` koordiniert den Zustand und
  serialisiert Schreibvorgänge pro lokalem Profil.
- `src/features/training/persistence/` kapselt IndexedDB, Schema-Prüfung und
  Migrationen. Die Datenbank heißt `coregrid-training`; strukturierte Daten
  liegen im Store `states`, eigene Übungsbilder im Store `images`.
- `src/features/training/analytics/` enthält reine, UI-unabhängige
  Berechnungen für Zeiträume, Last, Volumen, 1RM, Rekorde, Muskelgruppen,
  Balance-Hinweise, Körpergewicht, Dashboard und Heatmap.
- Trainingshistorie und historische Übungssnapshots sind die Quelle der
  Wahrheit. Rekorde, Diagrammreihen und Kennzahlen werden bei jeder relevanten
  Änderung neu daraus abgeleitet und nicht als konkurrierende Kopien
  gespeichert.
- Diagramme sind kleine lokale SVG-Komponenten mit einer bedienbaren
  Werteliste als Textalternative. Dadurch ist keine zusätzliche
  Diagrammabhängigkeit oder Laufzeit-API nötig.

Historische Trainings bewahren Namen, Muskelgruppen, Einheit und
Körpergewichts-Snapshots. Eine spätere Änderung oder Löschung einer eigenen
Übung verändert deshalb alte Auswertungen nicht.

## Zeitraumlogik

Die Schnellfilter umfassen 7 und 30 Tage, 3 und 6 Monate, 1 Jahr sowie den
Gesamtzeitraum. Tagesbasierte Zeiträume schließen den heutigen lokalen
Kalendertag ein; „7 Tage“ beginnt daher sechs lokale Kalendertage zuvor und
„30 Tage“ 29 Tage zuvor. Monatszeiträume verwenden Kalendermonate und begrenzen
den Zieltag auf den letzten gültigen Tag des Zielmonats.

Ein eigener Zeitraum enthält Start- und Enddatum. Ungültige Datumswerte oder
ein Startdatum nach dem Enddatum werden abgelehnt. Zeitstempel aus Trainings
werden an der lokalen Tagesgrenze in `YYYY-MM-DD` überführt. Die Auswahl wird
als lokale Analysepräferenz gespeichert und gemeinsam von Dashboard, Heatmap,
Übungen, Muskelgruppen, Rekordhistorie und Körpergewicht verwendet. Aktuelle
Rekorde bleiben als Gesamtzeit-Bestwerte ausdrücklich unabhängig vom Filter.

## Übungswerte, Volumen und geschätztes 1RM

Pro abgeschlossener Trainingseinheit werden folgende Punkte gebildet:

- Gewicht: höchste gültige Last eines abgeschlossenen Satzes.
- Wiederholungen: höchste abgeschlossene Wiederholungszahl.
- Volumen: Summe `Last × Wiederholungen` aller gültigen abgeschlossenen Sätze.
- Geschätztes 1RM: höchster gültiger Wert eines abgeschlossenen Satzes nach
  der Epley-Formel `Last × (1 + Wiederholungen / 30)`.

Für das 1RM gelten ausschließlich 1 bis 12 Wiederholungen. Sätze mit 0 oder
mehr als 12 Wiederholungen, ungültiger Last oder einer gewichtlosen Übung
liefern kein 1RM. Volumen entsteht ebenfalls nur für gültige Gewichtslasten und
positive Wiederholungszahlen. Intern wird mit voller Präzision gerechnet; die
Anzeige wird zentral auf höchstens zwei Nachkommastellen gerundet.

## Persönliche Rekorde

Rekorde werden pro Übung für höchste Last, höchstes Satzvolumen und höchste
Wiederholungszahl aus abgeschlossenen Sätzen rekonstruiert. Der erste gültige
Wert beginnt die Historie. Nur eine strikte Verbesserung erzeugt einen neuen
Historieneintrag; Gleichstände nicht. Jeder Eintrag verweist auf Übung,
Training, Satz und Datum und enthält den vorherigen Bestwert, sofern vorhanden.

Nach Bearbeitung oder Löschung eines historischen Trainings wird die komplette
Verbesserungsfolge neu aufgebaut. Fällt ein Bestwert weg, wird automatisch der
nächstbeste verbleibende Wert aktuell. Es gibt keine separat gespeicherte
Rekordkopie, die veralten könnte.

## Muskelgruppen und Balance-Orientierung

Ein abgeschlossener Satz zählt für jeden Primärmuskel mit 100 Prozent und für
jeden Sekundärmuskel mit 50 Prozent. Das gleiche Gewicht gilt für das
Satzvolumen. Weil ein Satz mehrere Muskeln belastet, darf die Summe der
Muskelgruppen größer als das reine Trainingsvolumen sein. Übungen ohne
Gewichtseinheit zählen als gewichtete Sätze, liefern aber kein Volumen.

Balance-Hinweise sind neutrale Orientierung und keine medizinische Bewertung.
Sie erscheinen erst ab fünf vollständig abgeschlossenen Trainings. Eine
Vergleichsseite benötigt mindestens acht gewichtete Sätze; ein Hinweis wird
erzeugt, wenn die kleinere Seite weniger als 50 Prozent der Vergleichsseite
erreicht. Zentral definierte Vergleiche sind Rücken zu Brust, hintere Schulter
zu Brust/vorderer Schulter sowie Beine/Gesäß zum Oberkörper. Unvollständige
Trainings erfüllen die Mindestzahl nicht. Ausgeblendete Hinweis-IDs bleiben als
lokale Präferenz gespeichert.

## Körpergewicht und Körpergewichtsübungen

Ein Körpergewichtseintrag enthält eine stabile ID, ein lokales Kalenderdatum,
20 bis 500 kg mit höchstens zwei Nachkommastellen, eine optionale Notiz sowie
Erstellungs- und Änderungszeitpunkt. Pro Tag existiert genau ein Eintrag. Eine
erneute Eingabe für denselben Tag aktualisiert ihn; beim Verschieben auf einen
bereits belegten Tag wird ein verständlicher Konflikt angezeigt.

Der gleitende 7-Tage-Durchschnitt umfasst für jeden Messpunkt den aktuellen und
die sechs vorherigen lokalen Kalendertage. Nur tatsächlich vorhandene
Messungen werden gemittelt; fehlende Tage zählen niemals als 0.

Für Klimmzüge und Dips gilt:

- Eigengewicht: `Gesamtlast = Körpergewicht`
- Zusatzgewicht: `Gesamtlast = Körpergewicht + Zusatzgewicht`
- Unterstützung: `Gesamtlast = max(0, Körpergewicht − Unterstützung)`

Verwendet wird zuerst eine Messung am Trainingstag, sonst die letzte frühere,
niemals eine spätere. Ohne passende Messung bleiben Gesamtlast, Volumen und 1RM
offen. Sobald eine Last bestimmt ist, speichert die historische Übung das
verwendete Gewicht, dessen Quelldatum und den Erfassungszeitpunkt als Snapshot.
Spätere Gewichtskorrekturen verändern diesen Snapshot nicht automatisch. In
der historischen Detailansicht kann er bewusst neu bestimmt werden.

## IndexedDB-Version 2 und Migration

Phase 2 erhöht die lokale Datenbankversion auf 2 und ergänzt den vorhandenen
Zustand um Körpergewichtseinträge, Analysepräferenzen und historische
Übungssnapshots. Die Migration akzeptiert Phase-1-Zustände der Versionen 0 und
1, ergänzt fehlende Snapshots aus dem eingebauten oder eigenen Katalog und
setzt nur die neuen Felder auf sichere Standardwerte.

Pläne, aktives Training, Verlauf, Notizen, Favoriten, eigene Übungen, Bilder
und Trainingseinstellungen bleiben erhalten. Die bestehenden Stores werden
nicht geleert und Daten werden nicht dupliziert. Version-2-Daten werden bei
jedem Laden vollständig mit Zod geprüft. Bei unbekannter oder beschädigter
Struktur zeigt die Anwendung eine Wiederherstellungsfehlermeldung; sie löscht
die Datenbank nicht stillschweigend.

## Offline, Datenschutz und Leistungsgrenzen

Der Trainingsbereich, Katalog, lokale SVG-Illustrationen und die gebündelten
Analyseansichten werden vom bestehenden PWA-App-Shell gecacht. Alle
Berechnungen und Schreibvorgänge funktionieren offline. Eigene Daten bleiben an
das jeweilige Browserprofil und Gerät gebunden; Browserdaten löschen entfernt
sie. Es gibt in Phase 2 keine geräte- oder kontoübergreifende Synchronisierung
und kein automatisches Backup.

Berechnungen erfolgen für übliche lokale Datenmengen direkt und werden in den
React-Ansichten memoisiert. SVG-Diagramme reduzieren nur die sichtbare
Punktmenge bei mehr als 500 Werten, während die vollständige zugängliche
Werteliste und alle Quelldaten unverändert bleiben. Ein persistenter
Analyse-Cache ist nicht nötig.

Weiterhin nicht enthalten sind Supabase-Synchronisierung, Apple Health,
Google Health Connect, CSV-/JSON-Import, Push-Benachrichtigungen,
Erinnerungszeiten, Pausentimer, medizinische Aussagen, KI-Trainingspläne,
automatische Planänderungen sowie soziale Funktionen.

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

`tests/e2e/training.spec.ts` prüft die Phase-1-Trainingsstrecke und das
produzierte Offline-App-Shell. `tests/e2e/training-analytics.spec.ts` prüft in
mobilem WebKit Dashboard, Diagramme, Rekorde, Muskelgruppen, Körpergewicht,
Gesamtlast-Snapshot, historische Neuberechnung und Offline-Navigation mit einem
ausschließlich lokalen Testprofil.
