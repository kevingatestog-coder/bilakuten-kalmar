# Automatisk publicering till Simply

När anslutningen är gjord publicerar varje push till `main` sajtens filer automatiskt. Du kan också välja **Actions → Publicera till Simply → Run workflow → main**. PR:er kontrollerar bara filerna och ansluter inte till servern.

## Koppla ihop en gång på din dator

1. Dubbelklicka på **Anslut-GitHub-till-Simply.cmd** i den lokala `github-simply`-mappen. Python, OpenSSH och GitHub CLI finns på datorn där projektet byggdes. Om GitHub CLI saknar inloggning behöver du först köra `gh auth login` själv.
2. Ange SSH/FTP-användarnamnet från Simply. Standardmappen är `/var/www/bilverkstadikalmar.se`, alltså mappen som innehåller både `public_html` och `bilakuten-private`.
3. Programmet skapar en separat SSH-nyckel. Kopiera den **publika** raden som visas och lägg in den under **Webbplats → SSH-åtkomst** i Simply. Tryck sedan Enter i programmet.
4. Programmet testar anslutningen och lägger in två GitHub Secrets utan att visa den privata nyckeln. Därefter kan du starta första publiceringen direkt i programmet.

Den privata nyckeln ligger bara i din användarmapps `.ssh/bilakuten_github_actions_ed25519` och krypterat som GitHub Secret. Den ska inte klistras in i chatten eller läggas i repot. Inga Simply-lösenord eller databaslösenord behövs för publiceringen.

## Om du föredrar GitHubs gränssnitt

Öppna https://github.com/kevingatestog-coder/bilakuten-kalmar/settings/secrets/actions och skapa:

| Secret | Innehåll |
| --- | --- |
| `SIMPLY_SSH_USER` | SSH/FTP-användarnamnet från Simply. |
| `SIMPLY_SSH_PRIVATE_KEY` | Hela en separat OpenSSH-privatnyckel utan lösenfras, inklusive BEGIN/END-raderna. Lägg motsvarande publika nyckel i Simply. |

Om servermappen avviker, lägg till repository-variabeln `SIMPLY_DEPLOY_PATH` under fliken **Variables**. Ange den absoluta föräldramappen, aldrig själva `public_html`.

## Vad publiceringen gör

- Kontrollerar filerna innan någon uppladdning sker.
- Kräver att serverns `public_html`, `bilakuten-private` och privata `config.php` redan finns.
- Skickar först bilder, CSS och JavaScript, sedan backend och sidor via SSH/rsync.
- Ersätter ändrade filer utan att radera filer eller mappar på servern.
- Bevarar `config.php`, `installed.lock`, `.install.lock`, temporära konfigurationer och installationsnyckeln. Den publika installationsguiden laddas inte upp igen om du har tagit bort den.
- Kör inga SQL-kommandon, installationer eller databasändringar. Schemamigreringar kräver separat hantering.

Saknas GitHub Secrets visar körningen **Publicering väntar på anslutning**, och inga serverfiler ändras. En grön sådan körning betyder att kontrollerna passerat, inte att sajten har publicerats. Efter anslutning står det **Publicerat till Simply** i körningens sammanfattning.

## Serveridentitet och fel

Servern är `ssh.simply.com`, port 22. Värdnyckeln i `.github/simply_known_hosts` verifierades den 19 oktober 2026 mot Simplys publika SSHFP-post (Ed25519 SHA-256: `3e19b7f10bf0c0f4b30f716ec0ae4758901f9cc657374fc9d8652e0fb1f96225`). SSH kräver att nyckeln matchar. Vid legitim nyckelrotation behöver den uppdateras efter ny verifiering.

Om anslutningskontrollen misslyckas laddas inget upp. Kontrollera användarnamn, nyckel, servermapp, rsync och befintlig `config.php`. Kör inte om den ursprungliga Git-importen och radera inte sajtens mappar.

För att återpublicera en tidigare version: öppna dess lyckade publiceringskörning i Actions och välj **Re-run all jobs**. Det återpublicerar den körningens kod, medan databas och konfiguration behålls.

## Källor

- [Simply: SSH-åtkomst](https://www.simply.com/en/support/faq/php/349-connect-with-ssh/)
- [Simply: serverns mappstruktur](https://www.simply.com/en/support/faq/php/18-paths-and-folders/)
- [Simply: GitHub Actions](https://www.simply.com/se/support/faq/ftp/856-upload-med-github-actions/)
- [GitHub: repository secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
