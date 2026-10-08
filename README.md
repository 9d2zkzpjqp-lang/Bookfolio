# Meine Bibliothek · Version 0.6

Einfaches, coverzentriertes digitales Bücherregal für iPhone, iPad und Mac. Mit persönlicher Statistik, Autorenübersicht und Markierungsimport aus Yomu (Markdown `.md`) oder aus Notulator für Tolino (TXT-Einzeldatei `.txt`).

## Neu: Zitate und Markierungen

- **Buch öffnen → Markierungen & Zitate → +** oder **Einstellungen → Markierungen importieren**.
- TXT/MD auswählen. Der Import liest Buchname, Autor und Markierungen aus; vor dem Speichern zeigt er die Zuordnung zum vorhandenen Buch oder die Option **Neues Buch anlegen**. Die Daten werden **nicht automatisch einem anderen Buch zugeordnet**.
- In der Buchdetailseite erscheint eine kurze Vorschau. Antippen öffnet Kapitelgruppen mit vollständigem Text, Quelldatum und – bei Yomu – dem internen Link zur Markierung (sofern Yomu auf dem Gerät diesen Link unterstützt).
- Wiederholtes Einlesen derselben Markierungen erzeugt keine Duplikate. Einzelne Zitate lassen sich löschen, weitere manuell ergänzen oder pro Buch als Markdown exportieren.
- **Komplettes Backup** unter Einstellungen sichert Bücher und Zitate zusammen; das alte „JSON exportieren“ sichert weiterhin **nur Bücher**. Backups sind private Dateien und gehören **nicht in ein öffentliches GitHub-Repository**.

**Dateiformate:**
- Tolino-`notes.txt` (Rohdatei mit mehreren Büchern) bitte zuerst über [Notulator](https://www.notulator.com/de/) nach **einer TXT-Datei pro Buch** konvertieren. Die Rohdatei wird von dieser Version noch nicht direkt gelesen.
- Yomu: „Markierungen exportieren“ als Markdown (`.md`).
- Bei nicht erkennbaren Formaten gibt die App eine Fehlermeldung aus, ohne Inhalte zu verändern.

Die originale Exportdatei wird **im Browser gelesen, nicht hochgeladen**. Erst nach deiner Bestätigung werden einzelne Zitate in Supabase gespeichert. Ohne Anmeldung erfolgt die Speicherung nur lokal auf dem aktuellen Gerät. Details der Synchronisation und Magic-Link-Anmeldung bleiben wie in V0.5.

## Supabase

Das bestehende Projekt **Meine Bibliothek** in `eu-central-1` wurde bereits um die Tabelle `public.book_quotes` erweitert. Die Migration liegt für Dokumentations-/Wiederherstellungszwecke unter `quotes-migration.sql`. Die Tabelle ist per RLS geschützt (eingeloggte Nutzer dürfen ausschließlich Zitate der eigenen Bücher lesen und bearbeiten). Die Browser-App nutzt nur den **Publishable Key**, keine Admin-Zugangsdaten.

Die App braucht weiterhin ein HTTPS-Hosting (z. B. GitHub Pages) und die entsprechende Site URL/Redirect URL in Supabase Auth, um geräteübergreifend per Magic Link zu synchronisieren. Noch kein Nutzer angemeldet → noch keine Buch- oder Zitatdaten online.

## Vorschau vs. Produktivversion

- `index.html` und andere Dateien aus **meine-bibliothek-v0.6-app.zip**: Produktiv-PWA, **keine privaten Beispielbücher/Zitate** enthalten.
- **meine-bibliothek-v0.6-private-vorschau.html**: Eigenständige HTML-Datei mit deinen 5 übernommenen Book-Track-Büchern und zwei Zusatzbüchern mit insgesamt 35 Beispielmarkierungen aus den hier hochgeladenen Dateien. Nur zum lokalen Testen, ohne Supabase. Diese private Vorschau **nicht auf GitHub Pages hochladen**.

## Übernahme deiner bisher hochgeladenen Dateien

Der **separat bereitgestellte** private Datenstamm `meine-bibliothek-v0.6-privater-datenstamm.json` enthält bereits alle fünf aus Book Track übernommenen Titel, zwei neue Bücher (*Bindung ohne Burnout*, *Anfänge*) und die **35** erkannten Markierungen. Unter **Einstellungen → Vollständiges Backup → Komplett-Backup einlesen** lässt sich alles in einem Schritt importieren. Bereits vorhandene Bücher und identische Zitate werden übersprungen; neue Zitate werden bestehenden Titeln zugeordnet. **Nicht** ins öffentliche GitHub-Repository legen.
