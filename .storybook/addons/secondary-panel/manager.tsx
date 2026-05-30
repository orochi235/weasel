/**
 * Secondary Panel addon — manager-side only.
 *
 * Adds a toolbar button that opens a dropdown of all registered addon
 * panels (Controls, Actions, CSS Vars, etc.). Picking one pins it to a
 * fixed-position column on the right side of the canvas, ~320px wide,
 * full canvas height. The chosen addon's `render({ active: true })` is
 * mounted inside the secondary panel, so you can see Controls and CSS
 * Vars (or any pair) simultaneously without tab-switching.
 *
 * Persistence: pinned addon id is stored in localStorage under
 * `weasel:secondary-panel:addonId` and restored on manager load.
 *
 * Rendering strategy: the addon registers one TOOL entry. The Tool
 * component owns both the toolbar UI (button + dropdown) and — via a
 * `createPortal` to document.body — the floating secondary panel. This
 * keeps the panel outside Storybook's flex layout so we don't disturb
 * the existing canvas/main-panel arrangement.
 */
import React from 'react';
import { createPortal } from 'react-dom';
import { addons, types } from 'storybook/manager-api';
import { IconButton } from 'storybook/internal/components';

const ADDON_ID = 'weasel/secondary-panel';
const TOOL_ID = `${ADDON_ID}/tool`;
const STORAGE_KEY = 'weasel:secondary-panel:addonId';

/** Width of the floating panel. Not user-resizable in v1. */
const PANEL_WIDTH = 320;
/** Distance from viewport top — clears Storybook's toolbar (~40px). */
const PANEL_TOP = 40;

interface PanelDescriptor {
  readonly id: string;
  readonly title: string;
  readonly render: (props: { active: boolean; key: string }) => React.ReactNode;
}

function loadPinned(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function savePinned(id: string | null): void {
  if (typeof localStorage === 'undefined') return;
  try {
    if (id == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* quota — non-fatal */
  }
}

/**
 * Resolve a title that's safe to render — Storybook lets panels declare
 * `title` as a string OR a function returning ReactNode. We coerce to a
 * ReactNode either way.
 */
function resolveTitle(raw: unknown): React.ReactNode {
  if (typeof raw === 'function') {
    try {
      return (raw as () => React.ReactNode)();
    } catch {
      return '(panel)';
    }
  }
  if (raw == null || raw === '') return '(panel)';
  return raw as React.ReactNode;
}

/**
 * Pull all currently-registered PANEL addons out of the registry. We
 * read this lazily (in a useState initializer + on dropdown-open) rather
 * than subscribing — the panel set is stable after Storybook boot.
 */
function listPanels(): PanelDescriptor[] {
  const panels = addons.getElements(types.PANEL) as Record<
    string,
    { id?: string; title?: unknown; render?: PanelDescriptor['render'] }
  >;
  const out: PanelDescriptor[] = [];
  for (const id of Object.keys(panels)) {
    const p = panels[id];
    if (!p || typeof p.render !== 'function') continue;
    const titleNode = resolveTitle(p.title);
    // For the dropdown label we want a string. Stringify ReactNode best-effort.
    const titleStr =
      typeof titleNode === 'string' || typeof titleNode === 'number'
        ? String(titleNode)
        : id;
    out.push({ id, title: titleStr, render: p.render });
  }
  out.sort((a, b) => a.title.localeCompare(b.title));
  return out;
}

/**
 * CSS that hides the pinned panel's tab + tabpanel in the main addon
 * area, so the same panel isn't visible in two places. Storybook renders
 * each panel inside a react-aria tab with an `id` ending in
 * `-tab-<panelId>` (and `-tabpanel-<panelId>` for the content), which
 * gives us a stable hook with no monkey-patching.
 *
 * `id` attribute selectors with quoted values pass `/` literally, so the
 * full panel id (e.g. `weasel/css-vars/panel`) works as-is.
 */
function HidePinnedTabStyle({ pinnedId }: { readonly pinnedId: string }): React.ReactElement {
  const css = `
    [id$="-tab-${pinnedId}"],
    [id$="-tabpanel-${pinnedId}"] { display: none !important; }
  `;
  return <style>{css}</style>;
}

interface SecondaryPanelProps {
  readonly descriptor: PanelDescriptor;
  readonly onClose: () => void;
}

function SecondaryPanel({ descriptor, onClose }: SecondaryPanelProps): React.ReactElement {
  return (
    <div
      style={{
        position: 'fixed',
        top: PANEL_TOP,
        right: 0,
        bottom: 0,
        width: PANEL_WIDTH,
        background: '#11141a',
        borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 10,
        color: '#e6e7e9',
        fontFamily:
          '"Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
        boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.3)',
      }}
      data-weasel-secondary-panel=""
    >
      <div
        style={{
          height: 32,
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 12px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          opacity: 0.85,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {descriptor.title}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close secondary panel"
          title="Close secondary panel"
          style={{
            width: 22,
            height: 22,
            border: 'none',
            borderRadius: 3,
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            opacity: 0.7,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {descriptor.render({ active: true, key: `secondary:${descriptor.id}` })}
      </div>
    </div>
  );
}

interface DropdownProps {
  readonly panels: readonly PanelDescriptor[];
  readonly currentId: string | null;
  readonly onPick: (id: string | null) => void;
  readonly onClose: () => void;
  readonly anchorRef: React.RefObject<HTMLDivElement | null>;
}

function Dropdown({ panels, currentId, onPick, onClose, anchorRef }: DropdownProps): React.ReactElement {
  const ref = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node | null;
      if (ref.current?.contains(target ?? null)) return;
      if (anchorRef.current?.contains(target ?? null)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer to next tick so the click that opened us doesn't close us.
    const t = window.setTimeout(() => {
      document.addEventListener('mousedown', onDocClick);
    }, 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  const anchorRect = anchorRef.current?.getBoundingClientRect();
  const top = anchorRect ? anchorRect.bottom + 4 : 40;
  const left = anchorRect ? anchorRect.left : 8;

  return createPortal(
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'fixed',
        top,
        left,
        minWidth: 200,
        background: '#11141a',
        border: '1px solid rgba(255, 255, 255, 0.12)',
        borderRadius: 4,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.4)',
        padding: '4px 0',
        zIndex: 20,
        color: '#e6e7e9',
        fontFamily:
          '"Nunito Sans", -apple-system, ".SFNSText-Regular", "San Francisco", BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif',
        fontSize: 12,
      }}
    >
      {panels.length === 0 ? (
        <div style={{ padding: '6px 12px', opacity: 0.7, fontStyle: 'italic' }}>
          No addon panels registered.
        </div>
      ) : (
        panels.map((p) => {
          const isCurrent = p.id === currentId;
          return (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={isCurrent}
              onClick={() => {
                onPick(p.id);
                onClose();
              }}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '6px 12px',
                border: 'none',
                background: isCurrent ? 'rgba(30, 167, 253, 0.2)' : 'transparent',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: isCurrent ? 600 : 400,
              }}
              onMouseEnter={(e) => {
                if (!isCurrent) e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
              }}
              onMouseLeave={(e) => {
                if (!isCurrent) e.currentTarget.style.background = 'transparent';
              }}
            >
              {p.title}
            </button>
          );
        })
      )}
      {currentId != null && (
        <>
          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
          <button
            type="button"
            onClick={() => {
              onPick(null);
              onClose();
            }}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '6px 12px',
              border: 'none',
              background: 'transparent',
              color: 'inherit',
              cursor: 'pointer',
              fontSize: 12,
              opacity: 0.8,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            Unpin
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

/** Pin icon (16×16) — sits next to the dropdown label. */
function PinIcon(): React.ReactElement {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M10 1.5 14.5 6 11 7l-1 3-4-4-3 1 1-3-4-4 1-1 4 4 3-1L10 1.5Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Tool(): React.ReactElement | null {
  const [pinnedId, setPinnedId] = React.useState<string | null>(() => loadPinned());
  const [open, setOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement | null>(null);
  // `setPanelsTick` is only used to force a re-render; the value itself is
  // never read. Avoid `useMemo` here — Storybook's toolbar mounts/unmounts
  // tool components in a way that trips React's deps-array comparison and
  // throws "Cannot read .length of undefined" on the second render. Plain
  // function calls (the panel registry is tiny) sidestep the bug.
  const [, setPanelsTick] = React.useState(0);
  const panels = listPanels();
  const pinnedDescriptor = pinnedId ? panels.find((p) => p.id === pinnedId) ?? null : null;

  // If we have a pinned id from localStorage but the registry hasn't filled
  // in yet (panels register async), retry a few times after mount.
  React.useEffect(() => {
    if (pinnedId && !pinnedDescriptor) {
      let cancelled = false;
      const tries = [50, 150, 400, 1000];
      tries.forEach((delay) => {
        window.setTimeout(() => {
          if (!cancelled) setPanelsTick((n) => n + 1);
        }, delay);
      });
      return () => {
        cancelled = true;
      };
    }
    return undefined;
  }, [pinnedId, pinnedDescriptor]);

  const handlePick = React.useCallback((id: string | null) => {
    setPinnedId(id);
    savePinned(id);
  }, []);

  const handleOpen = React.useCallback(() => {
    setPanelsTick((n) => n + 1);
    setOpen((v) => !v);
  }, []);

  const label = pinnedDescriptor ? pinnedDescriptor.title : 'Pin panel';

  return (
    <>
      <div ref={anchorRef} style={{ display: 'inline-flex', alignItems: 'center' }}>
        <IconButton
          key="weasel-secondary-panel-button"
          title="Pin an addon panel to the right side"
          onClick={handleOpen}
          active={pinnedId != null}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <PinIcon />
            <span style={{ fontSize: 12 }}>{label}</span>
          </span>
        </IconButton>
      </div>
      {open && (
        <Dropdown
          panels={panels}
          currentId={pinnedId}
          onPick={handlePick}
          onClose={() => setOpen(false)}
          anchorRef={anchorRef}
        />
      )}
      {pinnedDescriptor &&
        createPortal(
          <>
            <HidePinnedTabStyle pinnedId={pinnedDescriptor.id} />
            <SecondaryPanel descriptor={pinnedDescriptor} onClose={() => handlePick(null)} />
          </>,
          document.body,
        )}
    </>
  );
}

addons.register(ADDON_ID, () => {
  addons.add(TOOL_ID, {
    type: types.TOOL,
    title: 'Secondary panel',
    // Show in story view only — matches main panel availability.
    match: ({ viewMode }) => viewMode === 'story',
    render: () => <Tool />,
  });
});
