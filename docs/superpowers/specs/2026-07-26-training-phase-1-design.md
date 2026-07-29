# Training Phase 1 Design

## Ziel

Der bisherige Platzhalter unter `/training` wird durch einen mobile-first Trainingsbereich ersetzt, der im Fitnessstudio vollständig offline funktioniert. Alle Trainingsdaten bleiben in Phase 1 lokal auf dem Gerät. Es gibt keine Supabase-Synchronisierung, keine Push-Erinnerungen und keine Körpergewichts- oder Analysefunktionen aus Phase 2.

## Umfang Phase 1

### Übungsbibliothek

- 50 häufige Übungen aus Brust, Rücken, Beine, Gesäß, Schultern, Arme und Rumpf.
- Enthalten sein müssen mindestens:
  - Bankdrücken
  - Schrägbankdrücken
  - Beinpresse
  - Kniebeugen
  - Romanian Deadlifts
  - Kreuzheben
  - Bizeps-Curls
  - Latziehen zur Brust
  - T-Bar Row
  - sitzendes Kabelrudern
  - Katana Triceps Extension
  - Beinstrecker
  - Beinbeuger
  - Dips
  - Klimmzüge
  - Preacher Curls
- Filter nach Muskelgruppe und Equipment sowie Suche nach Name.
- Technische Illustrationen im einheitlichen Stil:
  - Gerät oder Übungsaufbau klar erkennbar
  - Start- und Endposition
  - Bewegungsrichtung
  - Hauptmuskel kräftig orange
  - Nebenmuskeln im gleichen Orange mit geringerer Deckkraft
- Griffvarianten werden innerhalb einer Übung gespeichert und nicht als eigene Übungen dupliziert.
- Eigene Übungen können angelegt werden mit Name, Muskelgruppe, Equipment, Einheit, optionaler Beschreibung und optionalem eigenem Bild.

### Trainingspläne

- Nutzer kann Vorlagen wie Oberkörper oder Unterkörper erstellen.
- Neue Übung im Plan erhält standardmäßig `3 × 8–12`.
- Satzanzahl und Wiederholungsbereich sind beim Erstellen frei änderbar.
- Ein Plan kann optional mehreren Wochentagen zugeordnet werden.
- Wochentage dienen nur der Anzeige `Heute geplant`; es gibt keine Uhrzeit und keine Benachrichtigung.

### Aktives Training

- Es darf immer nur ein Training gleichzeitig aktiv sein.
- Beim Start eines zweiten Trainings werden angeboten:
  - aktives Training fortsetzen
  - aktives Training abschließen
  - aktives Training verwerfen
- Das aktive Training wird nach jeder Änderung lokal gespeichert und nach App-Neustart fortsetzbar angeboten.
- Übungen können während des Trainings hinzugefügt, entfernt und neu sortiert werden.
- Sätze können hinzugefügt oder gelöscht werden.
- Werte des letzten abgeschlossenen Trainings werden automatisch vorausgefüllt und bleiben änderbar:
  - Gewicht
  - Wiederholungen
  - Satzbewertung
  - Anzahl der Sätze
  - letzte Griffvariante
- Bei jeder Übung wird die letzte gespeicherte Notiz angezeigt.
- Wird keine neue Notiz eingetragen, bleibt die vorherige erhalten.
- Wird eine Notiz bewusst geleert und gespeichert, erscheint beim nächsten Training keine Notiz.

### Satzdaten

Jeder Satz enthält:

- Gewicht oder Belastungswert
- Wiederholungen
- Bewertung von 1 bis 10
- abgeschlossen / nicht abgeschlossen

Die Satzbewertung ist in den Einstellungen global deaktivierbar. Aufwärmsätze werden in Phase 1 nicht separat markiert.

### Klimmzüge und Dips

Für Klimmzüge und Dips stehen drei Modi zur Verfügung:

- Eigengewicht
- Zusatzgewicht
- Unterstützungsgewicht

Der zuletzt verwendete Modus und Wert werden wieder vorausgefüllt. Körpergewicht und Gesamtlast gehören zu Phase 2.

### Verlauf

- Abgeschlossene Trainings werden lokal gespeichert.
- Ein abgeschlossenes Training kann nachträglich bearbeitet werden.
- Ein abgeschlossenes Training kann nach Sicherheitsabfrage vollständig gelöscht werden.
- Nach Änderungen oder Löschung werden abgeleitete Bestwerte und Empfehlungen neu berechnet.

### Steigerungsempfehlung

Standardregel:

- oberes Wiederholungsziel in allen abgeschlossenen Arbeitssätzen erreicht
- in drei aufeinanderfolgenden Trainings
- durchschnittliche Satzbewertung höchstens 8 von 10
- Vorschlag: `+2,5 kg`

Einstellungen:

- Funktion global ein- oder ausschaltbar
- notwendige erfolgreiche Trainings wählbar, standardmäßig 3
- Bewertungsgrenze anpassbar, standardmäßig 8
- globale Gewichtserhöhung anpassbar, standardmäßig 2,5 kg

Spätere Erweiterung: individuelle Erhöhung pro Übung.

## Navigation und Ansichten

### Training-Startseite

- Bereich `Heute geplant`
- aktives Training fortsetzen, falls vorhanden
- Trainingsvorlagen
- Schnellzugriff auf Verlauf
- Schnellzugriff auf Übungsbibliothek

### Trainingsplan bearbeiten

- Name des Plans
- optionale Wochentage
- sortierbare Übungsliste
- Ziel-Sätze und Wiederholungsbereich pro Übung
- Übung hinzufügen oder entfernen

### Übungsbibliothek

- Suche
- Muskelgruppenfilter
- Equipmentfilter
- Favoriten
- Karten mit Illustration, Name, Hauptmuskel und Equipment
- Detailansicht mit größerer Illustration, Haupt- und Nebenmuskeln sowie kurzer Ausführung

### Laufendes Training

- klarer Status und Startzeit
- aktuelle Übung prominent
- letzte Werte sichtbar und bereits vorausgefüllt
- große mobile Eingabefelder
- Satzzeilen für Gewicht, Wiederholungen, Bewertung und Abschluss
- Übungsnotiz
- Griffvariante, falls unterstützt
- Übungen hinzufügen, entfernen und sortieren
- Training abschließen oder verwerfen

### Verlauf

- Liste abgeschlossener Trainings nach Datum
- Detailansicht mit Übungen und Sätzen
- Bearbeiten und Löschen

### Einstellungen

- Satzbewertung anzeigen: an/aus
- Steigerungsempfehlungen: an/aus
- notwendige erfolgreiche Trainings
- Bewertungsgrenze
- Standarderhöhung in kg

## Datenmodell

Die Domäne wird in getrennte, klar abgegrenzte Modelle aufgeteilt:

- `ExerciseDefinition`: allgemeine oder eigene Übung, Muskelgruppen, Equipment, Varianten und Illustration
- `WorkoutTemplate`: Name, Wochentage und geplante Übungen
- `WorkoutTemplateExercise`: Übungsreferenz, Reihenfolge, Ziel-Sätze und Wiederholungsbereich
- `ActiveWorkout`: genau eine laufende Sitzung mit Startzeit und aktuellem Bearbeitungsstand
- `WorkoutExerciseEntry`: konkrete Übung innerhalb einer Sitzung, Griffvariante und Notiz
- `WorkoutSetEntry`: Gewicht, Wiederholungen, Bewertung und Abschlussstatus
- `CompletedWorkout`: unveränderliche abgeschlossene Sitzung, die über einen gezielten Bearbeitungsablauf ersetzt werden kann
- `TrainingPreferences`: lokale Einstellungen für Bewertung und Steigerungsempfehlungen

Alle IDs werden stabil erzeugt, damit eigene Übungen und historische Daten dauerhaft referenzierbar bleiben.

## Lokale Speicherung und Offline-Verhalten

- Trainingsdaten werden ausschließlich lokal auf dem Gerät gespeichert.
- Für strukturierte und wachsende Daten wird IndexedDB verwendet; einfache UI-Einstellungen dürfen weiterhin Local Storage verwenden.
- Schreibvorgänge erfolgen atomar, soweit die Browser-API dies unterstützt.
- Aktives Training wird nach jeder relevanten Änderung gespeichert.
- Die 50 Standardübungen und ihre Illustrationen werden mit der App ausgeliefert und durch den Service Worker offline verfügbar gemacht.
- Eigene Bilder werden lokal gespeichert und vor Speicherung auf eine vernünftige Auflösung und Dateigröße reduziert.
- Ein Schema-Versionsfeld ermöglicht spätere lokale Migrationen und eine spätere optionale Supabase-Synchronisierung.

## Fehlerbehandlung

- Beschädigte oder nicht migrierbare lokale Datensätze werden nicht still überschrieben.
- Die App zeigt einen verständlichen Fehler und bietet Export oder Zurücksetzen des Trainingsbereichs an.
- Ein fehlendes eigenes Bild wird durch eine Standardillustration ersetzt.
- Verwerfen und Löschen erfordern eine Sicherheitsabfrage.
- Unvollständige Sätze dürfen gespeichert werden, zählen aber nicht für Empfehlungen oder Bestwerte.

## Barrierefreiheit und Bedienung

- Mobile-first mit großen Touch-Zielen und numerischen Tastaturen für Gewicht und Wiederholungen.
- Alle Eingaben erhalten sichtbare Labels.
- Illustrationen sind dekorativ oder besitzen passende Alternativtexte.
- Sortieren muss neben Drag-and-drop auch per Schaltflächen möglich sein.
- Haupt- und Nebenmuskeln dürfen nicht ausschließlich über Farbintensität erklärt werden; Textkennzeichnungen bleiben sichtbar.
- Dialoge und Bestätigungen folgen dem vorhandenen Design-System.

## Tests

### Unit-Tests

- Standardwerte `3 × 8–12`
- Vorausfüllen aus dem letzten abgeschlossenen Training
- Notiz bleibt erhalten, wenn keine neue eingetragen wird
- Griffvariante wird wiederhergestellt
- nur ein aktives Training
- Steigerungsregel und anpassbare Grenzwerte
- nicht abgeschlossene Sätze werden ignoriert
- Bearbeiten und Löschen berechnen abgeleitete Werte neu
- Modi für Klimmzüge und Dips
- lokale Datenmigrationen

### Komponenten-Tests

- Plan erstellen und bearbeiten
- Übung suchen, filtern und hinzufügen
- eigenes Training und eigene Übung anlegen
- Training fortsetzen nach Neuladen
- Satz erfassen und abschließen
- Training bearbeiten und löschen
- Einstellungen ein- und ausschalten

### End-to-End-Tests

- vollständiger mobiler Ablauf vom Plan bis zum Abschluss
- Offline-Start mit bereits gecachten Standardübungen und Illustrationen
- App-Schließen und Fortsetzen eines aktiven Trainings
- bestehende Navigation und andere Bereiche bleiben unverändert

## Nicht in Phase 1

- Supabase-Synchronisierung
- Push-Benachrichtigungen oder Erinnerungszeiten
- Pausentimer
- Aufwärmsatz-Markierung
- Körpergewicht und Körpermaße
- Gesamtlast für Eigengewichtsübungen
- Fortschrittsdiagramme
- Trainingsvolumen und Muskelgruppenanalyse
- umfangreiche persönliche Rekorde
- KI-Trainingsplanung

## Phase 2

Nach stabiler Phase 1 folgen:

- Fortschrittsdiagramme
- Trainingsvolumen
- persönliche Rekorde
- Muskelgruppen-Auswertung
- Körpergewicht und Maße
- Gesamtlast bei Klimmzügen und Dips
- langfristige Leistungsentwicklung
- ausführlichere Empfehlungen

## Akzeptanzkriterien

Phase 1 ist abgeschlossen, wenn ein Nutzer auf einem installierten Smartphone ohne Internet:

1. einen Trainingsplan mit Standardwerten erstellen kann,
2. allgemeine und eigene Übungen auswählen kann,
3. ein Training starten, unterbrechen und fortsetzen kann,
4. letzte Werte, Notiz und Griffvariante vorausgefüllt erhält,
5. jeden Satz mit Gewicht, Wiederholungen und optionaler Bewertung speichern kann,
6. Übungen und Sätze während des Trainings verändern kann,
7. das Training abschließen kann,
8. abgeschlossene Trainings bearbeiten oder löschen kann,
9. bei erfüllter konfigurierbarer Regel eine Steigerungsempfehlung erhält,
10. nach erneutem Öffnen alle lokalen Daten unverändert vorfindet.
