import { Code } from '@weasel-js/ui/components/Code';
import s from '../RegistryInspector.module.css';
import type { CallbackRef, CallbackSource } from '../registryEntries';

/** Renders a list of source-linked callbacks as `vscode://file/...` anchors.
 *  Quiet (renders nothing) when the list is empty — the dev-only Vite
 *  plugin populates these; prod builds and untouched files leave them
 *  blank. */
export function CallbackList({ callbacks }: { callbacks: readonly CallbackRef[] }) {
  if (callbacks.length === 0) return null;
  return (
    <ul className={s.callbackList}>
      {callbacks.map((cb) => (
        <li key={`${cb.label}@${sourceKey(cb.source)}`}>
          <Code>{cb.label}</Code>
          <a
            className={s.callbackLink}
            href={`vscode://file/${cb.source.file}:${cb.source.line}:${cb.source.col + 1}`}
          >
            {relSourcePath(cb.source)}:{cb.source.line}
          </a>
        </li>
      ))}
    </ul>
  );
}

declare const __WEASEL_REPO_ROOT__: string | undefined;

export const WEASEL_REPO_ROOT: string | undefined =
  typeof __WEASEL_REPO_ROOT__ === 'string' ? __WEASEL_REPO_ROOT__ : undefined;

/** Stable identity for a tagged source location — used to tell which
 *  callbacks a route table already cites. */
export function sourceKey(source: CallbackSource): string {
  return `${source.file}:${source.line}:${source.col}`;
}

/** Repo-relative form of a tagged source path, when the repo root is known
 *  (Vite `define`; absent in test environments). */
export function relSourcePath(source: CallbackSource): string {
  const root = WEASEL_REPO_ROOT;
  return root && source.file.startsWith(root + '/')
    ? source.file.slice(root.length + 1)
    : source.file;
}

/** Inline source-link cell for the Tool routes DataGrid's `source` column.
 *  Renders a `vscode://file/...` anchor at the handler's source location.
 *  Shows only `basename:line` — the full repo-relative path goes in the
 *  tooltip, since a column of identical directory prefixes crowds out the
 *  route fields that actually vary row to row. */
export function SourceRefLink({ source }: { source: CallbackSource }) {
  const rel = relSourcePath(source);
  const base = rel.slice(rel.lastIndexOf('/') + 1);
  return (
    <a
      className={s.callbackLink}
      href={`vscode://file/${source.file}:${source.line}:${source.col + 1}`}
      title={`${rel}:${source.line}`}
    >
      {base}:{source.line}
    </a>
  );
}

/** Render a `findSourceMatch` result as a `vscode://file/...` link with
 *  `path:line` text. Falls back to plain text when the repo root isn't
 *  defined (e.g. test environments without Vite `define`). */
export function SourceLink({ match }: { match: { path: string; line: number } }) {
  const root = WEASEL_REPO_ROOT;
  if (!root) return <code>{match.path}:{match.line}</code>;
  const abs = `${root}${match.path}`;
  return (
    <a className={s.callbackLink} href={`vscode://file/${abs}:${match.line}:1`}>
      {match.path}:{match.line}
    </a>
  );
}
