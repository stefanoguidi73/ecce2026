[README.md](https://github.com/user-attachments/files/30351323/README.md)
# ECCE 2026 — Programma (webapp)

Guida rapida per pubblicare la webapp del programma online, gratis.

## Cosa contiene questa cartella
- `index.html` — la pagina della webapp (dati del programma già inclusi)
- `app.js` — la logica (ricerca, sessioni espandibili)
- `manifest.json` — abilita "Aggiungi a Home" su smartphone
- `ecce-logo.png` — logo ufficiale della conferenza (in testata)
- `favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` — icone generate dal simbolo del logo, usate come favicon e come icona dell'app sulla home screen

Non serve altro: nessun database, nessun server da configurare, nessun account a pagamento.
**Importante:** tutti i file di questa cartella vanno caricati insieme, nella stessa posizione (stessa cartella) — la pagina li richiama per nome relativo.

## Pubblicazione in 2 minuti — Netlify Drop

1. Vai su **https://app.netlify.com/drop**
2. Trascina l'intera cartella (con dentro tutti i file sopra elencati) nel riquadro della pagina
3. Dopo qualche secondo Netlify genera un link pubblico tipo `https://nome-a-caso-1234.netlify.app`
4. Quel link è il programma online: condividilo nella mail ai partecipanti, sul sito della conferenza, o come QR code

**Non serve creare un account** per pubblicare così (anche se conviene farlo — gratis — se poi si vuole aggiornare il sito in un secondo momento invece di ricaricarlo da zero).

### Per aggiornare il programma in seguito
Se cambia qualcosa (orari, sessioni, paper), basta rigenerare `index.html` e ripetere il trascinamento nella stessa pagina di Netlify (se si è fatto il login, si può aggiornare lo stesso sito invece di crearne uno nuovo).

## Alternativa — GitHub Pages
Se preferite un repository versionato (utile se altri co-chair devono poter modificare):
1. Create un repository GitHub (anche gratuito e pubblico)
2. Caricate **tutti** i file di questa cartella nella root del repository (o nella stessa sottocartella)
3. Impostazioni del repository → **Pages** → Source: branch principale, cartella `/ (root)`
4. GitHub genera un link tipo `https://vostro-utente.github.io/nome-repo/`

## Per i partecipanti: "app" sullo smartphone
Una volta online, aprendo il link da telefono:
- **iPhone (Safari):** icona Condividi → "Aggiungi a Home" — comparirà l'icona con il simbolo ECCE
- **Android (Chrome):** menu ⋮ → "Aggiungi a schermata Home"

L'icona si comporta come un'app, senza passare da App Store o Google Play.

## Novità: "Il mio programma" e note personali
Ogni paper ha una stellina (☆/★) per salvarlo in una sezione dedicata "★ Mine", raggiungibile dalla barra in alto. Aprendo i dettagli di un paper c'è anche un campo per scrivere note personali (utile durante il talk stesso). Tutto viene salvato solo sul telefono di chi lo usa (tramite `localStorage` del browser) — non è condiviso con altri partecipanti, non richiede account, e resta anche chiudendo e riaprendo l'app. Se si cancella la cache del browser o si cambia dispositivo, questi dati si perdono (non essendoci un server che li conserva).

## Note aperte da verificare con l'organizzazione
Nel rivedere il programma con i dati ufficiali del sito ecce2026.unisi.it sono emerse un paio di incongruenze rispetto agli appunti interni, segnalate anche in chat:
- **Giorno 15**: i giorni della settimana corretti per settembre 2026 sono martedì 15, mercoledì 16, giovedì 17, venerdì 18 (non "wed 15" come indicato negli appunti) — l'app ora mostra le sigle corrette.
- **Luogo del workshop**: il sito ufficiale indica *Palazzo San Niccolò, Via Roma 56* per l'intera conferenza incluso il workshop, mentre gli appunti menzionavano "Santa Chiara Lab, via dei Servi". Nell'app ho usato l'indicazione del sito ufficiale — da confermare con l'organizzazione prima della pubblicazione definitiva.
- **Orario del workshop**: il sito ufficiale indica 14:30–17:30, la bozza originale del programma indicava 15:00–17:00. Nell'app ho usato l'orario del sito ufficiale.
