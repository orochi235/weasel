# Releasing

All thirteen workspaces version in lockstep (the `fixed` group in
`.changeset/config.json`), so a release moves every package to the same number
whether or not it changed.

## The normal path

1. **Write a changeset with the change.** `npx changeset` — pick the packages,
   pick a bump, write the prose. The prose is the changelog; it is read by
   people deciding whether to upgrade, so describe what changed and why it
   mattered, not which files moved.
2. **Push to `main`.** The Release workflow opens (or updates) a
   **"chore: version packages"** PR. That PR is what `changeset version`
   produces: bumped manifests, consumed changesets, rewritten `CHANGELOG.md`s.
3. **Review and merge that PR.** Merging it publishes to npm and pushes the
   `@weasel-js/<pkg>@<version>` tags.

Step 3 is the release. Nothing publishes until the version PR merges.

> **Do not run `changeset version` locally and push it.** That is a second,
> conflicting flow: it makes the version bump directly on `main`, so the action
> finds nothing to version and jumps straight to publishing. It works, but it
> skips the review checkpoint on the changelog and leaves the git tags unpushed
> (the action pushes them; a local run does not). Pick the PR flow.

## Authentication

Publishing uses **OIDC trusted publishing**. There is no npm token anywhere —
not in the workflow, not in repository secrets. The release job mints a
short-lived credential from its `id-token: write` permission, valid only for
that run and unusable outside it. Publishing this way also attaches provenance
attestations automatically, so each tarball is cryptographically traceable to
the workflow run and commit that built it.

This replaced token auth for a reason worth remembering: npm permanently revoked
all classic tokens on 2025-12-09, and granular tokens are now capped at 90 days.
Any token-based release is a treadmill that breaks on a schedule.

**Never add `NPM_TOKEN` or `NODE_AUTH_TOKEN` back to the release job.** npm
prefers a token whenever it finds one, so a stray token variable silently
downgrades the run to the classic path — which now fails, and reports it as
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
npm page it opens — that is what lets the remaining eleven run unattended;
without it every package challenges you again. If the window lapses partway,
re-run with `--otp=<code>` to finish the tail. Re-running is always safe.

Needs npm >= 11.10.0 for `npm trust`. The `--allow-publish` permission flag came
later, with staged publishing — the script probes for it and passes it only when
the local CLI understands it, so an older npm gets the registry default
(publish-only) rather than an "unknown flag" error. Upgrading npm is worth doing
anyway if you want the permission stated explicitly rather than defaulted.

A package must already exist on npm before it can be given a trusted publisher,
so the very first publish of a brand-new package still has to be done by hand
from a logged-in machine.

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
expires partway through the thirteen packages, just run it again.

## Gates

`npm run prepublishOnly` is the full gate — typecheck, the whole test suite,
build, manifest check, consumer smoke test. CI runs the build and manifest check
on every release. The manifest check is the one that specifically guards tarball
contents: it fails the release if any `exports`/`types` path promises a file that
`npm pack` would not include.

## Notes

- `weasel-js` (the unscoped alias) is `private: true` on purpose — npm rejects
  the name as too similar to an existing package. It still builds and versions
  with everything else; it just never publishes. See `docs/TODO.md`.
- The Release workflow's push trigger is path-filtered to `.changeset/*.md`, so
  a fix touching only a manifest cannot retrigger a publish. `workflow_dispatch`
  is the escape hatch.
