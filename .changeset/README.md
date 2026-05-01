# Changesets

This folder is used by [changesets](https://github.com/changesets/changesets) to track package versioning.

To add a changeset: `npx changeset`. The CLI prompts for bump kind and a summary; the result lands as a Markdown file in this folder. On merge to `main`, the release workflow opens (or fast-forwards) a "Version Packages" PR.
