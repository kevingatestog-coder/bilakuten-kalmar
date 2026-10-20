import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('prepare_payload', Path(__file__).resolve().parents[1] / 'scripts/prepare_payload.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
setup_spec = importlib.util.spec_from_file_location('configure_simply', Path(__file__).resolve().parents[1] / 'scripts/configure_simply.py')
setup_module = importlib.util.module_from_spec(setup_spec)
setup_spec.loader.exec_module(setup_module)


class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.source, self.destination = self.root / 'repo', self.root / 'payload'
        for name in ['public_html/index.html', 'public_html/.htaccess', 'public_html/api/index.php', 'public_html/assets/css/site.css', 'bilakuten-private/app.php']:
            self.write(name)

    def write(self, name, content='test'):
        path = self.source / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)
        return path

    def test_runtime_configuration_and_installers_are_not_published(self):
        for name in ['bilakuten-private/config.php', 'bilakuten-private/installed.lock', 'bilakuten-private/.install.lock', 'bilakuten-private/.config-backup', 'bilakuten-private/install-key.php', 'public_html/install.php', 'public_html/setup.html', 'public_html/assets/js/setup.js', 'public_html/assets/css/setup.css']:
            self.write(name, 'never publish this')
        module.prepare(self.source, self.destination)
        files = {p.relative_to(self.destination).as_posix() for p in self.destination.rglob('*') if p.is_file()}
        self.assertEqual(files, {'public_html/index.html', 'public_html/.htaccess', 'public_html/api/index.php', 'public_html/assets/css/site.css', 'bilakuten-private/app.php'})

    def test_private_file_in_public_root_aborts_before_copying(self):
        self.write('public_html/config.php', 'secret')
        with self.assertRaises(ValueError):
            module.prepare(self.source, self.destination)
        self.assertFalse(self.destination.exists())

    def test_nested_environment_file_is_rejected(self):
        self.write('public_html/assets/.env', 'secret')
        with self.assertRaises(ValueError):
            module.prepare(self.source, self.destination)

    def test_incomplete_website_is_rejected(self):
        (self.source / 'public_html/api/index.php').unlink()
        with self.assertRaises(ValueError):
            module.prepare(self.source, self.destination)

    def test_destination_cannot_overwrite_repository_or_existing_files(self):
        for destination in [self.source, self.source / 'output']:
            with self.assertRaises(ValueError):
                module.prepare(self.source, destination)
        self.destination.mkdir()
        (self.destination / 'config.php').write_text('keep')
        with self.assertRaises(ValueError):
            module.prepare(self.source, self.destination)
        self.assertEqual((self.destination / 'config.php').read_text(), 'keep')

    def test_setup_rejects_wrong_directory_and_shell_metacharacters(self):
        setup_module.validate_settings('bilverkstadikalmar.se','/var/www/bilverkstadikalmar.se')
        for username, root in [('user;command','/var/www/domain'),('user','/'),('user','/var/www/domain/public_html'),('user','/var/www/domain/../other'),('user','/var/www/domain;command')]:
            with self.assertRaises(ValueError):
                setup_module.validate_settings(username,root)


@unittest.skipUnless(os.name == 'posix' and shutil.which('rsync'), 'Runs on the Ubuntu Actions runner with real rsync')
class RemoteDeploymentTest(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.remote = self.root / 'remote'
        self.payload = self.root / 'payload'
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.repository = Path(__file__).resolve().parents[2]
        for directory in ['public_html/assets', 'bilakuten-private']:
            (self.remote / directory).mkdir(parents=True)
            (self.payload / directory).mkdir(parents=True)
        (self.remote / 'public_html/keep.txt').write_text('server-only file')
        (self.remote / 'bilakuten-private/config.php').write_text('existing database connection')
        (self.remote / 'bilakuten-private/installed.lock').write_text('keep locked')
        (self.payload / 'bilakuten-private/config.php').write_text('must not replace configuration')
        (self.payload / 'bilakuten-private/installed.lock').write_text('must not replace lock')
        (self.payload / 'bilakuten-private/app.php').write_text('new backend')
        (self.payload / 'public_html/index.html').write_text('new page')
        (self.payload / 'public_html/assets/site.css').write_text('new asset')
        ssh = self.bin / 'ssh'
        ssh.write_text('''#!/usr/bin/env python3
import os,shlex,subprocess,sys
args=sys.argv[1:]
known_hosts=next(arg.split('=',1)[1] for arg in args if arg.startswith('UserKnownHostsFile='))
paths=shlex.split(known_hosts)
if len(paths)!=1 or not os.path.isfile(paths[0]):
    sys.exit('Known hosts filename was split on spaces')
index=next(i for i,a in enumerate(args) if a in {'test@ssh.simply.com','ssh.simply.com'})
remote=args[index+1:]
remote=[a.replace('/var/www/bilverkstadikalmar.se',os.environ['MOCK_REMOTE']) for a in remote]
if len(remote)==1:
    sys.exit(subprocess.call(['bash','-c',remote[0]]))
sys.exit(subprocess.call(remote))
''')
        ssh.chmod(0o755)
        keygen = self.bin / 'ssh-keygen'
        keygen.write_text('#!/bin/sh\nexit 0\n')
        keygen.chmod(0o755)
        # Keep the real rsync file/exclusion behavior; replace only its transport.
        rsync = self.bin / 'rsync'
        rsync.write_text('''#!/usr/bin/env python3
import os,subprocess,sys
args=[]
iterator=iter(sys.argv[1:])
for arg in iterator:
    if arg=='-e':
        next(iterator)
    elif arg.startswith('test@ssh.simply.com:'):
        args.append(arg.split(':',1)[1].replace('/var/www/bilverkstadikalmar.se',os.environ['MOCK_REMOTE']))
    else:
        args.append(arg)
sys.exit(subprocess.call([os.environ['REAL_RSYNC'],*args]))
''')
        rsync.chmod(0o755)
        self.environment = {**os.environ, 'PATH':str(self.bin)+os.pathsep+os.environ['PATH'], 'RUNNER_TEMP':str(self.root), 'SIMPLY_SSH_USER':'test', 'SIMPLY_SSH_PRIVATE_KEY':'dummy for isolated SSH mock', 'SIMPLY_DEPLOY_PATH':'/var/www/bilverkstadikalmar.se', 'MOCK_REMOTE':str(self.remote), 'REAL_RSYNC':shutil.which('rsync')}
        runner_temp = self.root / 'runner with spaces'
        runner_temp.mkdir()
        self.environment['RUNNER_TEMP'] = str(runner_temp)
        self.environment['GITHUB_STEP_SUMMARY'] = str(self.root / 'test-summary.md')

    def deploy(self):
        return subprocess.run(['bash','.github/scripts/deploy-simply.sh',str(self.payload)],cwd=self.repository,env=self.environment,text=True,capture_output=True)

    def test_real_rsync_updates_code_but_preserves_runtime_and_server_only_files(self):
        result = self.deploy()
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
        self.assertEqual((self.remote/'public_html/index.html').read_text(),'new page')
        self.assertEqual((self.remote/'public_html/assets/site.css').read_text(),'new asset')
        self.assertEqual((self.remote/'bilakuten-private/app.php').read_text(),'new backend')
        self.assertEqual((self.remote/'bilakuten-private/config.php').read_text(),'existing database connection')
        self.assertEqual((self.remote/'bilakuten-private/installed.lock').read_text(),'keep locked')
        self.assertEqual((self.remote/'public_html/keep.txt').read_text(),'server-only file')

    def test_missing_config_prevents_every_upload(self):
        (self.remote/'bilakuten-private/config.php').unlink()
        result = self.deploy()
        self.assertNotEqual(result.returncode,0)
        self.assertIn('No files were uploaded',result.stdout)
        self.assertFalse((self.remote/'public_html/index.html').exists())
        self.assertFalse((self.remote/'bilakuten-private/app.php').exists())

    def test_wrong_target_directory_prevents_every_upload(self):
        self.environment['SIMPLY_DEPLOY_PATH']='/var/www/bilverkstadikalmar.se/public_html'
        result = self.deploy()
        self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.remote/'public_html/index.html').exists())


if __name__ == '__main__':
    unittest.main()
