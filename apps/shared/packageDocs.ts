/**
 * What the site's package pages are made of, apart from the API reference
 * (`./reference.ts`). Produced at build time by the `package-docs` vite plugin
 * (`scripts/vite-package-docs.ts`) from each published package's manifest, its
 * README, the Markdown under its `docs/guides/`, and the demos' imports.
 */
import type { MarkdownBlock } from './markdown';

/** What the nav and a package's header need; small, and loaded with the shell. */
export interface PackageInfo {
  /** Unscoped name, which is also its directory under `packages/` and its address. */
  name: string;
  /** `@weasel-js/geom`. */
  specifier: string;
  version: string;
  description: string;
  /** Every specifier a consumer may import from it, the root first. */
  entries: string[];
  /** The other weasel packages it depends on or peers with, unscoped. */
  uses: string[];
  /** Its guides, in the order their files sort. */
  guides: { slug: string; title: string }[];
  /** Repo-relative paths of the demos whose source imports it. */
  demos: string[];
}

/** A package's prose, loaded when its page opens. */
export interface PackageDoc {
  /** The README, less its title. */
  readme: MarkdownBlock[];
  /** Each guide's body by slug, less its title. */
  guides: Record<string, MarkdownBlock[]>;
}

export type PackageEntry = PackageInfo & { load: () => Promise<PackageDoc> };
