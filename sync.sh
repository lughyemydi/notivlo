#!/usr/bin/env bash
#
# Sync the web app from the source tree (../folio) into this deploy repo's
# app/ folder, applying the SAME trim as the Xcode "Trim bundled web app"
# build phase in /Users/Home/folio-app/project.yml — which is the authoritative
# list. Keep the two in step: a pattern added there belongs here too.
#
# This exists so the app is never hand-copied. Copying only the files you think
# changed is how beta 3 shipped a Notebook.dc.html that asked for a session.js
# that was never deployed (a 404 on every notebook open, live for a day), and a
# blanket `cp -R` is how a _backup-*/ folder, a *-test.js or the whole supabase/
# function tree could slip into a public, world-readable GitHub Pages site.
#
# Usage:
#   ./sync.sh              # sync ../folio -> ./app
#   ./sync.sh --dry-run    # show exactly what would change, touch nothing
#   FOLIO=/path ./sync.sh  # sync from a different source tree
#
# It only ever touches app/. The landing page (index.html, demo.html, shots/,
# favicons at the repo root) is maintained by hand and is left alone.

set -euo pipefail

# Resolve paths relative to this script, so it works from any cwd.
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
src="${FOLIO:-$here/../folio}"
dest="$here/app"

# Scalar, not an array: macOS ships bash 3.2, where expanding an empty array
# under `set -u` is itself an "unbound variable" error. ${dry:+$dry} expands
# to nothing when empty and to a single word (no spaces) otherwise.
dry=""
is_dry=0
if [ "${1:-}" = "--dry-run" ] || [ "${1:-}" = "-n" ]; then
  dry="--dry-run"
  is_dry=1
  echo "DRY RUN — nothing will be written."
fi

if [ ! -d "$src" ]; then
  echo "error: source tree not found: $src" >&2
  echo "       set FOLIO=/path/to/folio or place this repo beside folio/." >&2
  exit 1
fi
mkdir -p "$dest"

# Excludes mirror project.yml's trim phase, pattern for pattern:
#   _backup-*        working backups of the tree
#   prototype-*      design prototypes (no page loads them)
#   supabase         the whole backend: edge functions (which reference
#                    secrets via Deno.env), migrations and tests. Matches the
#                    folder exactly, NOT the shipped supabase-*.js client files.
#   design-system    the style guide, for working on the app, not running it
#                    (_ds is a different folder and IS loaded, so it stays)
#   .claude          editor/agent config
#   *-test.js /      tests sit beside the code they cover, at the root and in a
#   *-test.html /    module's tests/ folder — matched, not listed, so a new
#   tests            module's tests are trimmed without editing this file
#   *.md             notes for whoever works on the code (PROVIDER.md, READMEs);
#                    the app never reads one
#   .DS_Store        Finder litter, in every subfolder
#
# Two excludes beyond that list are web-deploy-only: .gitignore and .git are
# source-control config, not app code. The Xcode phase omits them because they
# do no harm inside a Mac bundle, but there is no reason to publish them to a
# world-readable site, and app/ has never carried them.
#
# --delete removes files in app/ that no longer exist in folio/ (the stale
# session.js problem). rsync protects excluded names from --delete, so a .md
# or test that is somehow already in app/ is reported, not silently kept —
# run with --dry-run first if app/ has drifted.
rsync -a --delete ${dry:+$dry} --itemize-changes \
  --exclude='_backup-*' \
  --exclude='prototype-*' \
  --exclude='supabase' \
  --exclude='design-system' \
  --exclude='.claude' \
  --exclude='.DS_Store' \
  --exclude='*-test.js' \
  --exclude='*-test.html' \
  --exclude='tests' \
  --exclude='*.md' \
  --exclude='.gitignore' \
  --exclude='.git' \
  "$src"/ "$dest"/

echo
if [ "$is_dry" = 1 ]; then
  echo "Dry run complete. Re-run without --dry-run to apply, then:"
else
  echo "Synced $src -> $dest. Now:"
fi
echo "  git -C \"$here\" add -A app && git -C \"$here\" status"
echo "  # review the diff, bump APP_VERSION if needed, then commit and push."
