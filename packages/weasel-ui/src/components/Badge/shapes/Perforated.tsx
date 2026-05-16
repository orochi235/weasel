import { useId } from 'react';
import type { ShapeModule } from '../types';

const COUNT = 14;
const R = 3;

function notchCircles() {
  const c: { cx: number; cy: number }[] = [];
  for (let i = 0; i < COUNT; i++) {
    const t = (i + 0.5) / COUNT;
    c.push({ cx: t * 100, cy: 0 });
    c.push({ cx: t * 100, cy: 100 });
  }
  for (let i = 0; i < COUNT; i++) {
    const t = (i + 0.5) / COUNT;
    c.push({ cx: 0, cy: t * 100 });
    c.push({ cx: 100, cy: t * 100 });
  }
  return c;
}

const NOTCHES = notchCircles();

const Perforated: ShapeModule = {
  Component: ({ variant, focused }) => {
    const maskId = useId();
    return (
      <>
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110">
            <rect x="0" y="0" width="100" height="100" fill="white" />
            {NOTCHES.map((n, i) => (
              <circle key={i} cx={n.cx} cy={n.cy} r={R} fill="black" />
            ))}
          </mask>
        </defs>
        {(variant === 'solid' || variant === 'subtle') && (
          <rect className="badge-fill" x="0" y="0" width="100" height="100" mask={`url(#${maskId})`} />
        )}
        {(variant === 'outline' || variant === 'solid') && (
          <rect className="badge-stroke" x="0" y="0" width="100" height="100" mask={`url(#${maskId})`} />
        )}
        {focused && (
          <rect className="badge-focus" x="-4" y="-4" width="108" height="108" mask={`url(#${maskId})`} />
        )}
      </>
    );
  },
  insets: { top: 2, right: 4, bottom: 2, left: 4 },
  stretches: true,
};

export default Perforated;
