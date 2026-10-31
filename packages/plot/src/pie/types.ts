/** One slice: its label and value. */
export interface PieSlice {
  label: string;
  value: number;
}

/** A pie chart: a slice per value, in order clockwise from twelve o'clock, with a legend. */
export interface PieData {
  kind: 'pie';
  title?: string;
  /** Write each slice's value in the legend, where a text edit can change it. */
  showData?: boolean;
  slices: readonly PieSlice[];
}
