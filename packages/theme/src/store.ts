import type { Selection } from './axes';
import type { ThemeDefinition } from './definition';
import type { Issue } from './engine/types';

/** A theme definition file as a theme store serves it: the dev-server endpoint at `__theme/<name>`. */
export interface StoredTheme {
  readonly name: string;
  /** sha-256 of the file's bytes: what a save sends back to prove it saw the file as it is. */
  readonly hash: string;
  /** Saving it regenerates `packages/theme/src/generated/`. */
  readonly emits: boolean;
  readonly definition: ThemeDefinition;
}

export interface IssueReport {
  readonly selection: Selection;
  readonly issue: Issue;
}

export type PutResult =
  | {
      readonly status: 'saved';
      readonly hash: string;
      readonly issues: readonly IssueReport[];
      readonly regenerated: boolean;
      /** Why the generated files were left alone, when the definition emits and they were. */
      readonly problems: readonly string[];
    }
  | { readonly status: 'conflict'; readonly hash: string | null }
  | { readonly status: 'invalid'; readonly message: string };

/** Record order is emission order, so keys are never sorted. */
export const serializeDefinition = (definition: ThemeDefinition): string => `${JSON.stringify(definition, null, 2)}\n`;

export interface ThemeApi {
  list(): Promise<StoredTheme[]>;
  get(name: string): Promise<StoredTheme>;
  put(name: string, definition: ThemeDefinition, baseHash: string | null): Promise<PutResult>;
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

/** The dev server's theme store, addressed relative to the page so the app's base path carries over. */
export function httpThemeApi(base: string = document.baseURI, fetchImpl: Fetch = (input, init) => fetch(input, init)): ThemeApi {
  const url = (path: string) => new URL(`__theme/${path}`, base).toString();
  const read = async <T>(response: Response): Promise<T> => {
    if (!response.ok && response.status !== 409 && response.status !== 400) throw new Error(`${response.status} ${response.statusText}`);
    return (await response.json()) as T;
  };
  return {
    list: async () => (await read<{ themes: StoredTheme[] }>(await fetchImpl(url('list'), undefined))).themes,
    get: async (name) => read<StoredTheme>(await fetchImpl(url(name), undefined)),
    put: async (name, definition, baseHash) =>
      read<PutResult>(
        await fetchImpl(url(name), {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition, hash: baseHash }),
        }),
      ),
  };
}
