export function stubRect(el: Element, rect: Partial<DOMRect> = {}) {
  const full: DOMRect = { x: 0, y: 0, width: 200, height: 24, top: 0, left: 0, right: 200, bottom: 24, toJSON: () => ({}), ...rect };
  (el as HTMLElement).getBoundingClientRect = () => full;
}
