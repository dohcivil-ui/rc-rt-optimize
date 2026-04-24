// Translates English validation error strings from POST /api/optimize
// into Thai user-facing messages. Falls back to the raw English string
// when no pattern matches, so unknown errors still surface visibly.

// Field path (as sent by API) -> Thai label shown to the user.
const FIELD_TH: Record<string, string> = {
  'H': 'ความสูงรวม (H)',
  'H1': 'ความสูงดินหน้ากำแพง (H1)',
  'gamma_soil': 'หน่วยน้ำหนักดิน',
  'gamma_concrete': 'หน่วยน้ำหนักคอนกรีต',
  'phi': 'มุมเสียดทานภายในดิน',
  'mu': 'สัมประสิทธิ์เสียดทานฐาน',
  'qa': 'กำลังรับน้ำหนักดิน',
  'cover': 'ระยะหุ้มเหล็ก',
  'material.fy': 'กำลังครากเหล็ก (fy)',
  'material.fc': "กำลังคอนกรีต (f'c)",
  'material.concretePrice': 'ราคาคอนกรีต',
  'material.steelPrice': 'ราคาเหล็ก',
};

// Pattern: "<field> must be in range [<min>, <max>]"
const RANGE_RE = /^(\S+) must be in range \[([\d.]+), ([\d.]+)\]$/;

// Pattern: "<field> is required"
const REQUIRED_RE = /^(\S+) is required$/;

// Pattern: "<field> must be a number"
const NUMBER_RE = /^(\S+) must be a number$/;

const labelOf = (field: string): string => FIELD_TH[field] ?? field;

export const translateValidationError = (raw: string): string => {
  const range = RANGE_RE.exec(raw);
  if (range) {
    const [, field, min, max] = range;
    return labelOf(field) + ' ต้องอยู่ระหว่าง ' + min + ' ถึง ' + max;
  }
  const required = REQUIRED_RE.exec(raw);
  if (required) {
    return 'ต้องระบุ' + labelOf(required[1]);
  }
  const number = NUMBER_RE.exec(raw);
  if (number) {
    return labelOf(number[1]) + ' ต้องเป็นตัวเลข';
  }
  // Fallback: surface raw English so unknown errors are still visible.
  return raw;
};
