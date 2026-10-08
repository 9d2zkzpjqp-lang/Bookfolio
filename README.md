# Bookfolio · Version 0.7

Persönliche, coverzentrierte Bücher- und Lesestatistik-App (HTML/PWA) für iPhone, iPad und Mac. Mit Supabase-Synchronisation, Autorenübersicht und privatem Zitatimport aus Tolino/Notulator und Yomu.

## Neu in V0.7

- Beim Hinzufügen über Titel-/Autorensuche oder manuelle Eingabe werden Kurzbeschreibung und fehlende Angaben **im Hintergrund** ergänzt, sofern ein plausibler Treffer bei Open Library bzw. Google Books gefunden wird.
- In der **Buchdetailseite** erscheint der kurze **Kurzinhalt** (ausklappbar). Er ist getrennt von persönlichen Notizen und Zitaten. Wenn vorhanden, wird die Datenquelle angezeigt.
- **Buch öffnen → `•••` → „Cover & Buchdaten ergänzen“** oder unten **„Buchdaten ergänzen“**: Vorschau prüfen, bei Bedarf ein anderes Cover auswählen, anschließend Änderungen ausdrücklich übernehmen. Vorhandene Angaben werden nicht überschrieben, außer wenn ein Cover aktiv ausgewählt wird.
- Unter **Einstellungen → Buchdaten & Kurzinhalt → „Fehlende Buchdaten ergänzen“**: bis zu 12 Bücher pro Durchlauf auf fehlende Cover, Seiten, Erscheinungsjahr und Kurzbeschreibungen prüfen. Weitere Bücher folgen beim nächsten Durchlauf.
- Kurzinhalt kann außerdem direkt über **Buch → Bearbeiten** verändert oder ergänzt werden.

**Wichtig:** Die Suche kann fehlende Informationen nicht für jedes Buch finden. Beim automatischen Sammelimport wird eine fehlende ISBN nicht aufgrund irgendeiner Auflage geraten; du kannst die passende ISBN bei Einzelbearbeitung selbst prüfen. Bewertungen, Lesefortschritt/-status, Lesedaten, Genre/Tags, eigene Notizen und Zitate werden von der Metadaten-Suche **niemals überschrieben**.

## Supabase – erledigt

Das bestehende Projekt `qqovvzqfftxwjhybzbzg` wurde **bereits** um drei neue Textfelder in `public.books` erweitert: `description`, `description_source`, `description_source_url`. Die DDL steht zusätzlich zur Dokumentation in `metadata-migration.sql`. RLS und bisherige Policies bestehen unverändert weiter. Der Browser enthält ausschließlich den Supabase-Publishable-Key (keinen Secret-Key). Du musst im Supabase-Dashboard **kein SQL mehr ausführen**.

## Veröffentlichung auf GitHub Pages

Die Dateien aus diesem Verzeichnis in dein bestehendes GitHub-Repository hochladen (bestehende Dateien gleichen Namens ersetzen, neue Datei `metadata.js` ergänzen). Nicht den ZIP-Ordner als Unterordner hochladen: `index.html` und `metadata.js` müssen im **Root** liegen.

Repository: https://github.com/9d2zkzpjqp-lang/Bookfolio
App: https://9d2zkzpjqp-lang.github.io/Bookfolio/

Nach dem GitHub-Pages-Deploy die App neu laden. Bei alten PWA-Ansichten kann ein zweiter Reload bzw. Neustart der installierten App nötig sein, weil ein Service Worker noch die vorige Version im Cache hat. Die neue Cache-Version ist `bookfolio-v07`.

Die private Book-Tracker-/Zitate-Importdatei **nicht in das öffentliche Repository hochladen**. Die sieben bereits in Supabase gespeicherten Bücher bleiben unberührt; erst nach Betätigen des Ergänzen-Buttons werden die fehlenden Angaben gespeichert.

## Zitate (weiterhin wie in V0.6)

- Buch öffnen → Markierungen & Zitate → `+` oder Einstellungen → Markierungen importieren.
- Tolino: von Notulator je Buch ausgegebene TXT-Datei; Yomu: Markdown-Datei (`.md`).
- Kapitel, Quelle und ggf. Yomu-Links werden erhalten; wiederholte Importe erzeugen keine Duplikate.
- Unter **Einstellungen → Vollständiges Backup** Bücher **und** Zitate exportieren/importieren.
- Das komplette Backup bleibt mit früheren V0.6-Sicherungen kompatibel; es enthält nun zusätzlich die Kurzinhalt-Felder pro Buch.

## Installation der PWA

GitHub-Pages-Adresse in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Für die Synchronisation mit Supabase mit derselben E-Mail-Adresse auf jedem Gerät anmelden.
