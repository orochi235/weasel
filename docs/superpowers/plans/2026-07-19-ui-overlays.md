# UI Overlays (Tooltip, Callout, Toast) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tooltip, Callout (anchored arrow'd callout, incl. scene-node anchoring), and Toast to `@weasel-js/ui`, migrating kit `title=` usage and removing dead toast code in apps/draw.

**Architecture:** Tooltip and Callout are thin wrappers over stable react-aria-components (RAC) primitives, following the existing Dialog/Checkbox pattern (component + CSS module + stories + RTL tests per folder). Toast has a kit-owned public API (`toast()`, `ToastQueue`, `<ToastRegion>`) whose internals wrap RAC's `UNSTABLE_Toast*` — the unstable imports are confined to `packages/ui/src/components/Toast/` and never appear in public types. A small core helper `sceneNodeClientRect` projects a scene node's world AABB to client coordinates for `Callout`'s `anchorRect` prop.

**Tech Stack:** React 18, react-aria-components 1.18, CSS modules with `--wzl-*` theme tokens, vitest + @testing-library/react (no user-event — use `fireEvent`), Storybook.

**Spec:** `docs/superpowers/specs/2026-07-19-ui-overlays-design.md`

**Conventions that apply to every task:**
- Run ui-package tests with `npx vitest run --project=weasel-ui <path-to-test>` from the repo root (`/Users/mike/src/weasel`).
- No inline `style=` except the two explicitly called-out dynamic-geometry cases (Callout anchor element). No `!important`.
- RTL + fake-timer state updates must be `act()`-wrapped (act warnings reproduce only in CI; keep local runs clean anyway).
- Keyboard-focus trick for RAC tooltips in jsdom: fire a `Tab` keydown first so react-aria enters keyboard modality, then `.focus()` the trigger — hover paths need pointer events jsdom doesn't model well.

**Two findings that refine the spec (already investigated, don't re-litigate):**
1. `apps/draw/src/Toasts.tsx` is dead code — nothing imports it (only its own test). There are no live call sites to migrate, so Task 7 just deletes it and does NOT mount a `<ToastRegion>` in draw (YAGNI until a call site exists).
2. `sceneNodeClientRect` takes a `getWorldBounds: (id) => Bounds | null` resolver instead of re-declaring `composeSelectionPose`'s option bag — callers build container-aware resolvers with the already-exported `composeSelectionPose`; the helper stays a pure projection.

---

### Task 1: Tooltip component

**Files:**
- Create: `packages/ui/src/components/Tooltip/Tooltip.tsx`
- Create: `packages/ui/src/components/Tooltip/Tooltip.module.css`
- Create: `packages/ui/src/components/Tooltip/Tooltip.test.tsx`
- Create: `packages/ui/src/components/Tooltip/Tooltip.stories.tsx`
- Create: `packages/ui/src/components/Tooltip/index.ts`
- Modify: `packages/ui/src/index.ts` (add export line)

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/Tooltip/Tooltip.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Focusable } from 'react-aria-components';
import { TooltipTrigger, Tooltip } from './Tooltip';

function Subject(props: { placement?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <TooltipTrigger>
      <Focusable>
        <button type="button">Save</button>
      </Focusable>
      <Tooltip placement={props.placement}>Save the document</Tooltip>
    </TooltipTrigger>
  );
}

/** Enter keyboard modality, then focus — RAC only opens tooltips on focus-visible. */
function keyboardFocus(el: HTMLElement) {
  fireEvent.keyDown(document.body, { key: 'Tab' });
  act(() => el.focus());
}

describe('Tooltip', () => {
  it('shows on keyboard focus and links via aria-describedby', () => {
    render(<Subject />);
    const btn = screen.getByRole('button');
    expect(screen.queryByRole('tooltip')).toBeNull();
    keyboardFocus(btn);
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toContain('Save the document');
    expect(btn.getAttribute('aria-describedby')).toBe(tip.id);
  });

  it('hides on blur', () => {
    render(<Subject />);
    const btn = screen.getByRole('button');
    keyboardFocus(btn);
    expect(screen.getByRole('tooltip')).toBeTruthy();
    act(() => btn.blur());
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('renders the arrow svg', () => {
    render(<Subject />);
    keyboardFocus(screen.getByRole('button'));
    const tip = screen.getByRole('tooltip');
    expect(tip.querySelector('svg')).toBeTruthy();
  });

  it('applies the requested placement', () => {
    render(<Subject placement="right" />);
    keyboardFocus(screen.getByRole('button'));
    expect(screen.getByRole('tooltip').getAttribute('data-placement')).toBe('right');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tooltip/Tooltip.test.tsx`
Expected: FAIL — cannot resolve `./Tooltip`.

- [ ] **Step 3: Write the implementation**

`packages/ui/src/components/Tooltip/Tooltip.tsx`:

```tsx
import type { ReactNode } from 'react';
import {
  TooltipTrigger as RACTooltipTrigger,
  Tooltip as RACTooltip,
  OverlayArrow,
  type TooltipProps as RACTooltipProps,
  type TooltipTriggerComponentProps,
} from 'react-aria-components';
import s from './Tooltip.module.css';

export type TooltipTriggerProps = TooltipTriggerComponentProps;

/**
 * TooltipTrigger with kit defaults: ~600 ms open delay, instant close.
 * Wrap a focusable trigger plus a `<Tooltip>`. Non-RAC triggers (plain
 * `<button>` etc.) must be wrapped in `<Focusable>` from
 * react-aria-components so hover/focus props reach the DOM node.
 */
export function TooltipTrigger(props: TooltipTriggerProps) {
  const { delay = 600, closeDelay = 0, ...rest } = props;
  return <RACTooltipTrigger delay={delay} closeDelay={closeDelay} {...rest} />;
}

export type TooltipProps = Omit<RACTooltipProps, 'children' | 'className'> & {
  children?: ReactNode;
  className?: string;
};

/**
 * Tooltip bubble with an arrow pointing at the trigger. Non-interactive
 * content only (ARIA tooltip semantics). Use inside `<TooltipTrigger>`.
 */
export function Tooltip(props: TooltipProps) {
  const { children, className, placement = 'top', offset = 8, ...rest } = props;
  return (
    <RACTooltip
      {...rest}
      placement={placement}
      offset={offset}
      className={[s.tooltip, className].filter(Boolean).join(' ')}
    >
      <OverlayArrow className={s.arrow}>
        <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
          <path d="M0 0 L4 4 L8 0" />
        </svg>
      </OverlayArrow>
      {children}
    </RACTooltip>
  );
}
```

`packages/ui/src/components/Tooltip/Tooltip.module.css`:

```css
.tooltip {
  background: var(--wzl-surface);
  border: 1px solid var(--wzl-border);
  border-radius: var(--wzl-radius-sm);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  color: var(--wzl-fg);
  font-family: var(--wzl-font-ui);
  font-size: 12px;
  line-height: 1.3;
  padding: 4px 8px;
  max-width: 260px;
  transition: opacity 100ms;
}

.tooltip[data-entering],
.tooltip[data-exiting] {
  opacity: 0;
}

.arrow svg {
  display: block;
  fill: var(--wzl-surface);
  stroke: var(--wzl-border);
  stroke-width: 1;
}

.arrow[data-placement='bottom'] svg {
  transform: rotate(180deg);
}

.arrow[data-placement='left'] svg {
  transform: rotate(-90deg);
}

.arrow[data-placement='right'] svg {
  transform: rotate(90deg);
}
```

`packages/ui/src/components/Tooltip/index.ts`:

```ts
export { Tooltip, TooltipTrigger } from './Tooltip';
export type { TooltipProps, TooltipTriggerProps } from './Tooltip';
```

In `packages/ui/src/index.ts`, after the `export * from './components/Dialog';` line add:

```ts
export * from './components/Tooltip';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Tooltip/Tooltip.test.tsx`
Expected: PASS (4 tests). If the placement test reports `data-placement` null: RAC sets it after positioning; wrap the focus in `act` (already done) — if still null in jsdom, assert `tip.closest('[data-placement]')` instead and note it in the commit message.

- [ ] **Step 5: Write stories**

`packages/ui/src/components/Tooltip/Tooltip.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from './Tooltip';

// NOTE: native <button> triggers wrapped in <Focusable>, not the kit
// <Button> — kit Button doesn't forward react-aria's hover/focus props,
// so Focusable's cloned props would be dropped and the tooltip never open.

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
};
export default meta;

type Story = StoryObj<typeof Tooltip>;

export const Basic: Story = {
  render: () => (
    <TooltipTrigger>
      <Focusable>
        <button type="button">Hover or focus me</button>
      </Focusable>
      <Tooltip>Duplicates the selected layer</Tooltip>
    </TooltipTrigger>
  ),
};

export const Placements: Story = {
  render: () => (
    <div className="sb-row">
      {(['top', 'bottom', 'left', 'right'] as const).map((p) => (
        <TooltipTrigger key={p}>
          <Focusable>
            <button type="button">{p}</button>
          </Focusable>
          <Tooltip placement={p}>Placement: {p}</Tooltip>
        </TooltipTrigger>
      ))}
    </div>
  ),
};

export const LongContent: Story = {
  render: () => (
    <TooltipTrigger>
      <Focusable>
        <button type="button">Why is this disabled?</button>
      </Focusable>
      <Tooltip>
        Boolean operations need at least two path objects selected. Select
        another shape with Shift-click and try again.
      </Tooltip>
    </TooltipTrigger>
  ),
};
```

(`sb-row` — if no such utility class exists in the storybook preview styles, use the pattern the nearest existing multi-item story uses; do not add inline styles.)

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/Tooltip packages/ui/src/index.ts
git commit -m "feat(ui): Tooltip component wrapping react-aria with arrow + kit delays"
```

---

### Task 2: Migrate kit `title=` users to Tooltip

**Files:**
- Modify: `packages/ui/src/components/ToolButton/ToolButton.tsx:44-64`
- Modify: `packages/ui/src/components/ActionBar/ActionBar.tsx:97-117`
- Modify: `packages/ui/src/components/SidebarPanel/SidebarPanel.tsx:58-68`
- Modify: `packages/ui/src/components/ToolPalette/ToolPalette.test.tsx:142-156`
- Test: existing suites for ToolPalette, ActionBar

(`ToolPalette` passes `title` down to `ToolButton`, so it migrates for free.)

- [ ] **Step 1: Update ToolPalette's title assertions to expect tooltips (failing first)**

In `packages/ui/src/components/ToolPalette/ToolPalette.test.tsx`, replace the two tests at lines 142-156 with tooltip-based assertions:

```tsx
  it('button tooltip combines label and shortcut', () => {
    render(<Subject />); // keep whatever render/setup the current test body uses
    const btn = screen.getByRole('button', { name: /select/i });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => btn.focus());
    const tip = screen.getByRole('tooltip');
    expect(tip.textContent).toMatch(/select/i);
    expect(tip.textContent).toMatch(/V/);
  });

  it('button tooltip is just the label when no shortcut is available', () => {
    render(<Subject />); // keep current setup
    const btn = screen.getByRole('button', { name: /select/i });
    fireEvent.keyDown(document.body, { key: 'Tab' });
    act(() => btn.focus());
    expect(screen.getByRole('tooltip').textContent).toBe('Select');
  });
```

Preserve each test's existing setup/render call — only the assertion mechanism changes (attribute → tooltip role). Import `act` from `@testing-library/react` if not already imported.

- [ ] **Step 2: Run to verify the updated tests fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/ToolPalette/ToolPalette.test.tsx`
Expected: FAIL — no element with role `tooltip` (ToolButton still uses the native attribute).

- [ ] **Step 3: Migrate ToolButton**

Replace the return of `ToolButton` (`packages/ui/src/components/ToolButton/ToolButton.tsx`) — wrap in the kit trigger, drop the native `title` attribute:

```tsx
import type { ReactNode } from 'react';
import { Focusable } from 'react-aria-components';
import { Tooltip, TooltipTrigger } from '../Tooltip';
import s from './ToolButton.module.css';
```

```tsx
export function ToolButton(props: ToolButtonProps) {
  const { icon, label, shortcut, active, disabled, ariaDisabled, tabbable, onClick, title, className } = props;
  const resolvedTitle = title ?? (shortcut ? `${label} (${shortcut})` : label);
  const cls = [s.button, active && s.active, className].filter(Boolean).join(' ');
  return (
    <TooltipTrigger>
      <Focusable>
        <button
          type="button"
          tabIndex={tabbable ? 0 : -1}
          className={cls}
          aria-current={active ? 'true' : undefined}
          aria-disabled={ariaDisabled ? 'true' : undefined}
          disabled={disabled}
          onClick={onClick}
        >
          <span className={s.icon} aria-hidden="true">{icon}</span>
          <span className={s.label}>{label}</span>
          {shortcut && <span className={s.shortcut}>{shortcut}</span>}
        </button>
      </Focusable>
      <Tooltip>{resolvedTitle}</Tooltip>
    </TooltipTrigger>
  );
}
```

Update the `title` prop's doc comment from "Tooltip / accessible name" to "Tooltip content. Defaults to `label` (plus `shortcut` if provided)."

- [ ] **Step 4: Migrate ActionBar**

In `packages/ui/src/components/ActionBar/ActionBar.tsx`, wrap the per-action button (lines 97-117). Add imports as in Step 3. Replace the button JSX:

```tsx
          <TooltipTrigger key={action.id}>
            <Focusable>
              <button
                type="button"
                data-testid={`action-bar-item-${action.id}`}
                aria-label={label}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                className={s.button}
                onClick={() => {
                  if (disabled) return;
                  // Dispatch through the registry so the enabled() guard runs.
                  // If no registry is in scope the click is a no-op — ActionBar
                  // is expected to render under an `ActionsProvider`.
                  registry?.trigger(action.id);
                }}
              >
                {icon}
              </button>
            </Focusable>
            <Tooltip>{title}</Tooltip>
          </TooltipTrigger>
```

(The `key` moves from the button to the `TooltipTrigger`. Known behavior change: natively-`disabled` buttons no longer show a tooltip — native `title` used to. Acceptable; ToolPalette's ineligible buttons use `ariaDisabled` and keep theirs.)

- [ ] **Step 5: Migrate SidebarPanel's hide button**

In `packages/ui/src/components/SidebarPanel/SidebarPanel.tsx` (lines 58-68), same pattern:

```tsx
          {onHide !== undefined && (
            <TooltipTrigger>
              <Focusable>
                <button
                  type="button"
                  className={s.hideButton}
                  onClick={onHide}
                  aria-label="Hide panel"
                >
                  ×
                </button>
              </Focusable>
              <Tooltip>Hide panel</Tooltip>
            </TooltipTrigger>
          )}
```

- [ ] **Step 6: Run the ui test project**

Run: `npx vitest run --project=weasel-ui`
Expected: PASS. If ActionBar/other suites assert on the removed `title` attribute, update those assertions the same way as Step 1 (attribute → tooltip role) — search first: `grep -rn "getAttribute('title')\|toHaveAttribute('title'" packages/ui/src`.

- [ ] **Step 7: Grep for stragglers**

Run: `grep -rn "title=" packages/ui/src/components --include="*.tsx" | grep -v stories | grep -v test | grep -v "props.title\|{title}\|title:"`
Expected: no remaining native `title=` attribute usage in kit components (prop plumbing like `title={resolvedTitle}` on `ToolButton` — a component prop, not the DOM attribute — is fine and expected in `ToolPalette.tsx`).

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src/components
git commit -m "refactor(ui): replace native title attributes with kit Tooltip"
```

---

### Task 3: `sceneNodeClientRect` helper (core)

**Files:**
- Create: `src/core/viewport/sceneNodeClientRect.ts`
- Create: `src/core/viewport/sceneNodeClientRect.test.ts`
- Modify: `src/index.ts` (viewport exports block, around line 89)

- [ ] **Step 1: Write the failing test**

`src/core/viewport/sceneNodeClientRect.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { sceneNodeClientRect } from './sceneNodeClientRect';
import type { Bounds } from './fitViewToBounds';

const fakeCanvas = (left: number, top: number): Element =>
  ({ getBoundingClientRect: () => ({ left, top }) }) as unknown as Element;

describe('sceneNodeClientRect', () => {
  const worldBounds = new Map<string, Bounds>([
    ['a', { x: 30, y: 40, width: 5, height: 6 }],
  ]);
  const getWorldBounds = (id: string) => worldBounds.get(id) ?? null;

  it('projects a world AABB through the view and canvas offset', () => {
    const rect = sceneNodeClientRect({
      id: 'a',
      getWorldBounds,
      view: { x: 10, y: 20, scale: { x: 2, y: 2 } },
      canvas: fakeCanvas(100, 50),
    });
    // screen = (world - view.origin) * scale → (20*2, 20*2) = (40, 40)
    expect(rect).toEqual({ x: 140, y: 90, width: 10, height: 12 });
  });

  it('respects per-axis scale', () => {
    const rect = sceneNodeClientRect({
      id: 'a',
      getWorldBounds,
      view: { x: 0, y: 0, scale: { x: 1, y: 3 } },
      canvas: fakeCanvas(0, 0),
    });
    expect(rect).toEqual({ x: 30, y: 120, width: 5, height: 18 });
  });

  it('returns null for an unknown id', () => {
    const rect = sceneNodeClientRect({
      id: 'nope',
      getWorldBounds,
      view: { x: 0, y: 0, scale: { x: 1, y: 1 } },
      canvas: fakeCanvas(0, 0),
    });
    expect(rect).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=kit src/core/viewport/sceneNodeClientRect.test.ts`
Expected: FAIL — module not found. (If `--project=kit` doesn't match this path, run without the flag and let vitest pick the project.)

- [ ] **Step 3: Write the implementation**

`src/core/viewport/sceneNodeClientRect.ts`:

```ts
import type { Bounds } from './fitViewToBounds';
import type { View } from './view';
import { viewToTransform } from './view';
import { worldToScreen } from './viewTransform';

/** Options for {@link sceneNodeClientRect}. */
export interface SceneNodeClientRectOpts {
  /** Node (or container) id to locate. */
  id: string;
  /**
   * Resolve an id to its world-space AABB, or null when unknown. Build
   * container-aware resolvers with `composeSelectionPose` (plus
   * `boundsOfPath` via its `getBounds` option for Path poses); a plain
   * stored-pose lookup suffices for leaf rect poses.
   */
  getWorldBounds: (id: string) => Bounds | null;
  /** Current viewport. */
  view: View;
  /** The canvas element — supplies the client-coordinate origin. */
  canvas: Element;
}

/** Client-coordinate rect (viewport space) — the shape `Callout`'s `anchorRect` expects. */
export interface NodeClientRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Project a scene node's world AABB to client (viewport) coordinates,
 * e.g. to anchor a `Callout` at a canvas-drawn object. Snapshot
 * semantics: the rect is where the node is *now* — it does not track
 * subsequent pan/zoom or scene mutations.
 */
export function sceneNodeClientRect(opts: SceneNodeClientRectOpts): NodeClientRect | null {
  const bounds = opts.getWorldBounds(opts.id);
  if (bounds === null) return null;
  const t = viewToTransform(opts.view);
  const [sx, sy] = worldToScreen(bounds.x, bounds.y, t);
  const host = opts.canvas.getBoundingClientRect();
  return {
    x: host.left + sx,
    y: host.top + sy,
    width: bounds.width * opts.view.scale.x,
    height: bounds.height * opts.view.scale.y,
  };
}
```

In `src/index.ts`, in the "Viewport: ViewTransform + helpers" block (after the `clampView` exports around line 94), add:

```ts
export { sceneNodeClientRect } from './core/viewport/sceneNodeClientRect';
export type { SceneNodeClientRectOpts, NodeClientRect } from './core/viewport/sceneNodeClientRect';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=kit src/core/viewport/sceneNodeClientRect.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/viewport/sceneNodeClientRect.ts src/core/viewport/sceneNodeClientRect.test.ts src/index.ts
git commit -m "feat(core): sceneNodeClientRect — project node world AABB to client coords"
```

---

### Task 4: Callout component

**Files:**
- Create: `packages/ui/src/components/Callout/Callout.tsx`
- Create: `packages/ui/src/components/Callout/Callout.module.css`
- Create: `packages/ui/src/components/Callout/Callout.test.tsx`
- Create: `packages/ui/src/components/Callout/Callout.stories.tsx`
- Create: `packages/ui/src/components/Callout/index.ts`
- Modify: `packages/ui/src/index.ts`, `packages/ui/package.json`

- [ ] **Step 1: Add the react-dom peer dependency**

`Callout` portals its virtual anchor to `document.body`. In `packages/ui/package.json`, extend `peerDependencies`:

```json
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  }
```

- [ ] **Step 2: Write the failing test**

`packages/ui/src/components/Callout/Callout.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useRef, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { Callout, CalloutTrigger } from './Callout';

function TriggerSubject() {
  return (
    <CalloutTrigger>
      <Pressable>
        <button type="button">Explain</button>
      </Pressable>
      <Callout title="Heads up">Body text</Callout>
    </CalloutTrigger>
  );
}

function ProgrammaticSubject(props: { modal?: boolean; onOutsideClick?: () => void }) {
  const anchor = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(true);
  return (
    <>
      <div ref={anchor}>anchor</div>
      <button type="button" onClick={props.onOutsideClick}>outside</button>
      <Callout
        triggerRef={anchor}
        isOpen={open}
        onOpenChange={setOpen}
        modal={props.modal}
        title="Note"
      >
        Pointed content
      </Callout>
    </>
  );
}

describe('Callout', () => {
  it('opens from a composed trigger and closes via the close button', () => {
    render(<TriggerSubject />);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Explain' }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Body text')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Close callout' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('supports programmatic triggerRef + controlled open', () => {
    render(<ProgrammaticSubject />);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('Pointed content')).toBeTruthy();
  });

  it('closes on Escape when non-modal', () => {
    render(<ProgrammaticSubject />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('uses alertdialog role and hides outside content when modal', () => {
    render(<ProgrammaticSubject modal />);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    // react-aria's ariaHideOutside removes outside content from the a11y
    // tree while a modal overlay is open.
    expect(screen.queryByRole('button', { name: 'outside' })).toBeNull();
  });

  it('renders an invisible fixed anchor for anchorRect mode', () => {
    render(
      <Callout isOpen anchorRect={{ x: 120, y: 80, width: 40, height: 20 }} title="Here">
        Anchored
      </Callout>,
    );
    expect(screen.getByRole('dialog')).toBeTruthy();
    const anchor = document.body.querySelector('[data-callout-anchor]') as HTMLElement;
    expect(anchor).toBeTruthy();
    expect(anchor.style.left).toBe('120px');
    expect(anchor.style.top).toBe('80px');
    expect(anchor.style.width).toBe('40px');
    expect(anchor.style.height).toBe('20px');
  });

  it('applies the tone class', () => {
    render(
      <Callout isOpen anchorRect={{ x: 0, y: 0, width: 10, height: 10 }} tone="danger">
        !
      </Callout>,
    );
    const popover = screen.getByRole('dialog').closest('[class*="popover"]');
    expect(popover?.className).toMatch(/toneDanger/);
  });
});
```

Note on the modal test: the load-bearing assertion is that the outside button is removed from the accessibility tree (`queryByRole` returns null) while the modal callout is open — react-aria applies `aria-hidden` to outside content. If RAC 1.18's popover doesn't aria-hide in jsdom, replace with: fire `pointerDown` on the outside button and assert an `onOutsideClick` spy was NOT called while `isOpen` remains controlled-true. One of the two must pass; delete the other.

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Callout/Callout.test.tsx`
Expected: FAIL — cannot resolve `./Callout`.

- [ ] **Step 4: Write the implementation**

`packages/ui/src/components/Callout/Callout.tsx`:

```tsx
import { useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import {
  DialogTrigger,
  Popover as RACPopover,
  OverlayArrow,
  Dialog as RACDialog,
  Heading,
  type PopoverProps as RACPopoverProps,
} from 'react-aria-components';
import s from './Callout.module.css';

export type CalloutTone = 'info' | 'warning' | 'danger';

/**
 * Composition wrapper for press-to-open callouts:
 * `<CalloutTrigger><Pressable>…</Pressable><Callout>…</Callout></CalloutTrigger>`.
 * Re-exported RAC DialogTrigger — non-RAC trigger elements must be wrapped
 * in `<Pressable>` from react-aria-components.
 */
export { DialogTrigger as CalloutTrigger };

export type CalloutProps = Omit<
  RACPopoverProps,
  'children' | 'className' | 'isNonModal' | 'triggerRef'
> & {
  children?: ReactNode;
  className?: string;
  /** Optional heading rendered above the body. */
  title?: ReactNode;
  /** Footer slot — typically action buttons. */
  footer?: ReactNode;
  /** Accent tone for border + arrow. Default `info`. */
  tone?: CalloutTone;
  /**
   * `true` — blocks interaction with the rest of the app until dismissed;
   * inner dialog is `role="alertdialog"`. `false` (default) — non-blocking:
   * the app stays interactive; Esc / outside click / close button dismiss.
   */
  modal?: boolean;
  /** Show the × button. Defaults to `!modal`. */
  showCloseButton?: boolean;
  /** Anchor to an arbitrary element (programmatic use, with `isOpen`). */
  triggerRef?: RefObject<Element | null>;
  /**
   * Anchor to a client-coordinate rect — e.g. a scene node located via
   * core's `sceneNodeClientRect`. Snapshot semantics: the callout does not
   * re-anchor on pan/zoom or scene changes. Takes precedence over
   * `triggerRef`.
   */
  anchorRect?: { x: number; y: number; width: number; height: number };
};

const toneClass: Record<CalloutTone, string> = {
  info: s.toneInfo,
  warning: s.toneWarning,
  danger: s.toneDanger,
};

/**
 * Anchored callout with an arrow pointing at its source — a trigger
 * element, an arbitrary `triggerRef`, or a client-space `anchorRect`.
 * Wraps React Aria Popover + Dialog; positioning, collision flipping,
 * dismissal, and focus behavior come from the underlying primitives.
 */
export function Callout(props: CalloutProps) {
  const {
    children,
    className,
    title,
    footer,
    tone = 'info',
    modal = false,
    showCloseButton,
    triggerRef,
    anchorRect,
    placement = 'top',
    offset = 12,
    ...rest
  } = props;
  const anchorRef = useRef<HTMLSpanElement>(null);
  const showClose = showCloseButton ?? !modal;
  return (
    <>
      {anchorRect !== undefined &&
        createPortal(
          <span
            ref={anchorRef}
            data-callout-anchor=""
            className={s.anchor}
            aria-hidden="true"
            // Dynamic geometry — inline style is the mechanism here, not styling.
            style={{
              left: anchorRect.x,
              top: anchorRect.y,
              width: anchorRect.width,
              height: anchorRect.height,
            }}
          />,
          document.body,
        )}
      <RACPopover
        {...rest}
        triggerRef={anchorRect !== undefined ? anchorRef : triggerRef}
        isNonModal={!modal}
        placement={placement}
        offset={offset}
        className={[s.popover, toneClass[tone], className].filter(Boolean).join(' ')}
      >
        <OverlayArrow className={s.arrow}>
          <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden="true">
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
        <RACDialog role={modal ? 'alertdialog' : 'dialog'} className={s.dialog}>
          {({ close }) => (
            <>
              {(title !== undefined || showClose) && (
                <header className={s.header}>
                  {title !== undefined && (
                    <Heading slot="title" className={s.title}>{title}</Heading>
                  )}
                  {showClose && (
                    <button
                      type="button"
                      className={s.close}
                      onClick={close}
                      aria-label="Close callout"
                    >
                      ×
                    </button>
                  )}
                </header>
              )}
              <div className={s.body}>{children}</div>
              {footer !== undefined && <footer className={s.footer}>{footer}</footer>}
            </>
          )}
        </RACDialog>
      </RACPopover>
    </>
  );
}
```

`packages/ui/src/components/Callout/Callout.module.css`:

```css
.anchor {
  position: fixed;
  pointer-events: none;
}

.popover {
  --callout-accent: var(--wzl-accent-strong);
  background: var(--wzl-surface);
  border: 1px solid var(--callout-accent);
  border-radius: var(--wzl-radius-md);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
  color: var(--wzl-fg);
  font-family: var(--wzl-font-ui);
  max-width: 320px;
  transition: opacity 120ms;
}

.popover[data-entering],
.popover[data-exiting] {
  opacity: 0;
}

.toneWarning {
  --callout-accent: var(--wzl-warning, #e5a50a);
}

.toneDanger {
  --callout-accent: var(--wzl-danger, #ff5b5b);
}

.arrow svg {
  display: block;
  fill: var(--wzl-surface);
  stroke: var(--callout-accent);
  stroke-width: 1;
}

.arrow[data-placement='bottom'] svg {
  transform: rotate(180deg);
}

.arrow[data-placement='left'] svg {
  transform: rotate(-90deg);
}

.arrow[data-placement='right'] svg {
  transform: rotate(90deg);
}

.dialog {
  outline: none;
  max-height: min(400px, 60vh);
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px 0;
}

.title {
  margin: 0;
  flex: 1;
  font-size: 13px;
  font-weight: 600;
}

.close {
  flex: 0 0 auto;
  background: none;
  border: none;
  color: var(--wzl-fg-muted);
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: var(--wzl-radius-sm);
}

.close:hover {
  color: var(--wzl-fg);
}

.body {
  padding: 8px 12px 10px;
  font-size: 13px;
  line-height: 1.4;
  overflow-y: auto;
}

.footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 12px 10px;
}
```

`packages/ui/src/components/Callout/index.ts`:

```ts
export { Callout, CalloutTrigger } from './Callout';
export type { CalloutProps, CalloutTone } from './Callout';
```

In `packages/ui/src/index.ts`, after the Tooltip export add:

```ts
export * from './components/Callout';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Callout/Callout.test.tsx`
Expected: PASS (6 tests). Apply the modal-test fallback from Step 2's note if the aria-hidden assertion doesn't hold in jsdom.

- [ ] **Step 6: Write stories**

`packages/ui/src/components/Callout/Callout.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { useRef, useState } from 'react';
import { Pressable } from 'react-aria-components';
import { Callout, CalloutTrigger } from './Callout';
import { Button } from '../Button';

const meta: Meta<typeof Callout> = {
  title: 'Primitives/Callout',
  component: Callout,
};
export default meta;

type Story = StoryObj<typeof Callout>;

export const Composed: Story = {
  render: () => (
    <CalloutTrigger>
      <Pressable>
        <button type="button">What does this do?</button>
      </Pressable>
      <Callout title="Boolean union" placement="bottom">
        Merges the selected paths into a single shape. Original paths are
        replaced; undo restores them.
      </Callout>
    </CalloutTrigger>
  ),
};

export const Tones: Story = {
  render: () => {
    function Row() {
      const infoRef = useRef<HTMLButtonElement>(null);
      const warnRef = useRef<HTMLButtonElement>(null);
      const dangerRef = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState<'info' | 'warning' | 'danger' | null>('info');
      return (
        <>
          <button ref={infoRef} type="button" onClick={() => setOpen('info')}>info</button>
          <button ref={warnRef} type="button" onClick={() => setOpen('warning')}>warning</button>
          <button ref={dangerRef} type="button" onClick={() => setOpen('danger')}>danger</button>
          <Callout triggerRef={infoRef} isOpen={open === 'info'} onOpenChange={(o) => !o && setOpen(null)} tone="info" title="Info">Neutral guidance.</Callout>
          <Callout triggerRef={warnRef} isOpen={open === 'warning'} onOpenChange={(o) => !o && setOpen(null)} tone="warning" title="Warning">Something needs attention.</Callout>
          <Callout triggerRef={dangerRef} isOpen={open === 'danger'} onOpenChange={(o) => !o && setOpen(null)} tone="danger" title="Danger">Destructive consequence ahead.</Callout>
        </>
      );
    }
    return <Row />;
  },
};

export const Modal: Story = {
  render: () => {
    function Subject() {
      const ref = useRef<HTMLButtonElement>(null);
      const [open, setOpen] = useState(false);
      return (
        <>
          <button ref={ref} type="button" onClick={() => setOpen(true)}>Delete everything</button>
          <Callout
            triggerRef={ref}
            isOpen={open}
            onOpenChange={setOpen}
            modal
            tone="danger"
            title="Really delete?"
            footer={
              <>
                <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" size="sm" onClick={() => setOpen(false)}>Delete</Button>
              </>
            }
          >
            This clears the whole document. The app is blocked until you choose.
          </Callout>
        </>
      );
    }
    return <Subject />;
  },
};
```

- [ ] **Step 7: Commit**

```bash
git add packages/ui/src/components/Callout packages/ui/src/index.ts packages/ui/package.json
git commit -m "feat(ui): Callout — anchored arrow'd callout with modal/tone/anchorRect modes"
```

---

### Task 5: Toast queue (kit-owned API over RAC UNSTABLE, contained)

**Files:**
- Create: `packages/ui/src/components/Toast/queue.ts`
- Create: `packages/ui/src/components/Toast/queue.test.ts`

**Containment rule (from the spec, hard):** `UNSTABLE_` imports may appear ONLY in files under `packages/ui/src/components/Toast/`, and no RAC toast type may appear in any exported type signature. `racQueueOf` is the folder-internal bridge and is NOT exported from the folder's `index.ts`.

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/Toast/queue.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createToastQueue, racQueueOf, toast, defaultToastQueue } from './queue';

describe('ToastQueue', () => {
  it('adds toasts with tone, title, description', () => {
    const q = createToastQueue();
    q.add('warning', 'SVG import', { description: '3 elements skipped' });
    const visible = racQueueOf(q).visibleToasts;
    expect(visible).toHaveLength(1);
    expect(visible[0].content).toEqual({
      title: 'SVG import',
      description: '3 elements skipped',
      tone: 'warning',
    });
  });

  it('defaults to an 8s timeout and honors ttlMs null as sticky', () => {
    const q = createToastQueue();
    q.add('info', 'timed');
    q.add('info', 'sticky', { ttlMs: null });
    const [timed, sticky] = racQueueOf(q).visibleToasts;
    expect(timed.timer).toBeDefined();
    expect(sticky.timer).toBeUndefined();
  });

  it('replaces an earlier toast with the same id', () => {
    const q = createToastQueue();
    q.add('info', 'first', { id: 'save-status' });
    q.add('success', 'second', { id: 'save-status' });
    const visible = racQueueOf(q).visibleToasts;
    expect(visible).toHaveLength(1);
    expect(visible[0].content.title).toBe('second');
  });

  it('clear() empties the queue', () => {
    const q = createToastQueue();
    q.add('info', 'a');
    q.add('info', 'b');
    q.clear();
    expect(racQueueOf(q).visibleToasts).toHaveLength(0);
  });

  it('toast() convenience writes to the default queue with tones', () => {
    toast('plain');
    toast.error('bad');
    const visible = racQueueOf(defaultToastQueue).visibleToasts;
    expect(visible.map((t) => t.content.tone)).toEqual(['info', 'error']);
    defaultToastQueue.clear();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Toast/queue.test.ts`
Expected: FAIL — cannot resolve `./queue`.

- [ ] **Step 3: Write the implementation**

`packages/ui/src/components/Toast/queue.ts`:

```ts
import { UNSTABLE_ToastQueue } from 'react-aria-components';

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

/** Kit-owned payload rendered inside each toast. */
export interface ToastContent {
  title: string;
  description?: string;
  tone: ToastTone;
}

export interface ToastOptions {
  description?: string;
  /** Auto-dismiss delay in ms. Default 8000. `null` — sticky until dismissed. */
  ttlMs?: number | null;
  /** Stable identity: re-adding with the same id replaces the earlier toast. */
  id?: string;
}

const DEFAULT_TTL_MS = 8000;

// The wrapped RAC queue lives in a module-scoped WeakMap so the public
// class surface carries no RAC (UNSTABLE_) types — see the design spec's
// containment rule. `racQueueOf` below is the folder-internal accessor.
const RAC_QUEUES = new WeakMap<ToastQueue, UNSTABLE_ToastQueue<ToastContent>>();

/**
 * Kit-owned toast queue. Create isolated instances with
 * `createToastQueue()` (tests, secondary roots); most apps use the
 * module-level `defaultToastQueue` via `toast()`.
 */
export class ToastQueue {
  private keysById = new Map<string, string>();

  constructor() {
    RAC_QUEUES.set(this, new UNSTABLE_ToastQueue<ToastContent>({ maxVisibleToasts: 5 }));
  }

  add(tone: ToastTone, title: string, options: ToastOptions = {}): void {
    const { description, ttlMs = DEFAULT_TTL_MS, id } = options;
    const rac = RAC_QUEUES.get(this)!;
    if (id !== undefined) {
      const existing = this.keysById.get(id);
      if (existing !== undefined) rac.close(existing);
    }
    const key = rac.add(
      { title, description, tone },
      ttlMs === null ? {} : { timeout: ttlMs },
    );
    if (id !== undefined) this.keysById.set(id, key);
  }

  /** Dismiss every queued toast. */
  clear(): void {
    RAC_QUEUES.get(this)!.clear();
    this.keysById.clear();
  }
}

export function createToastQueue(): ToastQueue {
  return new ToastQueue();
}

/**
 * Folder-internal bridge to the wrapped RAC queue for `ToastRegion`.
 * Deliberately NOT exported from the Toast folder's `index.ts` — the
 * RAC toast surface is unstable and must not leak past this folder.
 */
export function racQueueOf(queue: ToastQueue): UNSTABLE_ToastQueue<ToastContent> {
  return RAC_QUEUES.get(queue)!;
}

/** Module-level default queue used by `toast()` and `<ToastRegion>`. */
export const defaultToastQueue = createToastQueue();

type ToastFn = {
  (title: string, options?: ToastOptions): void;
  info(title: string, options?: ToastOptions): void;
  success(title: string, options?: ToastOptions): void;
  warning(title: string, options?: ToastOptions): void;
  error(title: string, options?: ToastOptions): void;
};

function tonedAdd(tone: ToastTone) {
  return (title: string, options?: ToastOptions) => defaultToastQueue.add(tone, title, options);
}

/** Imperative convenience over `defaultToastQueue`. Bare `toast(...)` is `info`. */
export const toast: ToastFn = Object.assign(tonedAdd('info'), {
  info: tonedAdd('info'),
  success: tonedAdd('success'),
  warning: tonedAdd('warning'),
  error: tonedAdd('error'),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Toast/queue.test.ts`
Expected: PASS (5 tests). Note: if the `timer`/sticky assertion fails because RAC only arms timers once a region renders, move that test into Task 6's region tests using fake timers, and here assert only `visibleToasts.length`.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/Toast
git commit -m "feat(ui): kit-owned ToastQueue + toast() over contained RAC unstable queue"
```

---

### Task 6: ToastRegion component

**Files:**
- Create: `packages/ui/src/components/Toast/Toast.tsx`
- Create: `packages/ui/src/components/Toast/Toast.module.css`
- Create: `packages/ui/src/components/Toast/Toast.test.tsx`
- Create: `packages/ui/src/components/Toast/Toast.stories.tsx`
- Create: `packages/ui/src/components/Toast/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Write the failing test**

`packages/ui/src/components/Toast/Toast.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastRegion } from './Toast';
import { createToastQueue } from './queue';

describe('ToastRegion', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders queued toasts inside a landmark region', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('success', 'Saved', { description: 'All changes stored' }));
    expect(screen.getByRole('region', { name: /notifications/i })).toBeTruthy();
    expect(screen.getByText('Saved')).toBeTruthy();
    expect(screen.getByText('All changes stored')).toBeTruthy();
  });

  it('dismisses via the close button', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('info', 'Ephemeral'));
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Ephemeral')).toBeNull();
  });

  it('auto-dismisses after the default ttl', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('info', 'Timed'));
    expect(screen.getByText('Timed')).toBeTruthy();
    act(() => vi.advanceTimersByTime(8100));
    expect(screen.queryByText('Timed')).toBeNull();
  });

  it('keeps sticky toasts (ttlMs null) indefinitely', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => q.add('error', 'Sticky', { ttlMs: null }));
    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByText('Sticky')).toBeTruthy();
  });

  it('stacks multiple toasts and applies tone classes', () => {
    const q = createToastQueue();
    render(<ToastRegion queue={q} />);
    act(() => {
      q.add('info', 'one', { ttlMs: null });
      q.add('warning', 'two', { ttlMs: null });
    });
    expect(screen.getByText('one')).toBeTruthy();
    expect(screen.getByText('two')).toBeTruthy();
    const toastEl = screen.getByText('two').closest('[class*="toast"]');
    expect(toastEl?.className).toMatch(/toneWarning/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Toast/Toast.test.tsx`
Expected: FAIL — cannot resolve `./Toast`.

- [ ] **Step 3: Write the implementation**

`packages/ui/src/components/Toast/Toast.tsx`:

```tsx
import {
  UNSTABLE_ToastRegion as RACToastRegion,
  UNSTABLE_Toast as RACToast,
  UNSTABLE_ToastContent as RACToastContent,
  Text,
  Button,
} from 'react-aria-components';
import { defaultToastQueue, racQueueOf, type ToastQueue, type ToastTone } from './queue';
import s from './Toast.module.css';

export type ToastPlacement = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

export interface ToastRegionProps {
  /** Queue to render. Defaults to the module-level `defaultToastQueue`. */
  queue?: ToastQueue;
  /** Screen corner for the stack. Default `bottom-right`. */
  placement?: ToastPlacement;
  className?: string;
}

const placementClass: Record<ToastPlacement, string> = {
  'bottom-right': s.bottomRight,
  'bottom-left': s.bottomLeft,
  'top-right': s.topRight,
  'top-left': s.topLeft,
};

const toneClass: Record<ToastTone, string> = {
  info: s.toneInfo,
  success: s.toneSuccess,
  warning: s.toneWarning,
  error: s.toneError,
};

/**
 * Renders the toast stack for a queue. Mount once, near the app root.
 * From the underlying React Aria region: landmark semantics (keyboard /
 * F6 reachable), screen-reader announcements, and hover pausing the
 * auto-dismiss timers.
 */
export function ToastRegion(props: ToastRegionProps) {
  const { queue = defaultToastQueue, placement = 'bottom-right', className } = props;
  return (
    <RACToastRegion
      queue={racQueueOf(queue)}
      aria-label="Notifications"
      className={[s.region, placementClass[placement], className].filter(Boolean).join(' ')}
    >
      {({ toast: t }) => (
        <RACToast toast={t} className={[s.toast, toneClass[t.content.tone]].join(' ')}>
          <RACToastContent className={s.content}>
            <Text slot="title" className={s.title}>{t.content.title}</Text>
            {t.content.description !== undefined && (
              <Text slot="description" className={s.description}>{t.content.description}</Text>
            )}
          </RACToastContent>
          <Button slot="close" className={s.close} aria-label="Dismiss notification">
            ×
          </Button>
        </RACToast>
      )}
    </RACToastRegion>
  );
}
```

`packages/ui/src/components/Toast/Toast.module.css`:

```css
.region {
  position: fixed;
  z-index: 1100;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 360px;
  outline: none;
}

.bottomRight { bottom: 16px; right: 16px; }
.bottomLeft { bottom: 16px; left: 16px; }
.topRight { top: 16px; right: 16px; flex-direction: column-reverse; }
.topLeft { top: 16px; left: 16px; flex-direction: column-reverse; }

.toast {
  --toast-accent: var(--wzl-accent-strong);
  display: flex;
  align-items: flex-start;
  gap: 8px;
  background: var(--wzl-surface);
  border: 1px solid var(--wzl-border);
  border-left: 3px solid var(--toast-accent);
  border-radius: var(--wzl-radius-md);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
  color: var(--wzl-fg);
  font-family: var(--wzl-font-ui);
  padding: 10px 12px;
  outline: none;
}

.toneSuccess { --toast-accent: var(--wzl-success, #2ec27e); }
.toneWarning { --toast-accent: var(--wzl-warning, #e5a50a); }
.toneError { --toast-accent: var(--wzl-danger, #ff5b5b); }

.content {
  flex: 1;
  min-width: 0;
}

.title {
  display: block;
  font-size: 13px;
  font-weight: 600;
}

.description {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--wzl-fg-muted);
}

.close {
  flex: 0 0 auto;
  background: none;
  border: none;
  color: var(--wzl-fg-muted);
  font-size: 16px;
  line-height: 1;
  padding: 2px 4px;
  cursor: pointer;
  border-radius: var(--wzl-radius-sm);
}

.close:hover {
  color: var(--wzl-fg);
}
```

`packages/ui/src/components/Toast/index.ts` (note: `racQueueOf` deliberately absent):

```ts
export { ToastRegion } from './Toast';
export type { ToastRegionProps, ToastPlacement } from './Toast';
export { toast, createToastQueue, defaultToastQueue, ToastQueue } from './queue';
export type { ToastOptions, ToastContent, ToastTone } from './queue';
```

In `packages/ui/src/index.ts`, after the Callout export add:

```ts
export * from './components/Toast';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Toast/`
Expected: PASS (queue + region suites). If the region landmark query fails, check the role RAC applies (`getByRole('region')` vs a `list` inside) and adjust the query — the load-bearing part is the accessible name "Notifications" and content rendering.

- [ ] **Step 5: Write stories**

`packages/ui/src/components/Toast/Toast.stories.tsx`:

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { ToastRegion } from './Toast';
import { createToastQueue } from './queue';
import { Button } from '../Button';

const meta: Meta<typeof ToastRegion> = {
  title: 'Primitives/Toast',
  component: ToastRegion,
};
export default meta;

type Story = StoryObj<typeof ToastRegion>;

const queue = createToastQueue();

export const Interactive: Story = {
  render: () => (
    <>
      <div className="sb-row">
        <Button onClick={() => queue.add('info', 'Heads up', { description: 'Neutral information.' })}>info</Button>
        <Button onClick={() => queue.add('success', 'Saved', { description: 'All changes stored.' })}>success</Button>
        <Button onClick={() => queue.add('warning', 'SVG import', { description: '3 unsupported elements skipped.' })}>warning</Button>
        <Button onClick={() => queue.add('error', 'Export failed', { ttlMs: null, description: 'Sticky until dismissed.' })}>error (sticky)</Button>
        <Button variant="ghost" onClick={() => queue.add('info', 'Deduped', { id: 'dedupe-demo', description: 'Re-click: replaces, never stacks.' })}>deduped id</Button>
      </div>
      <ToastRegion queue={queue} />
    </>
  ),
};
```

(Same `sb-row` note as Task 1 Step 5.)

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/Toast packages/ui/src/index.ts
git commit -m "feat(ui): ToastRegion — corner stack over contained RAC unstable region"
```

---

### Task 7: Remove dead Toasts code in apps/draw

**Files:**
- Delete: `apps/draw/src/Toasts.tsx`, `apps/draw/src/Toasts.test.tsx`, `apps/draw/src/Toasts.module.css`

Pre-verified: nothing imports `Toasts` (grep over `apps/draw/src` matches only these three files). Per the YAGNI call in the header, draw does NOT get a `<ToastRegion>` mounted until it has a real toast call site.

- [ ] **Step 1: Re-verify dead code, then delete**

```bash
grep -rn "Toasts" apps/draw/src --include="*.ts*" | grep -v "apps/draw/src/Toasts"
```
Expected: no output. Then:

```bash
git rm apps/draw/src/Toasts.tsx apps/draw/src/Toasts.test.tsx apps/draw/src/Toasts.module.css
```

- [ ] **Step 2: Confirm draw still passes**

Run: `npx vitest run --project=draw`
Expected: PASS (Toasts.test.tsx no longer exists; nothing else referenced it).

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(draw): remove dead hand-rolled Toasts (superseded by @weasel-js/ui Toast)"
```

---

### Task 8: Containment guard + full verification

**Files:**
- Create: `packages/ui/src/components/Toast/containment.test.ts`

- [ ] **Step 1: Add a containment regression test**

The spec's hard rule ("no `UNSTABLE_` outside `Toast/`") gets a cheap guard so future edits can't silently violate it. `packages/ui/src/components/Toast/containment.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiSrc = join(dirname(fileURLToPath(import.meta.url)), '../..');

function* walk(dir: string): Generator<string> {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(entry)) yield p;
  }
}

describe('RAC unstable containment', () => {
  it('UNSTABLE_ imports appear only under components/Toast/', () => {
    const offenders = [...walk(uiSrc)].filter(
      (f) => !f.includes('/components/Toast/') && readFileSync(f, 'utf8').includes('UNSTABLE_'),
    );
    expect(offenders).toEqual([]);
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Toast/containment.test.ts`
Expected: PASS.

- [ ] **Step 2: Full release gate**

Run: `npm run prepublishOnly`
(This is `typecheck && test && build && test:smoke:consumer && build:demo` — the same gate CI runs.)
Expected: all green. Fix anything it surfaces before proceeding.

- [ ] **Step 3: Update docs/TODO.md**

If `docs/TODO.md` has an entry for tooltips/toasts/alerts, mark it done per the retention policy (delete the block if it has no open follow-ups). If none exists, add nothing.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/Toast/containment.test.ts docs/TODO.md
git commit -m "test(ui): guard RAC UNSTABLE_ containment to Toast folder"
```
