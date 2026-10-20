"""Connect GitHub Actions locally without displaying or sharing the private SSH key."""
from pathlib import Path
import re
import shutil
import subprocess
import sys

REPOSITORY = 'kevingatestog-coder/bilakuten-kalmar'
DEFAULT_ROOT = '/var/www/bilverkstadikalmar.se'


def validate_settings(username, root):
    if not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]*', username):
        raise ValueError('Ange SSH/FTP-användarnamnet från Simply.')
    if not re.fullmatch(r'/var/www/[A-Za-z0-9_.-]+(?:/[A-Za-z0-9_.-]+)*', root) or any(part in {'.', '..'} for part in root.split('/')) or root.endswith(('/public_html', '/bilakuten-private')):
        raise ValueError('Sökvägen ska vara mappen ovanför public_html, exempelvis '+DEFAULT_ROOT)


def main():
    for executable in ['ssh', 'ssh-keygen', 'gh']:
        if not shutil.which(executable):
            raise RuntimeError(f'{executable} saknas. Installera OpenSSH och GitHub CLI först.')
    subprocess.run(['gh', 'auth', 'status'], check=True)
    username = input('SSH/FTP-användarnamn från Simply: ').strip()
    root = input(f'Servermapp [{DEFAULT_ROOT}]: ').strip().rstrip('/') or DEFAULT_ROOT
    validate_settings(username, root)
    directory = Path.home() / '.ssh'
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    key = directory / 'bilakuten_github_actions_ed25519'
    if not key.exists():
        subprocess.run(['ssh-keygen', '-q', '-t', 'ed25519', '-N', '', '-C', 'github-actions-bilakuten', '-f', str(key)], check=True)
    public = subprocess.check_output(['ssh-keygen', '-y', '-P', '', '-f', str(key)])
    key.with_suffix('.pub').write_bytes(public)
    print('\nKlistra in följande PUBLIKA nyckel i Simply → Webbplats → SSH-åtkomst:\n')
    print(public.decode().strip())
    print('\nDen privata nyckeln visas aldrig och sparas utanför projektet i .ssh.')
    input('När den publika nyckeln är sparad hos Simply, tryck Enter här: ')
    known_hosts = Path(__file__).resolve().parents[1] / 'simply_known_hosts'
    # OpenSSH parses -o values again; quote a filename containing spaces inside
    # the option, even though subprocess already preserves the outer argument.
    known_hosts_setting = 'UserKnownHostsFile="'+known_hosts.as_posix()+'"'
    options = ['-i', str(key), '-o', 'BatchMode=yes', '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'HostKeyAlgorithms=ssh-ed25519', '-o', known_hosts_setting, '-o', 'ConnectTimeout=20']
    command = f"set -eu; command -v rsync >/dev/null; test -d '{root}/public_html'; test -d '{root}/bilakuten-private'; test -r '{root}/bilakuten-private/config.php'"
    subprocess.run(['ssh', *options, username+'@ssh.simply.com', command], check=True)
    print('\nSSH-anslutning och befintlig konfiguration är kontrollerade.')
    for name, value in [('SIMPLY_SSH_USER', username.encode()), ('SIMPLY_SSH_PRIVATE_KEY', key.read_bytes())]:
        subprocess.run(['gh', 'secret', 'set', name, '--repo', REPOSITORY], input=value, check=True)
    subprocess.run(['gh', 'variable', 'set', 'SIMPLY_DEPLOY_PATH', '--repo', REPOSITORY, '--body', root], check=True)
    print('GitHub Secrets är sparade. Lösenord och databasuppgifter har inte skickats.')
    if input('Publicera den senaste main-versionen nu? [J/n]: ').strip().lower() in {'', 'j', 'ja', 'y', 'yes'}:
        subprocess.run(['gh', 'workflow', 'run', 'deploy-simply.yml', '--repo', REPOSITORY, '--ref', 'main'], check=True)
        print('Publiceringen har startats: https://github.com/'+REPOSITORY+'/actions')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, RuntimeError, subprocess.CalledProcessError) as error:
        print('\nAnslutningen kunde inte slutföras:', error, file=sys.stderr)
        print('Kontrollera uppgifterna. Inga privata nycklar behöver delas i chatten.', file=sys.stderr)
        sys.exit(1)
    except (EOFError, KeyboardInterrupt):
        print('\nAvbrutet. Serverns filer har inte raderats.', file=sys.stderr)
        sys.exit(1)
