/** Matches a tool button's accessible name, which starts with the tool's name and may go on with its shortcut. */
export const toolButtonName = (name: string): RegExp => new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
