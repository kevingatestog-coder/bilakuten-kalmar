# Bilakuten i Kalmar — Simply Git-import

Hemsida och bokningssystem för Bilakuten i Kalmar AB. Detta är den färdiga PHP/MySQL-versionen för Simply. Node.js, npm och Composer behövs inte på webbhotellet. Ursprungligt utseende, WebP-logga, ringknappar och bokningsflöde är bevarade.

## Publicera uppdateringar automatiskt

GitHub Actions kan publicera nya pushar till `main` utan ny Git-import eller radering av servermapparna. Anslut Simply en gång enligt [GITHUB-ACTIONS.md](GITHUB-ACTIONS.md). Flödet bevarar privat konfiguration och installationslås och kör inga databasändringar. Innan SSH-anslutningen är konfigurerad kontrolleras bara publiceringsfilerna.

## Första importen från standardgrenen

Git-URL: `https://github.com/kevingatestog-coder/bilakuten-kalmar.git`

Standardgren: **main**. Repositoriet är offentligt eftersom Simplys Git-import kräver en offentlig HTTPS-adress. Det innehåller inga databasuppgifter, administratörslösenord, kunduppgifter eller läsbara installationsnycklar. Installationsfilen innehåller bara engångsnyckelns SHA-256-hash; själva nyckeln behålls lokalt av ägaren.

**Välj mappen som innehåller `public_html` som destination.** Simplys vanliga struktur är:

```text
/var/www/din-domän/
├── public_html/          ← den publika hemsidan
└── bilakuten-private/    ← PHP-kod och privat konfiguration
```

Om `/` i importverktyget motsvarar denna föräldramapp kan du använda `/`. Kontrollera genom att öppna den valda mappen i filhanteraren först: den ska redan innehålla `public_html`. Importen ska inte skapa `public_html/public_html`. Om importverktyget endast kommer åt den publika mappen behöver filerna placeras rätt med filhanteraren eller SFTP efter importen. `bilakuten-private` ska ligga utanför den publika webbplatsen.

Importera först när du har säkerhetskopierat en eventuell befintlig webbplats. Repositoriet innehåller ingen befintlig `config.php` och ingen kunddatabas. Bevara alltid dessa vid uppdateringar och använd inte ett importläge som raderar filer som saknas i Git.

## Aktivera databasen efter import

1. Välj PHP 8.3 eller 8.4 i Simplys kontrollpanel, med `pdo_mysql` och `mbstring`. Minsta PHP-version är 8.2.
2. Aktivera SSL och Force HTTPS. Välj slutlig huvudadress och omdirigera andra domänvarianter dit.
3. Öppna `https://din-domän/install.php`.
4. Hämta engångsnyckeln från **ägarens lokala `GITHUB-INSTALLATIONSNYCKEL.txt`** som sparades när Git-versionen förbereddes. Samma nyckel finns i den ursprungliga ZIP-filens `INSTALLATIONSNYCKEL.txt`. Nyckeln finns inte på GitHub och ska inte laddas upp eller skrivas i en issue.
5. Ange databasvärd, databasnamn, användare och lösenord från Simply. Välj ett administratörslösenord med minst 16 tecken.
6. Installationen skapar tabellerna, sparar konfigurationen utanför `public_html` och låser sig automatiskt.

Om tabellerna måste importeras manuellt finns SQL-filen i `bilakuten-private/schema.sql`. Inga befintliga tabeller raderas. Tabellprefixet `bk_` ska vara reserverat för denna webbplats.

Nyckeln i en äldre eller senare ZIP-version kan vara en annan. Använd den nyckel som hör till den publicerade versionen. Vid uppdateringar behålls befintlig privat `config.php` och `installed.lock`; då behövs ingen ny installation eller nyckel.

## Sluttest på webbhotellet

- Öppna `/api/health`: svaret ska vara `{"status":"ok"}`.
- Skicka en tydligt märkt testförfrågan via `/boka-tid`.
- Logga in på `/admin`, kontrollera uppgifterna, ändra status och ladda om.
- Radera testförfrågan och logga ut. Kontrollera även bokningen och ringknapparna från mobilen.

Den lokala PHP/MariaDB-versionen har klarat 21 testgrupper och bokning/administration har provats i webbläsare. Simplys faktiska domän, SSL, Apache-regler, filrättigheter och databas behöver sluttestas efter importen. Se `TESTRESULTAT.md`.

## Offerter och kvitton

Efter inloggning finns fliken **Offerter & kvitton**. Välj dokumenttyp, fyll i kund och rader och använd **Spara PDF** eller **Skriv ut**. För kvitton anges betalningsdatum, betalsätt och eventuell betalningsreferens. Bekräfta att hela beloppet är mottaget innan kvittot skapas. Formuläret hanterar inga betalningar. Dokumenten sparas på datorn som PDF; utkast lagras inte på servern och rensas vid utloggning.

## Drift

Bokningen är en förfrågan om önskad tid som verkstaden bekräftar manuellt. Inga lyftar eller mekaniker reserveras automatiskt. Inga automatiska mejl eller SMS skickas.

Säkerhetskopiera databasen och privata `config.php`. Gallra ärenden som inte längre behövs. Efter lyckad installation kan `public_html/install.php`, `public_html/setup.html` samt `assets/js/setup.js` och `assets/css/setup.css` tas bort; installationen är redan låst.

Använd GitHub Actions för senare filuppdateringar när anslutningen är klar. Git-importen aktiverar inte automatisk publicering i sig. Radera inte serverns mappar vid uppdateringar; privat konfiguration och kunddatabas ska behållas.

Sidorna har rena adresser, till exempel `/kontakt`, `/boka-tid` och `/admin`. `/index.html` omdirigeras till `/`, och gamla `.html`-länkar går automatiskt till motsvarande rena adress med bibehållna frågeparametrar. Uppdatera även `public_html/.htaccess` vid importen; filnamnen på servern ska fortfarande sluta på `.html`.

## Företag

Bilakuten i Kalmar AB · 559214-6178 · Franska vägen 20, 393 56 Kalmar · 076-240 77 63. Måndag–fredag 09–18, lördag 11–17, söndag stängt.

[Simplys mappstruktur](https://www.simply.com/en/support/faq/php/18-paths-and-folders/) · [PHP-inställningar](https://www.simply.com/en/support/faq/php/) · [MySQL](https://www.simply.com/se/support/faq/mysql/)
