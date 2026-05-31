import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabList, Tab, TabPanel } from './Tabs';

const meta: Meta<typeof Tabs> = {
  title: 'Primitives/Tabs',
  component: Tabs,
};
export default meta;

type Story = StoryObj<typeof Tabs>;

export const Horizontal: Story = {
  render: () => (
    <Tabs>
      <TabList aria-label="Sections">
        <Tab id="props">Props</Tab>
        <Tab id="events">Events</Tab>
        <Tab id="snapshot">Snapshot</Tab>
      </TabList>
      <TabPanel id="props">Props panel.</TabPanel>
      <TabPanel id="events">Events panel.</TabPanel>
      <TabPanel id="snapshot">Snapshot panel.</TabPanel>
    </Tabs>
  ),
};

export const Vertical: Story = {
  render: () => (
    <Tabs orientation="vertical">
      <TabList aria-label="Sections">
        <Tab id="props">Props</Tab>
        <Tab id="events">Events</Tab>
        <Tab id="snapshot">Snapshot</Tab>
      </TabList>
      <TabPanel id="props">Props panel.</TabPanel>
      <TabPanel id="events">Events panel.</TabPanel>
      <TabPanel id="snapshot">Snapshot panel.</TabPanel>
    </Tabs>
  ),
};

export const WithDisabled: Story = {
  render: () => (
    <Tabs>
      <TabList aria-label="Sections">
        <Tab id="a">Available</Tab>
        <Tab id="b" isDisabled>Disabled</Tab>
        <Tab id="c">Available</Tab>
      </TabList>
      <TabPanel id="a">A.</TabPanel>
      <TabPanel id="b">B.</TabPanel>
      <TabPanel id="c">C.</TabPanel>
    </Tabs>
  ),
};
