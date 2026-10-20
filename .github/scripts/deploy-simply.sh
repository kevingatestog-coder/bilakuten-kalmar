#!/usr/bin/env bash
set -euo pipefail

payload="${1:?Missing validated deployment payload}"
root="${SIMPLY_DEPLOY_PATH%/}"
if [[ ! "$SIMPLY_SSH_USER" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*$ ]]; then
  echo '::error::SIMPLY_SSH_USER must be the SSH/FTP username from Simply.'
  exit 1
fi
if [[ ! "$root" =~ ^/var/www/[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)*$ || "$root" == */../* || "$root" == */.. || "$root" == */./* || "$root" == */. || "$root" == */public_html || "$root" == */bilakuten-private ]]; then
  echo '::error::SIMPLY_DEPLOY_PATH must be the absolute parent of public_html, for example /var/www/bilverkstadikalmar.se.'
  exit 1
fi
test -f "$payload/public_html/index.html"
test -f "$payload/bilakuten-private/app.php"

umask 077
ssh_dir="$(mktemp -d "${RUNNER_TEMP:-/tmp}/simply-ssh.XXXXXX")"
trap 'rm -f "$ssh_dir/key" "$ssh_dir/known_hosts"; rmdir "$ssh_dir"' EXIT
printf '%s\n' "$SIMPLY_SSH_PRIVATE_KEY" | tr -d '\r' > "$ssh_dir/key"
cp .github/simply_known_hosts "$ssh_dir/known_hosts"
unset SIMPLY_SSH_PRIVATE_KEY
ssh-keygen -y -P '' -f "$ssh_dir/key" > /dev/null
ssh-keygen -F ssh.simply.com -f "$ssh_dir/known_hosts" > /dev/null
ssh_args=(-i "$ssh_dir/key" -o BatchMode=yes -o IdentitiesOnly=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=\"$ssh_dir/known_hosts\"" -o HostKeyAlgorithms=ssh-ed25519 -o ConnectTimeout=20)
remote="$SIMPLY_SSH_USER@ssh.simply.com"

# Nothing is uploaded until both the intended folders and active config exist.
ssh "${ssh_args[@]}" "$remote" "set -eu; command -v rsync >/dev/null; test -d '$root/public_html'; test ! -L '$root/public_html'; test -d '$root/bilakuten-private'; test ! -L '$root/bilakuten-private'; test -r '$root/bilakuten-private/config.php'" || {
  echo '::error::SSH preflight failed. Check the username, SSH key, deployment path, rsync availability and existing private config.php. No files were uploaded.'
  exit 1
}

printf -v ssh_transport '%q ' ssh "${ssh_args[@]}"
rsync_args=(-rz --delay-updates --omit-dir-times --no-perms --no-owner --no-group --protect-args -e "$ssh_transport")
# Upload assets first; then backend and pages. There is deliberately no deletion.
if [[ -d "$payload/public_html/assets" ]]; then
  rsync "${rsync_args[@]}" "$payload/public_html/assets/" "$remote:$root/public_html/assets/"
fi
rsync "${rsync_args[@]}" \
  --exclude='/config.php' --exclude='/installed.lock' --exclude='/.install.lock' \
  --exclude='/.config-*' --exclude='/install-key.php' \
  "$payload/bilakuten-private/" "$remote:$root/bilakuten-private/"
rsync "${rsync_args[@]}" \
  --exclude='/assets/' --exclude='/config.php' --exclude='/.env*' \
  --exclude='/install.php' --exclude='/setup.html' \
  "$payload/public_html/" "$remote:$root/public_html/"

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  printf '### Publicerat till Simply\nCommit: `%s`\n\nWebbplatsens filer är uppdaterade. Privat konfiguration, installationslås och befintliga serverfiler har bevarats. Ingen databasändring har körts.\n\n[Öppna webbplatsen](https://www.bilverkstadikalmar.se/)\n' "${GITHUB_SHA:-local}" >> "$GITHUB_STEP_SUMMARY"
fi
