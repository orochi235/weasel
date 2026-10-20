import type { StanceProps } from '@weasel-js/ui/stance';
import { createContext } from 'react';

/** One library of a project: the story files under `path` carry `label`. */
export interface Library {
  /** A stretch of path every story file of the library has, with forward slashes: `/packages/ui/`. */
  path: string;
  label: string;
  /** The tone of the library's badge, as a `<Badge>` takes one. Default: the badge's own muted tone. */
  tone?: StanceProps['tone'];
}

/** A project's libraries, as the tree's package filter, the index page header, and Get Info ask about them. */
export interface Libraries {
  /** The label of the first library whose `path` the story's file holds, else its title's first segment. */
  of(entry: { file: string; title: string }): string;
  toneOf(label: string): StanceProps['tone'];
}

export function librariesFrom(table: readonly Library[] = []): Libraries {
  return {
    of(entry) {
      const file = entry.file.replaceAll('\\', '/');
      return table.find((library) => file.includes(library.path))?.label ?? entry.title.split('/')[0] ?? entry.title;
    },
    toneOf: (label) => table.find((library) => library.label === label)?.tone,
  };
}

/** No table: every story's library is its title's first segment. */
export const TITLE_LIBRARIES = librariesFrom();

/** The workshop's libraries, from `ShellConfig.libraries`. */
export const LibrariesContext = createContext<Libraries>(TITLE_LIBRARIES);
