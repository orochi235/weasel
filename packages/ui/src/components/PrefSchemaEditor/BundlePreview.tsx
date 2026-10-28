import { bundleLoads } from './bundleChecks';
import { bundleIdOf, isBundleAt } from './bundleTree';
import { keysOf, nodeAt, pathOf, type SchemaRoot } from './schemaEdit';
import s from './BundlePreview.module.css';

/** The bundle at or above `lead`, by id. */
function bundleAround(root: SchemaRoot, lead: string | null): string | undefined {
  const keys = keysOf(lead);
  const path = keys.length < 2 ? null : pathOf(keys.slice(0, 2));
  if (path === null || !isBundleAt(root, path)) return undefined;
  return bundleIdOf(keys[1]!, nodeAt(root, path)!);
}

const KINDS = [['bundle', 'Bundles and atoms'], ['action', 'Actions'], ['tool', 'Tools']] as const;

/** What a canvas loading the selected bundle gets: every bundle and atom it reaches, and every action and tool those name. */
export function BundlePreview({ root, lead }: { root: SchemaRoot; lead: string | null }) {
  const id = bundleAround(root, lead);
  if (id === undefined) return <p className={s.empty}>Select a bundle to see what a canvas loading it gets.</p>;
  const { holders, names } = bundleLoads(root, id);
  const ids = { bundle: holders.slice(1), action: [] as string[], tool: [] as string[] };
  for (const name of names) {
    const [kind, ...rest] = name.split(':');
    if (kind === 'action' || kind === 'tool') ids[kind].push(rest.join(':'));
  }
  return (
    <section className={s.loads} aria-label="What it loads">
      <h3 className={s.title}>What {id} loads</h3>
      {KINDS.map(([kind, heading]) => ids[kind].length > 0 && (
        <div key={kind} className={s.part}>
          <h4 className={s.heading}>{heading}</h4>
          <ul className={s.ids}>{ids[kind].map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ))}
    </section>
  );
}
