import type { Meta, StoryObj } from '@weasel-js/forge';
import { useState } from 'react';
import { Header } from 'react-aria-components';
import { RailItem, RailList, RailListBox, RailName, RailOption, RailSection } from '@weasel-js/ui/components/RailList';

const meta: Meta<typeof RailList> = {
  title: 'ui/RailList',
  component: RailList,
};
export default meta;
type Story = StoryObj<typeof RailList>;

const PAGES = ['Canvas', 'Snapping', 'Import and export', 'A page whose name runs past the rail'];

/** Buttons a reader moves between, as a settings dialog's pages are: the open one is `aria-current`. */
export const Pages: Story = {
  render: function Render() {
    const [open, setOpen] = useState(PAGES[0]);
    return (
      <div style={{ width: 180 }}>
        <RailList aria-label="Pages">
          {PAGES.map((page) => (
            <RailItem key={page} current={page === open} onClick={() => setOpen(page)}>
              <RailName>{page}</RailName>
            </RailItem>
          ))}
        </RailList>
      </div>
    );
  },
};

const SECTIONS: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['Dialogs', ['Preferences', 'Export']],
  ['Menus', ['File', 'Edit', 'View']],
];

/** A listbox a reader selects from, its options under headings, each open section bracketed as a tree's branch is. */
export const Sections: Story = {
  render: function Render() {
    const [selected, setSelected] = useState('Export');
    return (
      <div style={{ width: 180 }}>
        <RailListBox aria-label="Assets" selectionMode="single" disallowEmptySelection selectedKeys={[selected]}
          onSelectionChange={(keys) => { if (keys !== 'all') setSelected(String([...keys][0])); }}>
          {SECTIONS.map(([title, ids]) => (
            <RailSection key={title} guide>
              <Header>{title}</Header>
              {ids.map((id) => (
                <RailOption key={id} id={id} textValue={id} current={id === selected}>
                  <RailName slot="label">{id}</RailName>
                </RailOption>
              ))}
            </RailSection>
          ))}
        </RailListBox>
      </div>
    );
  },
};
