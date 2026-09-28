import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SceneCanvas, WeaselProvider, useScene, useSelection } from '@weasel-js/core';
import {
  parseSvg,
  serializeSvg,
  svgNodesFromKit,
  svgNodesToKitDrafts,
  type SvgKitLeafData,
  type SvgKitPose,
} from '@weasel-js/svg';
import s from './SvgDemo.module.css';

const W = 420, H = 320;
const VIEW = { x: 0, y: 0, width: W, height: H };

type LayerId = 'default';

const PRESETS: { name: string; svg: string }[] = [
  {
    name: 'Shapes',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 320">
  <rect x="30" y="40" width="140" height="90" rx="12" fill="#7fb069"/>
  <circle cx="290" cy="90" r="55" fill="#d4a574" stroke="#1a130d" stroke-width="4"/>
  <polygon points="110,190 140,280 60,225 160,225 80,280" fill="#a48bd4"/>
  <ellipse cx="300" cy="240" rx="80" ry="40" fill="none" stroke="#7ab8d4"
    stroke-width="6" stroke-dasharray="14 8"/>
</svg>`,
  },
  {
    name: 'Group + gradient',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 320">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7ab8d4"/>
      <stop offset="1" stop-color="#a48bd4"/>
    </linearGradient>
  </defs>
  <rect x="20" y="20" width="380" height="140" fill="url(#sky)"/>
  <g transform="translate(210 200) rotate(-8)">
    <rect x="-90" y="-30" width="180" height="60" fill="#d47a7a"/>
    <circle cx="-50" cy="45" r="22" fill="#1a130d"/>
    <circle cx="50" cy="45" r="22" fill="#1a130d"/>
  </g>
</svg>`,
  },
  {
    name: 'Curves + text',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 420 320">
  <path d="M40 220 C 100 60, 200 60, 240 160 S 360 280, 390 120"
    fill="none" stroke="#7fb069" stroke-width="8" stroke-linecap="round"/>
  <path d="M60 60 Q 110 10 160 60 T 260 60 L 260 110 L 60 110 Z" fill="#d4a574"/>
  <text x="40" y="270" font-size="28" fill="#1a130d">round trip</text>
</svg>`,
  },
];

/** Parse a source string and lower it to a scene snapshot — one node per
 *  draft, in the parent-before-child order the drafts arrive in. */
function sceneFromSvg(source: string) {
  const parsed = parseSvg(source);
  let seq = 0;
  const drafts = svgNodesToKitDrafts(parsed, () => `svg-${seq++}`);
  return {
    parsed,
    json: {
      version: 1 as const,
      systemLayers: [{ id: 'default' as const }],
      nodes: drafts.map((d) => ({
        id: d.id,
        kind: d.kind,
        layer: 'default' as const,
        pose: d.pose,
        data: (d.kind === 'leaf' ? d.data : {}) as SvgKitLeafData,
        ...(d.parentId ? { parent: d.parentId } : {}),
      })),
    },
  };
}

/**
 * SVG in, scene nodes, SVG out.
 *
 * The source is parsed with `parseSvg` and lowered by `svgNodesToKitDrafts`
 * into leaves the kit's own painters draw, loaded into an ordinary scene. The
 * select tool edits that scene, and the output is `serializeSvg` over
 * `svgNodesFromKit(scene)` — so a drag shows up as changed coordinates.
 */
export function SvgDemo() {
  return <WeaselProvider><SvgRoundTrip /></WeaselProvider>;
}

function SvgRoundTrip() {
  const [source, setSource] = useState(PRESETS[0].svg);
  const scene = useScene<SvgKitLeafData, LayerId, SvgKitPose>({ systemLayers: [{ id: 'default' }] });
  const selection = useSelection({ mode: 'multi' });

  const imported = useMemo(() => {
    try {
      return sceneFromSvg(source);
    } catch (err) {
      return { error: String(err) };
    }
  }, [source]);

  // `selection` is a fresh object each render, so only a new source reloads.
  useEffect(() => {
    if (!('json' in imported)) return;
    selection.set([]);
    scene.loadState(imported.json);
  }, [scene, imported]); // eslint-disable-line react-hooks/exhaustive-deps

  const version = useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);
  const exported = useMemo(() => {
    const warnings: string[] = [];
    const nodes = svgNodesFromKit(scene);
    const viewBox = ('parsed' in imported && imported.parsed.viewBox) || VIEW;
    const text = serializeSvg(nodes, { viewBox, pretty: true, onWarn: (m) => warnings.push(m) });
    return { text, warnings };
    // `version` is the scene's change signal; the scene object itself is stable.
  }, [scene, imported, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const importWarnings = 'parsed' in imported ? imported.parsed.warnings : [imported.error];

  return (
    <div className={s.demo}>
      <div className={s.top}>
        <div className={s.source}>
          <div className={s.presets}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className="ckd-btn"
                aria-pressed={source === p.svg}
                onClick={() => setSource(p.svg)}
              >
                {p.name}
              </button>
            ))}
          </div>
          <textarea
            className={s.code}
            spellCheck={false}
            aria-label="SVG source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
          <Warnings label="parseSvg" items={importWarnings} />
        </div>
        <SceneCanvas
          features={['pick', 'move', 'transform']}
          width={W}
          height={H}
          className="ckd-canvas"
          backgroundFill={{ color: '#ffffff' }}
          scene={scene}
          selection={selection}
          selectionMode="multi"
        />
      </div>
      <div className={s.output}>
        <div className={s.heading}>serializeSvg</div>
        <pre className={s.code}>{exported.text}</pre>
        <Warnings label="serializeSvg" items={exported.warnings} />
      </div>
    </div>
  );
}

function Warnings({ label, items }: { label: string; items: readonly string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className={s.warnings} aria-label={`${label} warnings`}>
      {items.map((w, i) => <li key={i}>{w}</li>)}
    </ul>
  );
}
