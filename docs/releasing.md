# Releasing

The maintainer runbook for publishing to npm. Every package versions in
lockstep (the `fixed` group in `.changeset/config.json`), so a release moves
them all to the same number whether or not they changed.

## The normal path

1. **Write a changeset with the change.** `npx changeset`: pick the packages,
   pick a bump, write the prose. The prose is the changelog; it is read by
   people deciding whether to upgrade, so describe what changed and why it
   mattered, not which files moved.
2. **Version on `main`.** `npm run version-packages` bumps every manifest,
   consumes the changesets and rewrites the `CHANGELOG.md`s. Read the changelog
   diff, commit it as `chore: version packages`, and push.
3. **Dispatch the release.** `gh workflow run release.yml -R orochi235/weasel`.
   With no changesets left, the workflow publishes to npm, pushes the
   `@weasel-js/<pkg>@<version>` tags, writes the GitHub releases and checks the
   registry. Nothing else starts it, so it never queues behind another run.

Versioning moved off the workflow on 2026-11-08: it used to open a
"chore: version packages" PR, and every changeset push started a run to refresh it.

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

Trust config is held per package, with no org-wide setting, so every new
publishable workspace needs registering once:

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

A package must already exist on npm before it can be given a trusted publisher,
so the very first publish of a brand-new package still has to be done by hand
from a logged-in machine.

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
`check:bumps`, `check:lockstep` and `check:first-publish` before it publishes. It
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

## Notes

- The Release workflow's push trigger is path-filtered to `.changeset/*.md`, so
  a fix touching only a manifest cannot retrigger a publish. `workflow_dispatch`
  is the escape hatch.
