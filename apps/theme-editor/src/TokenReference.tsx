import { themeTokenOf, type ThemePrefsReference } from '@weasel-js/theme/prefs';
import { Badge } from '@weasel-js/ui/components/Badge';
import { Button } from '@weasel-js/ui/components/Button';
import { PrefControl, type PrefRenderContext, type PrefRenderer } from '@weasel-js/ui/components/Prefs';
import { useState } from 'react';
import styles from './ThemePrefs.module.css';

/**
 * A `string` leaf's control that shows a value referring to another custom property as that property's name: a
 * link to the row of the token it names, or a plain chip for a property the theme does not set. Any other value,
 * or one asked to be edited, is the form's own text field.
 */
export function tokenReferenceRenderer(
  refer: (css: unknown) => ThemePrefsReference | undefined,
  onOpen: (path: string) => void,
): PrefRenderer {
  const render = (ctx: PrefRenderContext) => <TokenReference ctx={ctx} refer={refer} onOpen={onOpen} />;
  // A link and a button, so the row is a group and each names itself.
  return Object.assign(render, { group: true });
}

function TokenReference({ ctx, refer, onOpen }: {
  ctx: PrefRenderContext;
  refer: (css: unknown) => ThemePrefsReference | undefined;
  onOpen: (path: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const ref = ctx.mixed ? undefined : refer(ctx.value);
  if (ref === undefined || editing) {
    return <PrefControl pref={ctx.pref} path={ctx.path} value={ctx.value} values={ctx.values} onChange={ctx.setValue} disabled={ctx.disabled} />;
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
      <Button size="sm" variant="ghost" disabled={ctx.disabled} ariaLabel={`Edit ${ctx.pref.name} as text`} onClick={() => setEditing(true)}>
        Edit
      </Button>
    </span>
  );
}
