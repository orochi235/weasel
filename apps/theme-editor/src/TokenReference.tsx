import { themeTokenOf, type ThemePrefsReference } from '@weasel-js/theme/prefs';
import { Badge } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { PrefControl, type LeafContext, type LeafRenderer } from '@weasel-js/ui/components/Prefs';
import { useEffect, useRef, useState } from 'react';
import styles from './ThemePrefs.module.css';

/**
 * A `string` leaf's control that shows a value referring to another custom property as that property's name: a
 * link to the row of the token it names, or a plain chip for a property the theme does not set. Any other value,
 * or one asked to be edited, is the form's own text field until focus leaves it or the value changes elsewhere.
 */
export function tokenReferenceRenderer(
  refer: (css: unknown) => ThemePrefsReference | undefined,
  onOpen: (path: string) => void,
): LeafRenderer {
  const render = (ctx: LeafContext) => <TokenReference ctx={ctx} refer={refer} onOpen={onOpen} />;
  // A link and a button, so the row is a group and each names itself.
  return Object.assign(render, { group: true });
}

function TokenReference({ ctx, refer, onOpen }: {
  ctx: LeafContext;
  refer: (css: unknown) => ThemePrefsReference | undefined;
  onOpen: (path: string) => void;
}) {
  // The value the text field last showed: an edit holds while the leaf still holds it, so an undo or any other write
  // shows the reference again.
  const [editing, setEditing] = useState<{ readonly value: unknown } | null>(null);
  const field = useRef<HTMLSpanElement>(null);
  const open = editing !== null && Object.is(editing.value, ctx.value);
  useEffect(() => {
    if (open) field.current?.querySelector<HTMLElement>('input, textarea')?.focus();
  }, [open]);
  const ref = ctx.mixed ? undefined : refer(ctx.value);
  if (ref === undefined || open) {
    const control = (
      <PrefControl
        pref={ctx.pref}
        path={ctx.path}
        value={ctx.value}
        values={ctx.values}
        onChange={(value) => {
          if (open) setEditing({ value });
          ctx.setValue(value);
        }}
        disabled={ctx.disabled}
      />
    );
    if (!open) return control;
    return (
      <span
        ref={field}
        className={styles.referenceField}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(null);
        }}
      >
        {control}
      </span>
    );
  }
  const { path } = ref;
  return (
    <span className={styles.reference}>
      {path === undefined ? (
        <Badge size="sm" variant="outline" tooltip={`${ref.property}: set by the component, not by the theme`}>
          {ref.property}
        </Badge>
      ) : (
        <Badge size="sm" variant="outline" onClick={() => onOpen(path)} aria-label={`${ctx.pref.name}: the token ${themeTokenOf(path)}`}>
          {themeTokenOf(path)}
        </Badge>
      )}
      <Button size="sm" variant="ghost" disabled={ctx.disabled} aria-label={`Edit ${ctx.pref.name} as text`} onClick={() => setEditing({ value: ctx.value })}>
        Edit
      </Button>
    </span>
  );
}
