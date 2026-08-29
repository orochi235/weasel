import type { ConfigField } from '../controls/types';

/** Whether a config schema is usable, and every problem found rather than
 *  just the first. */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Check a config schema for the mistakes that would otherwise surface as a
 *  silently broken control: empty or duplicate keys, and fields whose own
 *  constraints do not hold.
 *
 *  An unrecognized type is not an error — a lab supplies controls for its own
 *  kinds through `ControlPanel`'s `renderers`, and this cannot see them. Such
 *  a field simply has no constraints to check here. */
export function validateConfigSchema(fields: ConfigField[]): ValidationResult {
  const errors: string[] = [];
  const seenKeys = new Set<string>();

  for (const field of fields) {
    if (field.key === '') {
      errors.push('Field has empty key');
    } else if (seenKeys.has(field.key)) {
      errors.push(`Duplicate config key: "${field.key}"`);
    } else {
      seenKeys.add(field.key);
    }

    if (field.label === '') {
      errors.push(`Field "${field.key}" has empty label`);
    }

    if (field.type === 'slider') {
      if (!Number.isFinite(field.default)) {
        errors.push(`Field "${field.key}": default must be a finite number`);
      }
      if (field.min >= field.max) {
        errors.push(`Slider "${field.key}": min must be < max`);
      } else if (field.default < field.min || field.default > field.max) {
        errors.push(`Slider "${field.key}": default ${field.default} is outside [min, max]`);
      }
    } else if (field.type === 'number') {
      if (!Number.isFinite(field.default)) {
        errors.push(`Field "${field.key}": default must be a finite number`);
      }
    } else if (field.type === 'select') {
      if (field.options.length === 0) {
        errors.push(`Select "${field.key}": options array must not be empty`);
      } else {
        const seenValues = new Set<string>();
        for (const opt of field.options) {
          if (seenValues.has(opt.value)) {
            errors.push(`Select "${field.key}": duplicate option value "${opt.value}"`);
          } else {
            seenValues.add(opt.value);
          }
        }
        if (!seenValues.has(field.default)) {
          errors.push(`Select "${field.key}": default "${field.default}" is not among options`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
