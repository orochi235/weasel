import type { ConfigField, ConfigFieldType } from '../controls/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const KNOWN_TYPES: ConfigFieldType[] = ['slider', 'checkbox', 'select', 'number', 'text', 'color'];

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

    if (!KNOWN_TYPES.includes(field.type)) {
      errors.push(`Unknown field type: "${field.type}" on key "${field.key}"`);
      continue;
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
