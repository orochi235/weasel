import type { ShapeModule } from '../types';

function notchedPath(r = 14) {
  const W = 100, H = 100;
  return [
    `M ${r} 0`,
    `L ${W - r} 0`,
    `A ${r} ${r} 0 0 0 ${W} ${r}`,
    `L ${W} ${H - r}`,
    `A ${r} ${r} 0 0 0 ${W - r} ${H}`,
    `L ${r} ${H}`,
    `A ${r} ${r} 0 0 0 0 ${H - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

const d = notchedPath();

const Notched: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <path className="badge-fill" d={d} />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <path className="badge-stroke" d={d} />
      )}
      {focused && <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />}
    </>
  ),
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
  stretches: true,
};

export default Notched;
