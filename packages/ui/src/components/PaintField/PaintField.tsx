import { type ReactElement } from 'react';
import {
  Button as RACButton,
  Dialog as RACDialog,
  DialogTrigger,
  Popover as RACPopover,
} from 'react-aria-components';
import { getPaintKind, type FillStyle, type PaintKind } from '@weasel-js/core';
import { useOverlayPortal, type OverlayPortalProps } from '../../overlays/portalHost';
import { paintPreviewCss } from '../../paintPreview';
import { PaintInput } from '../PaintInput';
import s from './PaintField.module.css';

/** Props for {@link PaintField}. `onInput` fires throughout a gesture inside
 *  the popover and `onChange` once at its end. */
export interface PaintFieldProps extends OverlayPortalProps {
  /** The paint being edited. `null` is an explicit "no paint"; `undefined` is
   *  no value to show. */
  value: FillStyle | null | undefined;
  /** Indeterminate presentation: the trigger says "Mixed" and the editor
   *  lights no kind. */
  mixed?: boolean;
  /** Dim the trigger — a value is in effect but was never chosen. */
  unset?: boolean;
  /** Restrict the editor's kind bar. Default: every registered kind. */
  kinds?: readonly PaintKind[];
  /** Offer "None" in the editor. Default `true`. */
  allowNone?: boolean;
  onInput?: (next: FillStyle | null) => void;
  onChange: (next: FillStyle | null) => void;
  /** Names the paint this field edits — `Fill`, `Color`. */
  'aria-label'?: string;
  className?: string;
}

/** What the trigger says it is holding. */
function kindLabel(paint: FillStyle | null | undefined, mixed: boolean): string {
  if (mixed) return 'Mixed';
  if (paint === null) return 'None';
  if (paint === undefined) return '—';
  return getPaintKind(paint.fill ?? 'solid')?.label ?? (paint.fill ?? 'solid');
}

/**
 * A whole `FillStyle` in one control slot: a swatch that says which kind it
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
  const { anchor, portalProps } = useOverlayPortal(portalContainer);
  const preview = mixed ? undefined : paintPreviewCss(value);

  return (
    <DialogTrigger>
      {anchor}
      <RACButton
        className={[s.trigger, className].filter(Boolean).join(' ')}
        aria-label={ariaLabel}
        {...(unset ? { 'data-unset': '' } : {})}
        {...(mixed ? { 'data-mixed': '' } : {})}
      >
        <span
          className={s.swatch}
          aria-hidden="true"
          {...(preview ? { style: { background: preview } } : { 'data-empty': '' })}
        />
        <span className={s.label}>{kindLabel(value, mixed)}</span>
      </RACButton>
      {/* `data-weasel-overlay`: see Select — the popover renders in a portal,
          outside the subtree the trigger sits in. */}
      <RACPopover className={s.popover} data-weasel-overlay="" {...portalProps}>
        <RACDialog className={s.body} aria-label={ariaLabel ? `${ariaLabel} editor` : 'Paint editor'}>
          <PaintInput
            value={value}
            mixed={mixed}
            unset={unset}
            kinds={kinds}
            allowNone={allowNone}
            onInput={onInput}
            onChange={onChange}
            aria-label={ariaLabel}
          />
        </RACDialog>
      </RACPopover>
    </DialogTrigger>
  );
}
