import type { PrefKind } from '@weasel-js/prefs';
import { Badge, type BadgeSize } from '../Badge';
import s from './PrefKindBadge.module.css';

const KIND_CLASS: Record<PrefKind, string | undefined> = {
  number: s.number,
  boolean: s.boolean,
  string: s.string,
  enum: s.enum,
  color: s.color,
  paint: s.paint,
  object: s.object,
  list: s.list,
  map: s.map,
  union: s.union,
  field: s.field,
  action: s.action,
};

/** Props for {@link PrefKindBadge}. */
export interface PrefKindBadgeProps {
  /** A leaf's `kind`. A custom kind, or any other word such as `group`, is drawn muted. */
  kind: string;
  size?: BadgeSize;
  className?: string;
}

/** A pref leaf's kind as a badge, each built-in kind in its own color. */
export function PrefKindBadge({ kind, size = 'xs', className }: PrefKindBadgeProps) {
  const own = Object.hasOwn(KIND_CLASS, kind) ? KIND_CLASS[kind as PrefKind] : undefined;
  return own === undefined ? (
    <Badge size={size} status="muted" variant="outline" className={className}>{kind}</Badge>
  ) : (
    <Badge size={size} status="custom" variant="subtle" className={[s.kind, own, className].filter(Boolean).join(' ')}>
      {kind}
    </Badge>
  );
}
