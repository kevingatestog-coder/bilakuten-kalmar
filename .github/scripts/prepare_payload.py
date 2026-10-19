"""Build only the website and audited backend files; never publish runtime data."""
import argparse
from pathlib import Path
import shutil

PRIVATE_FILES = {'.htaccess', 'app.php', 'install.php', 'maintenance.php', 'password-hash.php', 'schema.sql'}
INSTALLER_FILES = {'install.php', 'setup.html', 'assets/js/setup.js', 'assets/css/setup.css'}
PUBLIC_EXTENSIONS = {'.html', '.php', '.css', '.js', '.jpg', '.jpeg', '.webp', '.png', '.svg', '.ico', '.txt', '.woff', '.woff2'}


def validate_public(path):
    if any(part.startswith('.') for part in path.parts) and path.as_posix() not in {'.htaccess', '.user.ini'}:
        raise ValueError(f'Hidden file is not a public asset: {path}')
    if path.name in {'config.php', 'installed.lock', 'INSTALLATIONSNYCKEL.txt'} or path.suffix in {'.sqlite', '.sql', '.log', '.pem', '.key', '.zip'}:
        raise ValueError(f'Private file in public directory: {path}')
    if path.suffix not in PUBLIC_EXTENSIONS and path.as_posix() not in {'.htaccess', '.user.ini'}:
        raise ValueError(f'Unexpected public file type: {path}')


def prepare(source, destination):
    source, destination = Path(source).resolve(), Path(destination).resolve()
    if destination == source or source in destination.parents:
        raise ValueError('Put the deployment payload outside the source repository.')
    if destination.exists() and any(destination.iterdir()):
        raise ValueError('Deployment payload destination must be empty.')
    if (source / 'public_html').is_symlink() or (source / 'bilakuten-private').is_symlink():
        raise ValueError('Deployment source directories cannot be symlinks.')
    planned = []
    for path in (source / 'public_html').rglob('*'):
        if path.is_symlink():
            raise ValueError(f'Symlinks cannot be deployed: {path.relative_to(source)}')
        if not path.is_file():
            continue
        relative = path.relative_to(source / 'public_html')
        validate_public(relative)
        if relative.as_posix() not in INSTALLER_FILES:
            planned.append((path, Path('public_html') / relative))
    for name in sorted(PRIVATE_FILES):
        path = source / 'bilakuten-private' / name
        if path.is_symlink():
            raise ValueError(f'Symlinks cannot be deployed: {name}')
        if path.is_file():
            planned.append((path, Path('bilakuten-private') / name))
    required = {'public_html/index.html', 'public_html/.htaccess', 'public_html/api/index.php', 'bilakuten-private/app.php'}
    if not required.issubset({relative.as_posix() for _, relative in planned}):
        raise ValueError('The website or PHP API is incomplete; refusing deployment.')
    for path, relative in planned:
        output = destination / relative
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(path, output)
    return len(planned)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    count = prepare(Path(__file__).resolve().parents[2], args.destination)
    print(f'Validated deployment payload: {count} files, no runtime configuration or installation key.')
