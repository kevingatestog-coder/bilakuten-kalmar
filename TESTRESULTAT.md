# Testresultat för Simply-paketet

Kontrollerat lokalt den 19 oktober 2026 med PHP 8.4.26 och MariaDB 11.4.13. **21 testgrupper passerade, inga misslyckades.** PHP-enhetstesterna innehåller 27 kontroller.

## Automatiska kontroller

- Syntax för samtliga PHP-filer samt validering av fält, datum, svenska öppettider, sommar-/vintertid, HTTPS och ursprung.
- Oinstallerad server avvisar bokningar. Installation kräver den privata engångsnyckeln, skapar tabeller, hashar administratörslösenordet och sparar inställningar utanför webbplatsens publika mapp.
- Installationen låses efter lyckad uppsättning. Hälsokontrollen verifierar databasens schemaversion.
- Kunduppgifter kräver administratörsinloggning. Skrivningar från andra webbplatser avvisas.
- Bokningen valideras och sparas i databasen innan kvitto visas. Identiska återförsök återanvänder bokningsnumret; ändrade återförsök avvisas.
- Fyra samtidiga databasanslutningar som skickar samma förfrågan skapar exakt en bokning.
- Administratörsinloggning, skyddad sessionscookie, svenska tecken, statusändringar, ogiltiga statusvärden och radering fungerar. Interna identifierare visas inte i kundlistan.
- Utloggning återkallar sessionen. Ändrat lösenord ogiltigförklarar befintliga sessioner.
- Anropsbegränsningen lagras i databasen och kan inte kringgås med påhittade vidarebefordringshuvuden.
- Webbplatsen använder WebP och versionsmärkta tillgångar. Privat konfiguration ligger utanför den publika roten.

## Webbläsarkontroll

En uttryckligen märkt lokal testförfrågan skickades via hemsidans bokningsformulär mot PHP/MySQL-backenden. Ett bokningsnummer visades efter lagring. Förfrågan syntes i administrationen och kunde markeras som bekräftad. Utloggning kontrollerades. Inga verkliga kunduppgifter användes och inga meddelanden skickades.

Skärmbilder finns i projektets `docs/simply-bokning-test.jpg` och `docs/simply-admin-test.jpg`.

## Storlek och prestanda

25 fotografier konverteras till WebP i uppladdningspaketet. De refererade tillgångarna minskar från cirka 3,71 MB till 1,30 MB, ungefär 65 procent. ZIP-filen är cirka 1,35 MB. Statiska tillgångar har versionsmärkta adresser och lång cachetid. Faktisk laddningstid behöver mätas på den publicerade domänen.

## Återstående kontroll på Simply

Testmiljön använder PHP:s lokala webbserver och MariaDB. Den verifierar inte Apache eller ett verkligt Simply-konto. Efter uppladdning ska installationen därför sluttestas med kontots PHP-moduler, databasbehörigheter, Apache-regler, HTTPS och slutliga domän. Följ checklistan i installationsguiden. Webbplatsen är inte publicerad genom dessa tester.

Bokningen är en förfrågan om önskad tid som verkstaden bekräftar manuellt. Systemet har ingen kapacitetskalender och skickar inga automatiska mejl eller SMS.
