import type { IconRef } from '@weasel-js/icons';
import { Icon } from '@weasel-js/ui/components/Icon';
import { ToggleBar, type ToggleBarItem } from '@weasel-js/ui/components/ToggleBar';
import { TOKEN_CATEGORIES, type TokenCategory } from '@weasel-js/ui/components/TokenPanel';
import { useEffect, useRef, useState } from 'react';
import { icon } from '../../icons.gen';

const ICONS: Record<TokenCategory, IconRef> = {
  color: icon('ui:drop'),
  type: icon('ui:type'),
  size: icon('core:measure'),
  motion: icon('ui:curveEaseInOut'),
  depth: icon('ui:layers'),
  other: icon('ui:more'),
};

const PANEL = '.fg-css-vars';
const HOST = '.lk-sidebar-section, .lk-panel-tile';
const MANUAL = ['wheel', 'touchmove', 'keydown'] as const;

const LIST = '.fg-css-vars__list';

/** The top of the list's own scroller, which is the line a section counts as reached at. */
function readLine(panel: Element): number {
  return (panel.querySelector(LIST) ?? panel).getBoundingClientRect().top;
}

function sectionsOf(panel: Element): HTMLElement[] {
  return [...panel.querySelectorAll<HTMLElement>('[data-token-category]')];
}

/** The CSS Vars panel's sections as a row of icons: picks one to scroll to it, and lights the one at the top. */
export function SectionJump() {
  const ref = useRef<HTMLDivElement>(null);
  const [present, setPresent] = useState<readonly TokenCategory[]>([]);
  const [current, setCurrent] = useState<TokenCategory | null>(null);
  // A picked section stays lit until the reader scrolls by hand: near the end of the list it cannot reach the top.
  const held = useRef(false);

  useEffect(() => {
    // The section holding this bar holds the panel too, docked or torn out, and outlives a remount of the panel.
    const root = ref.current?.closest(HOST) ?? document.body;
    const read = () => {
      const panel = root.querySelector(PANEL);
      const sections = panel ? sectionsOf(panel) : [];
      setPresent(sections.map((s) => s.dataset.tokenCategory as TokenCategory));
      if (!panel || held.current) return;
      const line = readLine(panel) + 1;
      let top = sections[0]?.dataset.tokenCategory as TokenCategory | undefined;
      for (const s of sections) if (s.getBoundingClientRect().top <= line) top = s.dataset.tokenCategory as TokenCategory;
      setCurrent(top ?? null);
    };
    const release = () => {
      held.current = false;
    };
    read();
    const observer = new MutationObserver(read);
    observer.observe(root, { childList: true, subtree: true });
    // Capturing, so a scroll anywhere above the panel reaches it whichever box ends up scrolling.
    document.addEventListener('scroll', read, { capture: true, passive: true });
    for (const type of MANUAL) document.addEventListener(type, release, { capture: true, passive: true });
    return () => {
      observer.disconnect();
      document.removeEventListener('scroll', read, { capture: true });
      for (const type of MANUAL) document.removeEventListener(type, release, { capture: true });
    };
  }, []);

  const items: ToggleBarItem<TokenCategory>[] = TOKEN_CATEGORIES.map(({ id, title }) => ({
    value: id,
    label: <Icon name={ICONS[id]} size={14} />,
    ariaLabel: title,
    tooltip: title,
    disabled: !present.includes(id),
  }));

  const jump = (next: TokenCategory | null) => {
    const panel = ref.current?.closest(HOST)?.querySelector(PANEL);
    const target = next && panel?.querySelector(`[data-token-category="${next}"]`);
    const scroller = panel?.querySelector(LIST);
    if (!panel || !target || !scroller) return;
    held.current = true;
    setCurrent(next);
    scroller.scrollTop += target.getBoundingClientRect().top - readLine(panel);
  };

  return (
    <div ref={ref} className="fg-css-vars__jump">
      <ToggleBar ariaLabel="Jump to section" variant="flat" size="sm" items={items} value={current} onChange={jump} />
    </div>
  );
}
