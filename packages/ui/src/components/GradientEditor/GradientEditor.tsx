import { type ReactElement } from 'react';
import {
  isGradientPaint,
  switchGradientKind,
  useGradientKinds,
  usePaintKind,
  type ColorSpace,
  type Paint,
  type PaintKind,
} from '@weasel-js/core';
import { nativeSvgKind, nativeSvgSpace } from '@weasel-js/svg';
import { isMeshGradientPaint } from '@weasel-js/core/mesh';
import { MeshEditor } from '../MeshEditor';
import { ToggleBar, type ToggleBarItem } from '../ToggleBar';
import { GradientStops } from './GradientStops';
import s from './GradientEditor.module.css';

const SPACES: readonly ToggleBarItem<ColorSpace>[] = [
  { value: 'rgb', label: 'sRGB' },
  { value: 'oklab', label: 'OKLab' },
  { value: 'oklch', label: 'OKLCh' },
];

/**
 * Props for {@link GradientEditor}. `onInput` fires throughout a gesture and
 * `onChange` once at its end.
 */
export interface GradientEditorProps {
  /** The gradient being edited: a paint of any gradient kind — one that
   *  `listGradientKinds` returns. */
  value: Paint;
  /**
   * Live value during a gesture — a stop drag, a color-picker scrub. Wire
   * it for preview; it fires many times per gesture and must not be
   * written to history.
   */
  onInput?: (next: Paint) => void;
  /** Committed value: one call per completed gesture. Pair with an
   *  undoable write. */
  onChange: (next: Paint) => void;
  /** Show the kind switch — every registered gradient kind. Default true;
   *  turn it off when the surrounding UI already owns the kind. */
  kindSwitch?: boolean;
  /** Show the sRGB / OKLab / OKLCh switch, which writes `interpolate`.
   *  Default true. */
  spaceSwitch?: boolean;
  /**
   * Offer only what an SVG file carries natively: the linear and radial
   * gradients, which SVG has elements for, blended in sRGB, the only space
   * every SVG renderer honors. A conic or mesh gradient exports as a weasel
   * element that other renderers paint as one flat color, and an OKLab or
   * OKLCh blend exports as an attribute they ignore. A value already outside
   * that set keeps its own kind and space on offer, so it can be switched
   * back. Default false.
   */
  svg?: boolean;
  /**
   * Which stop the stop editor is on, as an index into `value.stops`. Omit it
   * and the editor keeps its own selection, starting on the first stop along
   * the gradient. Pass it to share the selection with something else that
   * shows the stops, such as handles on the artwork.
   */
  selectedStop?: number;
  /** The reader picked a stop, or an edit moved the selection: a stop was
   *  added, or the selected one removed. */
  onSelectedStopChange?: (index: number) => void;
  /** Draw the editor dimmed, out of the tab order, and taking no input. */
  disabled?: boolean;
  className?: string;
}

/** Sets `inert` on the node: React 18 does not know the attribute. */
const inertWhen = (off: boolean) => (el: HTMLElement | null): void => {
  el?.toggleAttribute('inert', off);
};

/**
 * Editor for a gradient's kind and colors: the stops of a linear, radial or
 * conic gradient, a mesh's corner colors, or a registered kind's own
 * `Editor`. Switching kind goes through `switchGradientKind`, so the colors
 * carry across.
 *
 * Stops are handles on the track, each drawn in its own color. One is
 * selected at a time — by a press, or by focus — and a single row under the
 * track edits it: color, opacity, position, and removal. A press on bare
 * track adds a stop there; arrow keys move a focused handle, and Delete
 * removes it.
 *
 * Geometry (`from`/`to`, `center`, `radius`, `angle`) is not edited here — on
 * a canvas that belongs on the artwork, via `<GradientHandles>`.
 *
 * Stops are addressed by their position in `value.stops`, which is never
 * reordered, so a drag can cross a neighbor without the two swapping under
 * the pointer.
 */
export function GradientEditor(props: GradientEditorProps): ReactElement {
  const { value, onInput, onChange, kindSwitch = true, spaceSwitch = true, svg = false, disabled = false, className } = props;
  const kind: PaintKind = value.kind ?? 'solid';
  const space: ColorSpace = (value as { interpolate?: ColorSpace }).interpolate ?? 'rgb';

  const entry = usePaintKind(kind);
  const kinds: readonly ToggleBarItem<PaintKind>[] = useGradientKinds()
    .filter((entry) => !svg || nativeSvgKind(entry.id) || entry.id === kind)
    .map((entry) => ({ value: entry.id, label: entry.label }));
  const spaces = SPACES.filter((item) => !svg || nativeSvgSpace(item.value) || item.value === space);

  const switchKind = (next: PaintKind): void => {
    const converted = switchGradientKind(value, next);
    if (converted && converted !== value) onChange(converted);
  };

  return (
    <div
      className={[s.root, className].filter(Boolean).join(' ')}
      role={disabled ? 'group' : undefined}
      aria-disabled={disabled || undefined}
      data-disabled={disabled ? '' : undefined}
    >
      <div className={s.body} ref={inertWhen(disabled)}>
        {kindSwitch && (
          <ToggleBar<PaintKind>
            items={kinds}
            value={kind}
            size="sm"
            ariaLabel="Gradient kind"
            onChange={(next) => next && switchKind(next)}
          />
        )}

        {renderBody()}
      </div>
    </div>
  );

  function renderBody(): ReactElement {
    const spaceBar = spaceSwitch && spaces.length > 1 && (
      <ToggleBar<ColorSpace>
        items={spaces}
        value={space}
        size="sm"
        ariaLabel="Blend space"
        onChange={(next) => next && onChange({ ...value, interpolate: next } as Paint)}
      />
    );
    // A registered `Editor` wins even for a built-in id, as it does in `PaintInput`.
    if (entry?.Editor) {
      const Editor = entry.Editor;
      return <><Editor value={value} onInput={onInput} onChange={onChange} />{spaceBar}</>;
    }
    if (isGradientPaint(value)) {
      return (
        <GradientStops
          value={value}
          spaceBar={spaceBar}
          selectedStop={props.selectedStop}
          onSelectedStopChange={props.onSelectedStopChange}
          disabled={disabled}
          onInput={onInput}
          onChange={onChange}
        />
      );
    }
    if (isMeshGradientPaint(value)) {
      return <><MeshEditor value={value} spaceSwitch={false} onInput={onInput} onChange={onChange} />{spaceBar}</>;
    }
    return <div className={s.noEditor}>{entry?.label ?? kind}: no editor</div>;
  }
}
