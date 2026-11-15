import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState, type KeyboardEvent } from 'react';
import { Button } from '@weasel-js/ui/components/Button';
import s from './Button.native.stories.module.css';

const meta: Meta<typeof Button> = {
  title: 'ui/Button',
  component: Button,
};
export default meta;

type Story = StoryObj<typeof Button>;

/** A custom disclosure: `aria-expanded` and `aria-controls` pass through to the `<button>`. */
export const DisclosureTrigger: Story = {
  render: () => {
    function Section() {
      const [open, setOpen] = useState(false);
      return (
        <div className={s.stack}>
          <Button variant="ghost" aria-expanded={open} aria-controls="native-details" onClick={() => setOpen(!open)}>
            {open ? 'Hide details' : 'Show details'}
          </Button>
          <div id="native-details" hidden={!open}>The panel the button controls.</div>
        </div>
      );
    }
    return <Section />;
  },
};

const ALIGN = ['Left', 'Center', 'Right'];

/** Members of a toolbar with a roving tab stop: `tabIndex` and `onKeyDown` pass through. */
export const RovingToolbar: Story = {
  render: () => {
    function Toolbar() {
      const [stop, setStop] = useState(0);
      const rove = (i: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
        const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (step === 0) return;
        const next = (i + step + ALIGN.length) % ALIGN.length;
        setStop(next);
        (e.currentTarget.parentElement?.children[next] as HTMLElement | undefined)?.focus();
      };
      return (
        <div role="toolbar" aria-label="Align" className={s.row}>
          {ALIGN.map((name, i) => (
            <Button key={name} size="sm" tabIndex={i === stop ? 0 : -1} onKeyDown={rove(i)}>{name}</Button>
          ))}
        </div>
      );
    }
    return <Toolbar />;
  },
};

/** A submitter outside its form: `form`, `name`, and `value` pass through. */
export const FormSubmitter: Story = {
  render: () => {
    function Order() {
      const [sent, setSent] = useState<string>('nothing yet');
      return (
        <div className={s.stack}>
          <form
            id="native-order"
            onSubmit={(e) => {
              e.preventDefault();
              const by = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              setSent(`${by?.name}=${by?.value}`);
            }}
          />
          <div className={s.row}>
            <Button type="submit" form="native-order" name="intent" value="save">Save</Button>
            <Button type="submit" form="native-order" name="intent" value="discard" variant="ghost">Discard</Button>
          </div>
          <span>Submitted: {sent}</span>
        </div>
      );
    }
    return <Order />;
  },
};
