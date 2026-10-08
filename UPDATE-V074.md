# Bookfolio V0.7.4 – Manuelle Buchdatensuche

Neu: Unter Buch → `•••` → „Cover & Buchdaten ergänzen“ steht ein Suchfeld für Titel, Autor oder ISBN zur Verfügung. Die Suche läuft zusätzlich zu der automatischen Erkennung über Open Library und Google Books. Sie unterstützt auch verkürzte Autorennamen wie „Wengro“ und zeigt Treffer mit Titel, Autoren, Cover und Jahr.

Ein Treffer wird **erst nach Tippen auf das konkrete Ergebnis** und anschließendem Bestätigen übernommen. Fehlende Metadaten werden ergänzt; vorhandene Bewertungen, Lesestatus, Fortschritte, Notizen und Zitate bleiben erhalten. Für die Übernahme eines korrigierten Titels oder der gesamten Autorenliste gibt es eine separate, zunächst nicht aktivierte Checkbox.

## Update von V0.7.3

Auf GitHub im Stammverzeichnis diese fünf Dateien ersetzen: `app.js`, `metadata.js`, `styles.css`, `index.html`, `sw.js`. Andere Dateien nicht löschen. GitHub-Pages-Veröffentlichung abwarten. Die Service-Worker-Version ist auf `bookfolio-v074` gesetzt; HTML wird nach dem Update bevorzugt frisch vom Server geladen.

## Daten & Sicherheit

Keine Supabase-Migration erforderlich. Es werden keine bestehenden persönlichen Datensätze automatisch geändert. Die Katalogabfragen übertragen den Suchbegriff an Open Library und Google Books. Die ZIP-Datei enthält keine privaten Bücher, Zitate oder Anmeldedaten; der vorhandene Publishable Key in `config.js` bleibt unverändert.

## Tests

JavaScript-Syntax und mockbasierte Suchtests für verkürzte Nachnamen, zwei Autoren, Covervarianten und das Erhalten persönlicher Buchdaten bestanden. Ein Browser-Klicktest auf einer realen iPhone-PWA steht noch aus.
