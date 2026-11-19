import { useState, useSyncExternalStore } from 'react';
import { splitIconRef, type IconRef, type IconTable } from '@weasel-js/icons';
import { IconRegistryProvider, useIconRegistry } from '@weasel-js/icons/react';
import { icons as shapeIcons } from '@weasel-js/icons/shapes';
import { Button } from '@weasel-js/ui/components/Button';
import { Checkbox } from '@weasel-js/ui/components/Checkbox';
import { Icon } from '@weasel-js/ui/components/Icon';
import { icon } from '../icons.gen';
import s from './IconsDemo.module.css';

/** A table of the demo's own, published under a namespace of its own. */
const DEMO_ICONS: IconTable = {
  namespace: 'demo',
  owner: 'icons-demo',
  icons: {
    spark: { body: '<path d="M10 2.6V17.4M2.6 10H17.4M4.8 4.8L15.2 15.2M15.2 4.8L4.8 15.2"/>', group: 'Demo', tags: [] },
  },
};

const TABLES = [shapeIcons, DEMO_ICONS];

function Gallery() {
  const registry = useIconRegistry()!;
  useSyncExternalStore(registry.subscribe, registry.getVersion);
  const [picked, setPicked] = useState<IconRef>(icon('shape:diamond'));
  const [filled, setFilled] = useState(false);
  const parts = splitIconRef(picked)!;

  return (
    <div className={s.demo}>
      <div className={s.grid}>
        {registry.entries().map(({ ref }) => (
          <Button key={ref} variant="ghost" size="sm" iconOnly aria-label={ref} pressed={ref === picked} onClick={() => setPicked(ref)}>
            <Icon name={ref} filled={filled} />
          </Button>
        ))}
      </div>
      <div className={s.detail}>
        <Icon name={picked} size={96} filled={filled} />
        <code className={s.ref}>{picked}</code>
        <dl className={s.facts}>
          <dt>namespace</dt>
          <dd>{parts.namespace}</dd>
          <dt>name</dt>
          <dd>{parts.name}</dd>
          <dt>owner</dt>
          <dd>{registry.owner(parts.namespace)}</dd>
        </dl>
        <Checkbox isSelected={filled} onChange={setFilled}>filled</Checkbox>
      </div>
    </div>
  );
}

export function IconsDemo() {
  return (
    <IconRegistryProvider icons={TABLES}>
      <Gallery />
    </IconRegistryProvider>
  );
}
