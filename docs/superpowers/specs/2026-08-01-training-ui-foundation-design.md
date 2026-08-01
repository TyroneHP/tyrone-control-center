# Training UI Foundation Redesign

## Ziel und Umfang

Der Training-Bereich von CoreGrid wird visuell und strukturell durch eine neue,
mobile-first Fitness-Oberfläche ersetzt. Das Ergebnis ist eine tatsächlich
bedienbare, aber bewusst flüchtige UI-Demo: Es verwendet ausschließlich
kontrollierte Mock-Daten im React-Zustand und schreibt keine Trainingsdaten.

Der Umfang umfasst nur die internen Trainingsbereiche **Dashboard**,
**Pläne** und **Bibliothek** sowie einen aktiven Trainingsablauf. Die globale
CoreGrid-Navigation bleibt unverändert: Desktop und Tablet behalten die
Sidebar, Mobilgeräte die Bottom-Navigation.

Nicht Teil dieser Lieferung sind IndexedDB, Migrationen, die vorhandene
Phase-1-/Phase-2-Analyseoberfläche, Verlauf, Fortschritt, Empfehlungen,
Körpergewicht, Synchronisierung, Supabase, Push, Timer, Import oder Export.
Vorhandene lokale Trainingsdaten werden weder gelesen, noch verändert, noch
gelöscht.

## Routen und Kompatibilität

Die neue Trainings-Routenstruktur lautet:

- `/training` — Dashboard
- `/training/plans/new` — Plan-Assistent
- `/training/plans/:planId` — Plan-Detail
- `/training/library` — Übungsbibliothek
- `/training/active` — aktives Training

Alle bisherigen tiefen Trainingsrouten werden zentral durch einen Router-Fallback
mit `replace` auf `/training` umgeleitet. Das schließt insbesondere
`/training/history`, `/training/progress` und jede bisherige Unterroute von
`/training/progress` ein. Alte Ansichten werden dadurch nicht mehr gerendert,
alte Links liefern keinen 404-Fehler und die Weiterleitung löscht keine Daten.

## Laufzeitarchitektur

`TrainingDemoProvider` ist eine vom bisherigen Training-Provider getrennte,
kleine UI-Domäne. Er hält die statischen Katalogdaten sowie alle veränderlichen
Demo-Daten im Speicher und stellt klare Aktionen bereit:

- Plan oder freies Training starten
- temporären Plan im Assistenten erstellen, bearbeiten und löschen
- Favoriten unabhängig von Filtern umschalten
- Sätze, Notizen und Griffvarianten im aktiven Training ändern
- Training simuliert abschließen oder nach Bestätigung verwerfen

Ein Reload stellt den definierten Demo-Ausgangszustand wieder her. Die
Schnittstelle wird so abgegrenzt, dass später ein persistenter Service dieselben
Aktionen implementieren kann, ohne die UI-Seiten neu zu entwerfen. Der alte
IndexedDB-Provider, Recovery-Dialog und alte Trainingsseiten werden aus dem
sichtbaren Laufzeitpfad entfernt; ihre Datenbank und Dateien bleiben unangetastet.

Der Katalog enthält den vollständigen vorhandenen Satz von 50 eingebauten
Übungen, jeweils mit lokaler Bildreferenz, Muskelgruppe, Equipment und – wo
verfügbar – Griffvarianten. Suche, Muskelgruppen-, Equipment- und
Favoritenfilter arbeiten immer gegen alle 50 Einträge; eine Auswahl bleibt bei
einem Filterwechsel erhalten.

## Nutzerabläufe

### Dashboard und Pläne

Das Dashboard zeigt bei aktivem Training eine kompakte Fortsetzen-Zeile mit
Name, Dauer, Fortschritt und Balken. Ein heutiger Plan erscheint als große
Startkarte; weitere Pläne erscheinen als native Listenzeilen mit Icon,
Wochentagen, Übungszahl und Dauer. Gibt es keinen Plan für heute, öffnet der
Start direkt die Planauswahl oder das freie Training.

Der schwebende blaue Plus-Button liegt oberhalb der mobilen Bottom-Navigation
und Safe Area und öffnet den vierstufigen Assistenten:

1. Name, optionale Beschreibung und Wochentags-Chips
2. Bibliothek mit Suche, Filter-Chips und Favoriten
3. kompakte, sortierbare Übungszeilen mit Satz-, Wiederholungs-, Gewicht- und
   Griffwerten; Standardwerte sind 3 Sätze und 8–12 Wiederholungen
4. Vorschau und Speichern in den Mock-Zustand

Der Assistent hat Fortschrittsanzeige, Schließen mit Warnung bei Änderungen und
eine untere, Safe-Area-fähige Aktionsleiste. Sortierung funktioniert per
Drag-and-drop und zusätzlich über zugängliche Auf-/Ab-Schaltflächen.

Die Plan-Detailansicht bietet Starten, Bearbeiten, Duplizieren und Löschen mit
Bestätigung. Sie verwendet ausschließlich kompakte Übungslisten, keine alte
Formular- oder Kartenansicht.

### Bibliothek und aktives Training

Die Bibliothek kombiniert Suchfeld, Chip-Filter, Favoriten und eine vollständige
scrollbare Liste aller 50 Übungen. Jeder Eintrag zeigt Illustration, Name,
Muskelgruppe und Equipment. Favoriten sind unabhängig vom aktuellen Filter.

Ein aktives Training zeigt genau eine Übung zur Zeit: Kopfzeile mit Dauer und
Fortschritt, Illustration, Zielwerte, letzte Werte, Griff, Notiz und kompakte
Satzzeilen. Satzzeilen enthalten Gewicht, Wiederholungen, optionale Bewertung,
Abschlussstatus und Entfernen. Vor/Zurück-Schaltflächen und eine bewusst
begrenzte Wischgeste auf der Inhaltsfläche wechseln Übungen; Eingabefelder
fangen keine Wischgeste ab. Eine Sticky-Aktionsleiste führt zu Abschließen,
Verwerfen oder dem nächsten Schritt.

## Visuelles System und Zugänglichkeit

Ein neues, auf den Trainingsbereich begrenztes Stylesheet definiert semantische
Tokens für hell und dunkel. Die Gestaltung verwendet systemnahe Schrift,
orange Trainingsaktionen, eine blaue FAB, zurückhaltende Glasflächen,
Haarlinien-Trenner, große Touch-Ziele und kompakte Listen statt übergroßer
Karten.

Wiederverwendbare Bausteine sind TrainingScreenHeader, TrainingList,
TrainingListRow, TrainingChip, TrainingSegmentedControl, TrainingSearch,
TrainingFab, TrainingBottomSheet, TrainingWizardHeader,
TrainingStickyActionBar, CompactExerciseRow, TrainingSetRow und
TrainingEmptyState. Sheets nutzen auf Mobilgeräten eine Bottom-Sheet-Präsentation
und auf Desktop passende Dialog-/Popover-Präsentation. Sie unterstützen Fokus,
Escape, Scroll-Sperre, Drag-Handle, Safe Area und Rückgabe des Fokus.

Alle Steuerelemente sind semantisch beschriftet, per Tastatur bedienbar und
haben sichtbare Fokuszustände. Zustände werden nicht ausschließlich durch Farbe
ausgedrückt. Animationen respektieren `prefers-reduced-motion`; mobile Tastatur
und Safe Areas überdecken keine Aktionen.

## Tests und visuelle Prüfung

Neue Komponenten- und Unit-Tests belegen die vollständige 50er-Bibliothek,
Suche, Filter, Favoriten, Auswahlpersistenz, alle vier Wizard-Schritte,
zugängliche Sortierung, Start-Sheet, Satzänderungen, Abschluss-/Verwerf-Dialoge
und zentrale Weiterleitungen alter Routen.

Playwright deckt den mobilen Kernablauf ab: Dashboard, Plan erstellen,
Übungen auswählen, Training starten, Werte ändern, Übung wechseln und Abschluss
beziehungsweise Verwerfen. Zusätzlich werden mobile Überbreite, Safe Area,
Sheets und Desktop-Sidebar geprüft. Screenshots dokumentieren Dashboard,
Plan-Detail, alle relevanten Wizard-Zustände, Bibliothek, Filter-Sheet und
aktives Training in Mobil- und Desktopansicht.

Vor dem Pull Request laufen `npm ci`, `npm run lint`, `npm run typecheck`,
`npm run test`, `npm run build`, `npm run security:scan` und `npm run test:e2e`.

## Bekannte, absichtliche Grenzen

Die neue Oberfläche speichert den UI-Zustand nur für die laufende Browser-Sitzung.
Echte Trainingsdaten, historische Analytics und die Phase-1-/Phase-2-Persistenz
sind weder migriert noch angezeigt. Eine spätere Persistenz ersetzt ausschließlich
den Demo-Service und kann die sichtbaren Routen und Komponenten weiterverwenden.
