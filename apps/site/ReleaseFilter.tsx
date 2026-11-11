import num from '@weasel-js/theme/numeric.module.css';
import { Button } from '@weasel-js/ui/components/Button';
import { type Filter, type Tag, TAGS } from '../shared/releases';

/** The package chips and the tag chips, each with how many entries carry it, and All. */
export function ReleaseFilter({
  filter,
  packageCounts,
  tagCounts,
  onTogglePackage,
  onToggleTag,
  onClear,
}: {
  filter: Filter;
  packageCounts: readonly (readonly [string, number])[];
  tagCounts: readonly (readonly [Tag, number])[];
  onTogglePackage: (name: string) => void;
  onToggleTag: (tag: Tag) => void;
  onClear: () => void;
}) {
  return (
    <>
      <div className="ckd-release-filter" role="group" aria-label="Filter by package">
        <Button size="sm" pressed={filter.packages.length === 0 && filter.tags.length === 0} onClick={onClear}>
          All
        </Button>
        {packageCounts.map(([name, count]) => (
          <Button key={name} size="sm" pressed={filter.packages.includes(name)} onClick={() => onTogglePackage(name)}>
            {name}
            <span className={`ckd-release-pkg-n ${num.numeric}`}>{count}</span>
          </Button>
        ))}
      </div>
      <div className="ckd-release-filter" role="group" aria-label="Filter by kind of change">
        {tagCounts.map(([tag, count]) => (
          <Button
            key={tag}
            size="sm"
            pressed={filter.tags.includes(tag)}
            onClick={() => onToggleTag(tag)}
            tooltip={TAGS[tag]}
          >
            {tag}
            <span className={`ckd-release-pkg-n ${num.numeric}`}>{count}</span>
          </Button>
        ))}
      </div>
    </>
  );
}

/** "12 changes in core, geom · tagged fix", or nothing when unfiltered. */
export function describeFilter(filter: Filter, matched: number): string | null {
  if (filter.packages.length === 0 && filter.tags.length === 0) return null;
  const parts = [`${matched} ${matched === 1 ? 'change' : 'changes'}`];
  if (filter.packages.length) parts.push(`in ${filter.packages.join(', ')}`);
  const head = parts.join(' ');
  return filter.tags.length ? `${head} · tagged ${filter.tags.join(' or ')}` : head;
}
