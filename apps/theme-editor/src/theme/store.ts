import type { Selection, ThemeDefinition } from '@weasel-js/theme';
import type { Issue } from '@weasel-js/theme/engine';

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
