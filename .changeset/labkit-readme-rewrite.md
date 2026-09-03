---
'@weasel-js/labkit': patch
---

Rewrite labkit's public documentation. Docs only — no code changes.

The README is the landing page of the published docs site, and it described a
package that no longer exists: v0.x, the lab/trial/instrument runtime "arriving
in later plans", and an Installation section telling readers to clone two repos
side by side and depend on `file:../labkit`. labkit is on the public registry
and is a workspace package in this monorepo, so both halves sent an adopter
somewhere that could not work.

It now installs from npm, states the React 19 peer dependency, and covers the
surfaces it never mentioned: the capability list an instrument declares from,
annotations, chrome regions and undocking, the `f(...)` config schema, and all
fifteen subpath exports. The Usage example uses `<Lab>` rather than a shell
around bare `<div>`s, and the Development section lists the scripts the package
actually has — `npm run storybook` was not one of them.

Four dead documentation links pointed at `orochi235.github.io/labkit/` and at a
standalone `orochi235/labkit` repo. The docs site is under
`orochi235.github.io/weasel/labkit/`, Storybook under
`orochi235.github.io/weasel/docs/ui/storybook/`, and the design spec is in this
repo.

RECIPES gains annotations coverage — declaring targets, reading the store,
export, and keeping marks in your own storage — plus chrome contributions and
panel undocking. AGENTS gains source maps for both, and its stale rows are
fixed: it named seven files that had moved or been deleted, and told readers
design tokens are `--lk-*` when no such property is ever declared.
