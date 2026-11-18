import { useAutoReports } from '../config/autoReports';
import { useOverAccess } from '../config/over';
import { useConfigSchema } from '../config/useConfigSchema';
import { useResolvedConfig } from '../config/useResolvedConfig';
import type { Instrument } from '../instrument/types';
import type { TrialRecord } from '../state/types';

/** The config trial `record` runs on, resolved against its instrument's schema, which everything in the trial reads;
 *  what the instrument reported for its auto paths, and the report; and its access to the schema it is drawn over.
 *  `record.config` is the panel's view, and reaches it through `record` on `TrialChrome`. */
export function useTrialConfig(instrument: Instrument, record: TrialRecord) {
  const schema = useConfigSchema(instrument);
  const { config, auto } = useResolvedConfig(schema, record.config, record.auto);
  const { reports, report } = useAutoReports(auto);
  const over = useOverAccess(schema.over);
  return { schema, config, reports, reportAuto: report, over };
}
