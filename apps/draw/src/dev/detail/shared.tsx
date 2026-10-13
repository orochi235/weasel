import { Badge, Button, Code, type BadgeProps } from '@weasel-js/ui';
import { Fragment } from 'react';
import s from '../RegistryInspector.module.css';
import { BUNDLE_BADGE_PROPS, KIND_BADGE_PROPS } from '../badgeTokens';
import type { ActionEntry, ToolEntry, TreeCategoryNode, TreeEntry } from '../registryEntries';

/** Minimal inline-markdown renderer — splits on backtick-delimited code
 *  spans and wraps each in <code>. No other markdown features. Used by every
 *  panel that renders prose strings (descriptions, JSDoc blocks, schema
 *  notes), so backticks read as code tokens instead of literal characters. */
export function InlineMarkdown({ text }: { text: string }) {
  const segments = text.split(/(`[^`]+`)/g);
  return (
    <>
      {segments.map((seg, i) => (
        seg.startsWith('`') && seg.endsWith('`')
          ? <Code key={i}>{seg.slice(1, -1)}</Code>
          : <Fragment key={i}>{seg}</Fragment>
      ))}
    </>
  );
}

export function KindBadge({ label }: { label: string }) {
  return <Badge {...(KIND_BADGE_PROPS as BadgeProps)}>{label}</Badge>;
}

export function BundleBadge({ id, label }: { id: string; label?: string }) {
  const props = (BUNDLE_BADGE_PROPS as Record<string, Omit<BadgeProps, 'children'>>)[id];
  if (!props) return <Code>{label ?? id}</Code>;
  return <Badge {...(props as BadgeProps)}>{label ?? id}</Badge>;
}

/** Navigate to any entry in the inspector. The resolver in `RegistryInspector`
 *  walks every category node to find a `kind+id` match — so a `<Tool>` can
 *  link back to its `<Bundle>` rows, a `<Bundle>` can link to `<Tool>` rows,
 *  etc. */
export type NavTarget = { kind: TreeEntry['kind']; id: string };

export interface Props {
  entry: TreeEntry;
  /** Live tool snapshot — used by `BundleDetail` so member rows can show
   *  each tool's hook name, switch-shortcut, and presentation group. */
  tools: readonly ToolEntry[];
  /** Live action snapshot — used by `GroupDetail` to enumerate the members
   *  of an action-group bucket. */
  actions: readonly ActionEntry[];
  /** Tree category the entry sits in. Used to render breadcrumbs above
   *  the detail heading. Optional — omit to suppress the breadcrumb. */
  category?: TreeCategoryNode | null;
  onNavigate(target: NavTarget): void;
}

/** Renders an entry id as a button that navigates to that entry on click.
 *  When `label` differs from `id`, the button label uses `label` — leaves
 *  the visual the same as inline text but with cursor / underline styling. */
export function EntryLink({
  kind, id, label, onNavigate,
}: {
  kind: TreeEntry['kind'];
  id: string;
  label?: string;
  onNavigate: (t: NavTarget) => void;
}) {
  return (
    <Button variant="link" onClick={() => onNavigate({ kind, id })}>
      {label ?? id}
    </Button>
  );
}

/** JSDoc excerpt block. Runs the text through `InlineMarkdown` so backtick
 *  spans render as code tokens rather than literal backticks. */
export function Jsdoc({ text }: { text: string }) {
  return <pre className={s.jsdoc}><InlineMarkdown text={text} /></pre>;
}

/** A grid cell with genuinely no value — an em-dash in muted type rather
 *  than blank space, so "this route has no modifiers" reads differently from
 *  "the inspector failed to fill this in". `title` explains *why* on hover. */
export function Absent({ title }: { title?: string }) {
  return <span className={s.absentCell} title={title}>—</span>;
}

/** Route fields whose `*` means "any" rather than a literal token. Rendered
 *  as the word so a column of asterisks doesn't read as missing data. */
export function Wildcardable({ value }: { value: string }) {
  if (value !== '*') return <>{value}</>;
  return <span className={s.wildcardCell} title="matches any value">any</span>;
}
