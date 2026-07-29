# Training Phase 2 Analytics Design

## Ziel und Grenzen

Phase 2 erweitert den vorhandenen, vollständig lokalen Trainingsbereich um Fortschrittsanalysen, persönliche Rekorde, Muskelgruppen-Auswertungen, Körpergewicht und Gesamtlasten für Klimmzüge und Dips. IndexedDB bleibt die einzige persistente Quelle für Trainingsdaten. Sämtliche Kennzahlen werden auf dem Gerät berechnet; es gibt keine Supabase-Kommunikation, externe Datenquelle oder Laufzeitabhängigkeit.

Nicht Bestandteil sind Synchronisierung, Importe, Health-Plattformen, Push-Nachrichten, Erinnerungszeiten, Pausentimer, medizinische Aussagen, KI-Planung, soziale Funktionen oder automatische Planänderungen.

## Bestehende Architektur

Phase 1 verwendet eine profilbezogene `TrainingState` in der IndexedDB-Datenbank `coregrid-training`. Datenbank- und Schema-Version stehen auf 1. Die Stores `states` und `images` enthalten strukturierte Daten beziehungsweise komprimierte eigene Übungsbilder. Der `TrainingProvider` serialisiert Schreibvorgänge, zeigt optimistische Änderungen an und behandelt fehlgeschlagene Schreibvorgänge mit Rollback oder Wiederherstellung.

Diese Architektur bleibt bestehen. Phase 2 führt keine zweite Datenbank und keinen zweiten konkurrierenden State-Provider ein.

## Gewählte Architektur

### Persistierte Daten

`TrainingState` wird additiv auf Schema-Version 2 erweitert. Persistiert werden:

- `bodyWeightEntries`: ein Eintrag pro lokalem Kalenderdatum,
- `analyticsPreferences`: Zeitraum, optionaler eigener Datumsbereich, zuletzt gewählte Analysekennzahlen und ausgeblendete Balance-Hinweise,
- Übungssnapshots in aktiven und abgeschlossenen Trainingseinträgen,
- optionale Körpergewicht-Snapshots an historischen Übungen mit Körpergewichtsmodus.

Rekorde, Rekordhistorien, Diagrammreihen, Heatmap-Zellen, Muskelgruppenwerte und Dashboard-Kennzahlen werden nicht dauerhaft dupliziert. Sie bleiben aus den historischen Trainingsdaten reproduzierbar.

### Abgeleitete Daten

Eine UI-unabhängige Analyse-Schicht unter `src/features/training/analytics/` enthält kleine reine Module für:

- lokale Datumsbereiche,
- Satzlast, Volumen und Epley-1RM,
- Übungsserien,
- Rekorde und Verbesserungshistorien,
- Muskelgruppenwerte,
- Balance-Hinweise,
- Körpergewicht und 7-Tage-Trend,
- Heatmap und Dashboard-Kennzahlen.

Die Module erhalten explizite Eingaben und geben unveränderliche Resultate zurück. IndexedDB-Zugriffe, React-Zustand und Navigation sind nicht Teil dieser Berechnungen. Eine zentrale Rundungsschicht formatiert Werte für die UI, während intern mit der verfügbaren numerischen Präzision gerechnet wird.

### Diagramme

Es wird keine neue Diagrammabhängigkeit installiert. Die benötigten Linien- und Balkendiagramme werden als fokussierbare, responsive SVG-Komponenten im bestehenden Slate-/Orange-System umgesetzt. Eine semantische Zusammenfassung beziehungsweise Datentabelle ist immer verfügbar. Heatmaps verwenden ein kalenderartiges CSS-Raster. Tooltips funktionieren per Fokus, Tastatur, Klick und Touch.

Diese Lösung hält Bundle und Offline-Cache klein, vermeidet externe Laufzeitquellen und deckt die drei benötigten Diagrammtypen gezielt ab.

## Datenmodell

### Übungssnapshot

Jeder Sitzungseintrag erhält einen `ExerciseSnapshot` mit mindestens:

- Übungs-ID,
- Name,
- primären und sekundären Muskelgruppen,
- Einheit,
- Körpergewichtsmodus-Unterstützung.

Neue Snapshots werden beim Start beziehungsweise Hinzufügen einer Übung erstellt und beim Abschluss unverändert übernommen. Änderungen oder Löschungen am aktuellen Katalog verändern historische Auswertungen dadurch nicht.

Bei der Migration bestehender Phase-1-Daten wird der Snapshot aus dem Standardkatalog oder der noch vorhandenen eigenen Übung ergänzt. Ist eine eigene Übung bereits vor der Migration gelöscht worden, bleiben Sitzung, ID, Sätze und Reihenfolge erhalten; der Snapshot verwendet eine neutrale Ersatzbezeichnung und leere Muskelgruppen, weil verlorene Metadaten nicht erfunden werden dürfen.

### Körpergewichtseintrag

Ein `BodyWeightEntry` enthält:

- stabile ID,
- lokales Datum im Format `YYYY-MM-DD`,
- Gewicht in Kilogramm,
- optionale Notiz,
- Erstellungs- und Änderungszeitpunkt als ISO-Zeitstempel.

Das Datum ist innerhalb eines Profils eindeutig. Anlegen am gleichen Datum aktualisiert den vorhandenen Eintrag. Beim Verschieben auf ein bereits belegtes Datum wird nicht automatisch zusammengeführt; die UI zeigt einen verständlichen Konflikt.

Plausible Gewichte liegen zentral validiert zwischen 20 und 500 kg. Werte werden mit höchstens zwei Dezimalstellen gespeichert.

### Körpergewicht-Snapshot

Ein `BodyWeightSnapshot` enthält:

- verwendetes Gewicht,
- Quelldatum des Körpergewichtseintrags,
- Erstellungszeitpunkt.

Beim Trainingsabschluss wird für Klimmzüge und Dips zuerst ein Eintrag am lokalen Trainingstag, sonst der letzte frühere Eintrag verwendet. Spätere Einträge sind ausgeschlossen. Fehlt ein gültiger Wert, bleibt der Snapshot leer.

Wenn später ein Körpergewichtseintrag angelegt wird, dürfen bisher fehlende Snapshots für passende historische Sitzungen einmalig ergänzt werden. Bestehende Snapshots werden niemals automatisch überschrieben. Die historische Trainingsansicht bietet für bewusstes Bearbeiten eine Aktion `Körpergewicht neu bestimmen`, die den Snapshot explizit neu berechnet oder entfernt, wenn keine Grundlage vorhanden ist.

### Analysepräferenzen

Persistiert werden:

- Zeitraumtyp `7d`, `30d`, `3m`, `6m`, `1y`, `all` oder `custom`,
- Start- und Enddatum für einen eigenen Bereich,
- zuletzt gewählte Kennzahl für Übungs- und Muskelgruppenanalyse,
- ausgeblendete Balance-Hinweis-IDs.

Ungültige gespeicherte Präferenzen werden durch Schema-Migration auf sichere Standardwerte zurückgeführt, ohne Trainingsdaten anzutasten.

## Migration

Die IndexedDB-Version wird von 1 auf 2 erhöht. Die Stores `states` und `images` bleiben unverändert erhalten; ein zusätzlicher Store ist für die erwartete lokale Datenmenge nicht nötig. Das Upgrade darf vorhandene Stores nicht erneut anlegen oder löschen.

Beim Laden migriert `TrainingState` schrittweise von Version 1 auf 2:

1. vorhandene Phase-1-Felder unverändert übernehmen,
2. Körpergewichts- und Analysepräferenzen mit leeren beziehungsweise sicheren Defaults ergänzen,
3. Übungssnapshots für aktive und abgeschlossene Einträge ergänzen,
4. Ergebnis strikt mit Zod validieren.

Migrationen sind idempotent. Bilder bleiben im separaten Store unangetastet. Ein Fehler erzeugt weiterhin `TrainingDataCorruptionError`; es gibt weder automatische Löschung noch stilles Zurücksetzen.

## Zeitraumlogik

Alle Filter verwenden inklusive lokale Kalendertage. Schnellbereiche enden am aktuellen lokalen Tag:

- 7 Tage: heute plus sechs vorherige Tage,
- 30 Tage: heute plus 29 vorherige Tage,
- 3, 6 und 12 Monate: kalendarisch zurückgerechnet und am Monatsende begrenzt,
- Gesamt: vom ältesten relevanten Datensatz bis heute,
- eigener Bereich: beide Grenztage inklusive.

Startdatum nach Enddatum ist ungültig und blockiert die Anwendung des Filters. ISO-Zeitstempel von Trainings werden vor dem Vergleich in das lokale Kalenderdatum überführt. Eine gemeinsame Datumslogik verhindert Abweichungen zwischen Dashboard, Charts, Rekorden, Heatmap und Körpergewicht.

## Berechnungsregeln

### Gültige Sätze und Gesamtlast

Nur als abgeschlossen markierte Sätze werden ausgewertet. Gewicht und Wiederholungen müssen endlich und nicht negativ sein.

Für normale gewichtete Übungen ist die Satzlast `weightKg`. Für Klimmzüge und Dips gilt mit vorhandenem Snapshot:

- Körpergewicht: `Körpergewicht`,
- Zusatzgewicht: `Körpergewicht + Zusatzgewicht`,
- Unterstützung: `max(0, Körpergewicht - Unterstützungsgewicht)`.

Ohne Snapshot entsteht keine Gesamtlast, kein Volumen, kein Gewichtsrekord und kein 1RM. Wiederholungsrekorde bleiben möglich.

### Trainingsvolumen

Satzvolumen ist `gültige Satzlast × Wiederholungen`. Übungs-, Trainings- und Zeitraumvolumen sind die jeweiligen Summen. Übungen ohne gewichtete Einheit liefern kein Volumen.

### Geschätztes 1RM

Für 1 bis 12 Wiederholungen gilt ausschließlich:

`1RM = Satzlast × (1 + Wiederholungen / 30)`

Null Wiederholungen, mehr als 12 Wiederholungen, fehlende Last und Übungen ohne Gewicht werden ignoriert. Intern bleibt die Präzision erhalten; die UI rundet zentral auf eine sinnvolle Nachkommastelle.

### Übungsaggregation pro Training

- Gewicht: höchste gültige Satzlast,
- Wiederholungen: höchste abgeschlossene Wiederholungszahl,
- Volumen: Summe aller gültigen Satzvolumen,
- 1RM: höchstes gültiges Satz-1RM.

Jeder Datenpunkt behält Workout-, Übungs- und Satzreferenzen für Detailanzeige und Verlauf-Link.

### Persönliche Rekorde

Rekorde werden chronologisch aus allen passenden historischen Sätzen rekonstruiert:

- höchstes Gewicht,
- höchstes Satzvolumen,
- höchste Wiederholungszahl.

Der erste gültige Wert eröffnet die Historie. Nur strikt höhere Werte erzeugen weitere Einträge; Gleichstände nicht. Jeder Eintrag enthält vorherigen Wert, Datum, Übung, Training und Satzreferenz. Bearbeitung und Löschung benötigen keine besondere Cache-Invaliderung, weil die gesamte Folge aus dem aktuellen Verlauf neu entsteht.

### Muskelgruppen

Pro abgeschlossenem Satz erhält jede primäre Muskelgruppe 1,0 gewichtete Sätze und 100 Prozent des Satzvolumens. Jede sekundäre Muskelgruppe erhält 0,5 gewichtete Sätze und 50 Prozent des Satzvolumens. Mehrere primäre oder sekundäre Muskelgruppen werden jeweils vollständig nach dieser Regel bewertet; daher darf die Summe über Muskelgruppen größer als das reine Trainingsvolumen sein.

Übungen ohne Gewicht zählen bei gewichteten Sätzen, aber nicht beim Volumen. Die historische Übungssnapshot-Struktur ist für Namen und Muskelgruppen verbindlich.

### Balance-Hinweise

Hinweise erscheinen erst bei mindestens fünf vollständig abgeschlossenen Trainings im Zeitraum. Unvollständige Trainings zählen weder zur Mindestmenge noch zu den Vergleichswerten.

Zentral definierte Regeln vergleichen robuste Gruppen:

- Rücken gegen Brust,
- hintere Schulter gegen Brust und vordere Schulter,
- Beine und Gesäß gegen den Oberkörper.

Ein Hinweis entsteht nur, wenn die kleinere Seite weniger als 50 Prozent der Vergleichsseite erreicht und die Vergleichsseite mindestens acht gewichtete Sätze besitzt. Texte bleiben neutral, nennen den Zeitraum und werden als Orientierung gekennzeichnet. Ausgeblendete Hinweise werden über eine stabile Regel-ID lokal gespeichert.

### Körpergewichtstrend

Der gleitende 7-Tage-Durchschnitt eines Messpunkts verwendet vorhandene Messwerte zwischen dem Messdatum minus sechs Kalendertagen und dem Messdatum einschließlich. Fehlende Tage werden nicht als Null eingesetzt. Die Trendlinie besitzt nur an tatsächlichen Messdaten Punkte.

## Benutzeroberfläche und Navigation

### Interne Navigation

Eine gemeinsame `TrainingNavigation` bietet:

- Übersicht,
- Pläne,
- Bibliothek,
- Verlauf,
- Fortschritt.

Bestehende URLs bleiben gültig. `Pläne` verweist zunächst auf die Trainingsübersicht mit dem Planbereich; neue Editor-URLs bleiben unverändert. Unter `/training/progress` liegen:

- Dashboard als Index,
- `/exercises`,
- `/records`,
- `/muscles`,
- `/bodyweight`.

Eine zweite kompakte `ProgressNavigation` verbindet diese Unterseiten. Alle Routen bleiben im vorhandenen geschützten `AppShell`, sodass globale Sidebar und mobile Bottom-Navigation sichtbar bleiben.

### Dashboard und Heatmap

Das Dashboard zeigt nur Kennzahlen, die fachlich aus vorhandenen Daten ableitbar sind. Fehlende Körpergewichtsdaten erscheinen als `Keine Messdaten` statt als null Kilogramm. Ein gemeinsamer Zeitraumfilter steuert Kennzahlen, Heatmap und Schnellzugriffe.

Die Heatmap zeigt lokale Kalendertage. Intensität basiert auf abgeschlossenen Sätzen. Ein Symbol beziehungsweise sichtbares Statuskürzel unterscheidet unvollständige von vollständigen Trainings zusätzlich zur Farbe. Tagesdetails unterstützen mehrere Trainings und verlinken jeden Verlaufseintrag.

### Übungsanalyse und Rekorde

Übungen lassen sich suchen und nach primärer Muskelgruppe filtern. Favoriten werden optional zuerst sortiert. Pro Übung wird eine Kennzahl gleichzeitig in einem Linienchart gezeigt. Fokussieren oder Antippen eines Punktes öffnet Details der zugehörigen Einheit.

Die Rekordübersicht unterstützt Suche, Muskelgruppe und Rekordart. Die Detailansicht zeigt aktuelle Rekorde und die chronologische Verbesserungshistorie.

### Muskelgruppen

Ein Umschalter wählt gewichtete Sätze oder Volumen. Balkendiagramm und sortierte Rangliste zeigen absolute Werte und Anteile. Eine Muskelgruppe öffnet ihre beteiligten Übungen mit Beitrag und Link zur Übungsanalyse. Die UI erklärt ausdrücklich, weshalb gewichtete Muskelgruppen-Summen größer als das reine Trainingsvolumen sein können.

### Körpergewicht

Die Seite zeigt aktuellen, ersten, niedrigsten und höchsten Wert, Veränderung im Zeitraum, Veränderung zur vorherigen Messung und Messanzahl. Hinzufügen und Bearbeiten verwenden einen zugänglichen Dialog; Löschen benötigt eine Bestätigung. Rohwerte und 7-Tage-Trend stehen als SVG und zugängliche Werteliste bereit.

### Übungsdetails

Der vorhandene Detaildialog erhält einen kompakten Fortschrittsblock. Für passende Übungen zeigt er aktuelle Rekorde, letzten Trend und ein kleines Diagramm. Kennzahlen ohne fachliche Grundlage werden ausgelassen. Ein Link öffnet die vollständige Analyse über eine direkte URL mit Übungs-ID.

## Schreibvorgänge und Fehlerbehandlung

Körpergewicht, Präferenzen, ausgeblendete Hinweise und Snapshot-Aktualisierungen verwenden die bestehende serialisierte Provider-Schreibqueue. Optimistische Änderungen erhalten gezielte Rollbacks. Fehler werden über bestehende Toast- und Inline-Alert-Muster auf Deutsch angezeigt.

Ein fehlgeschlagener Migrations- oder Lesevorgang sperrt den Bereich weiterhin über den Recovery-Dialog. Große Verlaufsdaten werden mit `useMemo` nur bei relevanten Änderungen neu berechnet. Diagramme dürfen für die visuelle Linie deterministisch reduzieren, müssen aber Extrema und Randpunkte erhalten; die vollständige zugängliche Werteliste bleibt unverändert.

## Responsive Verhalten und Barrierefreiheit

Mobil verwenden Navigation und Filter horizontal scrollbare beziehungsweise umbrechende Kontrollleisten. Diagramme besitzen responsive ViewBoxes, mindestens 44 Pixel große interaktive Punkte und keine Seitenüberbreite. Heatmap und Ranglisten bleiben horizontal kontrolliert scrollbar. Safe-Area-Abstände der vorhandenen Bottom-Navigation bleiben erhalten.

Auf Desktop begrenzen Karten und Diagramme ihre Lesebreite und nutzen mehrspaltige Raster, ohne Formulare übermäßig zu strecken.

Alle Diagramme haben Überschrift, Beschreibung und alternative Werte. Status wird nicht nur farblich dargestellt. Dialoge folgen `ResponsiveDialog`, Fokuszustände bleiben sichtbar und alle Filter sind tastaturbedienbar.

## Offline-PWA

Alle neuen Seiten, SVG-Komponenten, Berechnungen und Texte werden in das bestehende App-Bundle aufgenommen. Es gibt keine externen Assets oder APIs. Die vorhandene Workbox-Konfiguration benötigt voraussichtlich keine neue Laufzeitregel; Produktions-Build und ein Offline-Playwright-Lauf bestätigen die Navigation.

## Teststrategie

Die Umsetzung erfolgt testgetrieben in vertikalen Abschnitten:

1. Schema-Version 2 und Migration realistischer Phase-1-Daten,
2. Zeitraum- und Körpergewichtsfunktionen,
3. Gesamtlast, Volumen und 1RM,
4. Rekorde und historische Rekonstruktion,
5. Muskelgruppen, Balance-Hinweise und Heatmap,
6. Provider-Schreibvorgänge und Snapshots,
7. Navigation und Fortschrittsseiten,
8. Diagramm- und Dialoginteraktionen,
9. Übungsdetail-Erweiterung,
10. mobile, persistente und offline End-to-End-Abläufe.

Jeder Kernalgorithmus erhält Grenztests. Komponententests prüfen deutsche Texte, Leerzustände, Filter, Dialoge und Schreibfehler. Playwright deckt den durchgängigen mobilen Ablauf einschließlich Reload, historische Änderung, Löschung und Offline-Navigation ab.

## Akzeptanzkriterien

Phase 2 ist abgeschlossen, wenn:

1. alle Phase-1-Daten nach der Migration unverändert nutzbar sind,
2. Dashboard, Heatmap, Übungsanalyse, Rekorde, Muskelgruppen und Körpergewicht direkt und nach Reload funktionieren,
3. historische Änderungen und Löschungen alle abgeleiteten Werte korrekt verändern,
4. Klimmzüge und Dips ausschließlich mit gültigem historischem Körpergewicht Gesamtlast, Volumen und 1RM liefern,
5. neue historische Snapshots stabil bleiben,
6. sämtliche neuen Funktionen offline und responsiv funktionieren,
7. alle verpflichtenden Unit-, Komponenten-, Build-, Sicherheits- und E2E-Prüfungen erfolgreich sind,
8. keine Trainingsdaten das Gerät verlassen.
