import { type ReactElement } from 'react';
import {
  Button as RACButton,
  DialogTrigger,
} from 'react-aria-components';
import { INHERIT, usePaintKind, type Inherit, type Paint, type PaintKind } from '@weasel-js/core';
import type { PaintInherit } from '../PaintInput';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { paintPreviewCss } from '@weasel-js/paint';
import { PaintEditorPopover } from './PaintEditorPopover';
import { ownPaint } from '../PaintInput/PaintInput';
import { MIXED_HINT } from '../Field/mixedHint';
import s from './PaintField.module.css';
import type { HoldProps } from '../Disabled';
import { useRacHold } from '../Disabled/racHold';

/** Props for {@link PaintField}. `onInput` fires throughout a gesture inside
 *  the popover and `onChange` once at its end. */
export interface PaintFieldProps extends OverlayPortalProps, HoldProps {
  /** The paint being edited. `null` is an explicit "no paint"; `undefined` is
   *  no value to show; `'inherit'` takes the enclosing container's. */
  value: Paint | Inherit | null | undefined;
  /** Present, "Inherit" is offered; its `paint` is the swatch an inheriting
   *  field shows. */
  inherit?: PaintInherit;
  /** Indeterminate presentation: the trigger says "Mixed" and the editor
   *  lights no kind. */
  mixed?: boolean;
  /** Dim the trigger — a value is in effect but was never chosen. */
  unset?: boolean;
  /** Restrict the editor's kind bar. Default: every registered kind. */
  kinds?: readonly PaintKind[];
  /** Offer "None" in the editor. Default `true`. */
  allowNone?: boolean;
  onInput?: (next: Paint | null) => void;
  /** Once per gesture. Return the paint actually applied when it differs, and a
   *  solid's recent color records that paint's color instead. */
  onChange: (next: Paint | null) => Paint | null | void;
  /** Names the paint this field edits — `Fill`, `Color`. */
  'aria-label'?: string;
  className?: string;
}

/** What the trigger says it is holding. */
function kindLabel(paint: Paint | Inherit | null | undefined, mixed: boolean, label: string | undefined): string {
  if (mixed) return MIXED_HINT;
  if (paint === INHERIT) return 'Inherit';
  if (paint === null) return 'None';
  if (paint === undefined) return '—';
  return label ?? (paint.kind ?? 'solid');
}

/**
 * A whole `Paint` in one control slot: a swatch that says which kind it
 * holds, and a popover holding {@link PaintInput}.
 *
 * `PaintInput` itself is a kind bar over a body — six segments and a stop
 * editor — which a property row's control column cannot hold. This is the
 * shape for a narrow slot, and the difference that matters is fidelity: a
 * `ColorField` in that slot reads a gradient's first stop and writes a solid
 * back, so touching the control loses the paint.
 */
export function PaintField(props: PaintFieldProps): ReactElement {
  const {
    value, mixed = false, unset = false, kinds, allowNone = true,
    onInput, onChange, className, portalContainer,
  } = props;
  const ariaLabel = props['aria-label'];
  // Disabled or read-only, the trigger shows the paint and opens nothing.
  const hold = useRacHold(props);
  const held = hold.access.state !== 'enabled';
  const { anchor, provide, ready } = useOverlayPortal(portalContainer);
  const shown = value === INHERIT ? props.inherit?.paint : value;
  const preview = mixed ? undefined : paintPreviewCss(shown);
  const label = usePaintKind(ownPaint(value)?.kind)?.label;

  return hold.wrap(
    <DialogTrigger {...(held ? { isOpen: false } : {})}>
      {anchor}
      <RACButton
        className={[s.trigger, className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
        isDisabled={hold.rac.isDisabled}
        aria-describedby={hold.rac['aria-describedby']}
        {...(hold.access.state === 'disabled' && hold.access.reachable ? { 'data-held': 'disabled' } : {})}
        {...(unset ? { 'data-unset': '' } : {})}
        {...(mixed ? { 'data-mixed': '' } : {})}
      >
        <span
          className={s.swatch}
          aria-hidden="true"
          {...(preview ? { style: { background: preview } } : { 'data-empty': '' })}
        />
        <span className={s.label}>{kindLabel(value, mixed, label)}</span>
      </RACButton>
      {ready && provide(
        <PaintEditorPopover
          value={value}
          mixed={mixed}
          unset={unset}
          kinds={kinds}
          allowNone={allowNone}
          inherit={props.inherit}
          onInput={onInput}
          onChange={onChange}
          aria-label={ariaLabel}
        />,
      )}
    </DialogTrigger>,
  );
}
