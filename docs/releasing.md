# Releasing

The maintainer runbook for publishing to npm. Every package versions in
lockstep (the `fixed` group in `.changeset/config.json`), so a release moves
them all to the same number whether or not they changed.

## The normal path

1. **Write a changeset with the change.** `npx changeset`, pick the packages,
   pick the level semver gives the change (`patch` for a fix, `minor` for new
   API, `major` for a breaking change), and write it as "Writing a changeset"
   below says. The level a changeset names does not decide the release's.
   `npm run check:changesets` holds every pending one to those rules.
2. **Pick the highlights.** `npm run release:pick` lists the pending changesets
   by rank. Choose the few a reader of this release should see first; it writes
   `pick` into their markers. See "Picking highlights".
3. **Version on `main`.** `npm run version-packages -- --bump <level>` bumps
   every manifest to the next `patch`, `minor` or `major` version (`patch`
   without the flag), consumes the changesets and rewrites the `CHANGELOG.md`s.
   Each entry stays under its own changeset's level in the `CHANGELOG.md`s;
   only the version number follows `--bump`. It refuses while
   no pending changeset is picked (`-- --no-picks` overrides). Read the
   changelog diff, commit it as `chore: version packages`, and push.
4. **Dispatch the release.** `gh workflow run release.yml -R orochi235/weasel`.
   With no changesets left, the workflow publishes to npm, pushes the
   `@weasel-js/<pkg>@<version>` tags, writes the GitHub releases and checks the
   registry. Nothing else starts it, so it never queues behind another run.

Versioning moved off the workflow on 2026-11-08: it used to open a
"chore: version packages" PR, and every changeset push started a run to refresh it.

## Writing a changeset

A changeset is read by someone deciding whether to upgrade, on the site's
Releases page and in each package's `CHANGELOG.md`. Its first sentence is the
entry's title; everything after it folds away until clicked.

- **One change per changeset.** Three fixes found in one pass are three
  changesets. A title that lists things ("Fixes to the hand tool, the pencil
  and the trim tool") is three entries forced into one, and the check refuses
  one that opens "Fixes to" or strings three things together after "Fix".
- **The title says what a consumer sees change**, in their words, under 140
  characters: "The pencil draws a stroke that starts over a shape", not "Fix
  the pencil binding's hit gate". Name the API only when the API is the change.
- **Leave out how it used to fail.** "Before, …" belongs in the commit
  message. A fix needs one sentence of what now happens, and a second only when
  a reader has to do something; the check caps a fix at 700 characters.
- **A body is for code a reader writes differently**: a new option and its
  default, a migration, a before/after snippet. A `breaking` entry must have
  one.

The body ends with an entry marker naming what kind of change it is:

```md
<!-- entry: rank=10 new api -->
```

| Tag | The change… |
|---|---|
| `breaking` | makes consumer code or saved data have to change |
| `deprecates` | marks something deprecated; it still works |
| `api` | adds public surface: an export, a prop, an option, an action id |
| `new` | adds a capability a user can see, with or without new API |
| `behavior` | makes existing code act differently with no code change, on purpose and not as a fix |
| `data` | changes serialized output or how saved documents load |
| `visual` | changes rendered pixels |
| `perf` | makes something measurably faster or leaner |
| `fix` | corrects a defect |
| `internal` | does nothing a consumer can observe (and takes no other tag) |

Give every tag that holds: a fix that moves pixels is `fix visual`. The page
lists an entry under the first of Breaking, New, Changed, Performance, Fixes and
Internal that its tags reach, and folds Fixes and Internal away.

`rank=N` is a suggestion of how far up its release the entry sorts, read like a
z-index: unset is 0, higher sorts first, negative sinks. Rough anchors: 0 for an
ordinary change, 10 for one a reader of the release should notice, 20 or more
for one that could headline it, below 0 for one nobody would miss. Ranks from different
authors are not comparable and do not need to be; the release pick settles what
leads. The tags and the parser are in `scripts/release/entry-marker.ts`.

## Picking highlights

`npm run release:pick` prints the pending changesets, highest rank first, each
with its number, tags and title, and asks which to pick (`3 7 12`, or a blank
line to keep the current picks). It writes `pick` into the chosen markers and
takes it out of the rest. `--list` only prints, and `--set 3,7,12` picks
without asking. Pick what a reader would want to
know about this release if they read nothing else: usually two to four, rarely
a fix.

The Releases page shows a release's picks above its groups. A release with no
picks shows its three highest-ranked entries there instead, marked as not
curated. Entries published before markers existed take their tags and rank from
`scripts/release/history-meta.json`, keyed by changeset hash; none of them is
picked.

## Authentication

Publishing uses **OIDC trusted publishing**. There is no npm token anywhere —
not in the workflow, not in repository secrets. The release job mints a
short-lived credential from its `id-token: write` permission, valid only for
that run and unusable outside it. Publishing this way also attaches provenance
attestations, so each tarball is traceable to the workflow run and commit that
built it.

**Never add `NPM_TOKEN` or `NODE_AUTH_TOKEN` to the release job.** npm
prefers a token whenever it finds one, so a stray token variable silently
downgrades the run to the classic path — which fails, and reports it as
`E404` or `ENEEDAUTH`, errors that read like a missing package rather than an
auth misconfiguration.

### Setting up a new package

Trust config is held per package, with no org-wide setting, and OIDC cannot create a
package, so a new publishable workspace is published once by hand and then registered.
Both commands name the package, and both run in a real terminal:

```sh
npm run build -w @weasel-js/<pkg>
npm publish -w @weasel-js/<pkg> --tag pre --provenance=false
node scripts/setup-trusted-publishing.mjs <pkg>
```

`--provenance=false` has to be the flag: the manifest's `publishConfig.provenance` outranks
`NPM_CONFIG_PROVENANCE` for a plain `npm publish`. The setup script records the package in
`scripts/trust-pending.json`; commit that with the package. A package that already has the
config answers `409 Conflict`; the script then asks npm what the package has, and counts it
as registered when that names this repository and workflow.

Without a name the script registers every package, one `npm trust` call each:

```sh
node scripts/setup-trusted-publishing.mjs --dry-run   # preview
node scripts/setup-trusted-publishing.mjs             # configure all packages
node scripts/setup-trusted-publishing.mjs --list      # verify
```

The first call prompts for 2FA. **Tick "skip 2FA for the next 5 minutes"** on the
npm page it opens — that is what lets the rest run unattended;
without it every package challenges you again. If the window lapses partway,
re-run with `--otp=<code>` to finish the tail. Re-running is always safe.

Needs npm >= 11.10.0 for `npm trust`. When the local npm does not understand the
`--allow-publish` permission flag, the script runs `npx npm@latest` instead.

`npm run check:first-publish` runs before the release job publishes anything,
and fails on a package that is not on npm or that no trusted publisher has ever
published. It cannot read trust config itself (only a maintainer's token can),
so registering a package records it in `scripts/trust-pending.json`, and the
gate lets it through until the release job publishes it. Commit that file after
registering.

## Publishing by hand

Only when CI is unavailable. Manual publishes produce **no provenance
attestation**, so prefer fixing CI.

```sh
npm login
npm run build            # required — VERSION is baked into the bundle at build
                         # time, so stale dist/ ships the wrong version string
npm run check:manifests
NPM_CONFIG_PROVENANCE=false npx changeset publish --otp=<6-digit code>
git push --follow-tags   # changeset publish creates tags locally; it does not push
```

`NPM_CONFIG_PROVENANCE=false` is what makes the manual path work at all: the
manifests set `publishConfig.provenance: true`, and npm can only generate an
attestation from a supported CI runner — asking for one from a laptop is an
error, not a silent skip.

`changeset publish` skips versions already on the registry, so if the OTP
expires partway through, run it again.

## Gates

`npm run prepublishOnly` is the full gate — typecheck, the whole test suite,
build, manifest check, consumer smoke test. It runs only when typed: the root
package is private, so npm never fires it as a lifecycle hook, and the release
workflow does not call it. The release workflow builds, then runs `check:imports`,
`check:lockstep` and `check:first-publish` before it publishes. It
does not run the manifest check, which fails on any `exports`/`types` path
promising a file `npm pack` would not include: CI and `test:fleet:postbuild` run
it on the commit before it merges.

## Checking a publish

**Don't trust what a publish says it did.** `changeset publish` has twice
listed a package under "Successfully published" that never reached npm, with no
error anywhere in the log. `npm run check:published` asks the registry whether
every workspace's current version is really there, and `npm run
test:smoke:registry` installs the whole set into an empty tree to catch the
consumer-facing half — one missing sibling breaks `npm i @weasel-js/core` while
seventeen versions are perfectly present. Both run in the release workflow after
the publish; run either by hand to answer "did the last release land?".
Within an hour of a publish a missing version may only be staged — npm has hidden
a fresh upload for 55 minutes, and republishing it fails with E409 — so check with
`npm run check:published -- --wait` before re-dispatching anything.
`@weasel-js/hud` is held longest: it became visible last in 1.14.0, 1.16.0 and
1.16.1 (17, 19 and 57 minutes after the first package), and in 1.16.1 it uploaded
at 16:23 and listed at 17:15. It is the only package whose JavaScript inlines a
base64 PNG (its default font atlas, ~196 KB of `createLoupe-*.js`); that npm's
scan is slower for it is a guess nobody has tested.
