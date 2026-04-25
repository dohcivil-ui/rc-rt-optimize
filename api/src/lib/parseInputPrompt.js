// parseInputPrompt.js -- System prompt + few-shot for /api/parse-input.
//
// English instructions for the model (Claude follows English better
// for structured tasks). Few-shot examples are Thai input -> tool_use
// output, teaching the model: Thai DOH defaults, confidence calibration,
// dot-notation missing_fields, and Thai reasoning text.
//
// IMPORTANT (Anthropic API contract): every `tool_use` block in the
// message history MUST be followed in the very next message by a
// `tool_result` block whose tool_use_id matches. We satisfy this by
// rolling the tool_result for example N into the user turn that opens
// example N+1, and by exporting wrapLiveTurn() so parseInput.js can
// build the live user turn with a tool_result for the last example.

var SYSTEM_PROMPT = [
  'You are an engineering assistant for the Thai Department of Highways (DOH).',
  'Your job: extract reinforced-concrete cantilever retaining wall design parameters from natural Thai language input, then call the extract_design_params tool exactly once.',
  '',
  'CONVENTIONS (Thai DOH standards, used throughout):',
  '- Heights and lengths: meters (m).',
  '- Unit weights gamma_soil, gamma_concrete: tons per cubic meter (t/m^3). NOT kN/m^3.',
  '- Soil internal friction angle phi: degrees.',
  '- Allowable bearing capacity qa: tons per square meter (t/m^2).',
  '- Concrete strength fc and steel yield fy: ksc (kgf/cm^2). NOT MPa.',
  '- Prices: Thai baht (THB). concretePrice per m^3, steelPrice per kg.',
  '',
  'DEFAULTS to apply when user does not specify a field:',
  '- H1 (soil above heel): 0.5 m',
  '- gamma_soil: 1.8 t/m^3 (normal soil)',
  '- gamma_concrete: 2.4 t/m^3 (Thai standard RC)',
  '- phi: 30 degrees (normal soil)',
  '- mu: 0.5 (footing-soil friction)',
  '- qa: 20 t/m^2 (typical bearing)',
  '- cover: 0.075 m (7.5 cm, Thai DOH cover)',
  '- material.fy: 4000 ksc (SD40 rebar)',
  '- material.fc: 240 ksc (typical Thai RC)',
  '- material.concretePrice: 2500 THB/m^3 (Maha Sarakham reference)',
  '- material.steelPrice: 28 THB/kg (Maha Sarakham reference)',
  '',
  'CONFIDENCE CALIBRATION:',
  '- "high": user gave H plus most other parameters explicitly. At most 2-3 minor defaults applied.',
  '- "medium": user gave H plus a few key parameters. Several defaults applied but soil/material context is implied.',
  '- "low": user only gave height (or less). Most parameters defaulted with no user signal.',
  '',
  'OUTPUT RULES:',
  '- Always populate every required field of parsed (no omissions).',
  '- missing_fields lists ONLY fields the user did not specify (dot notation: "material.fc"). If user gave everything, return [].',
  '- reasoning is one or two sentences in Thai explaining what was extracted vs defaulted.',
  '- Call extract_design_params exactly once. Do not produce text outside the tool call.'
].join('\n');

// Stable id for the last tool_use in FEW_SHOT_MESSAGES. parseInput.js
// references this when building the live user turn (tool_result must
// pair with this id). Exported so the value is not duplicated.
var LAST_TOOL_USE_ID = 'toolu_example_03';

// Helper for parseInput.js: builds the live user turn so that its
// tool_result satisfies the contract for LAST_TOOL_USE_ID, and the
// real user input rides as a text block in the same message.
function wrapLiveTurn(input) {
  return {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: LAST_TOOL_USE_ID, content: 'OK' },
      { type: 'text', text: input }
    ]
  };
}

// Few-shot examples in Anthropic Messages format. Pattern:
//   user(text) -> assistant(tool_use id=N) -> user(tool_result for N + text of next example) -> ...
// This way every tool_use is immediately followed by its tool_result,
// and the next example's prompt rides along as a text block in the
// same user turn. The final assistant turn ends with tool_use id=03;
// the live turn (built by wrapLiveTurn) provides tool_result for it.
var FEW_SHOT_MESSAGES = [
  // EXAMPLE 1: high confidence -- user gave most parameters
  {
    role: 'user',
    content: 'ออกแบบกำแพงกันดิน สูง 4 เมตร ดินมี phi 32 องศา gamma 1.9 แบบคอนกรีต fc 280 เหล็ก SD40'
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_example_01',
        name: 'extract_design_params',
        input: {
          parsed: {
            H: 4,
            H1: 0.5,
            gamma_soil: 1.9,
            gamma_concrete: 2.4,
            phi: 32,
            mu: 0.5,
            qa: 20,
            cover: 0.075,
            material: {
              fy: 4000,
              fc: 280,
              concretePrice: 2500,
              steelPrice: 28
            }
          },
          confidence: 'high',
          reasoning: 'ผู้ใช้ระบุพารามิเตอร์หลักครบ (H=4, phi=32, gamma=1.9, fc=280, SD40 = fy 4000) ใช้ค่าเริ่มต้นเฉพาะ H1, mu, qa, cover และราคาวัสดุ',
          missing_fields: ['H1', 'mu', 'qa', 'cover', 'material.concretePrice', 'material.steelPrice']
        }
      }
    ]
  },

  // EXAMPLE 2: medium confidence -- user gave height + general soil description
  // Rolled into a single user turn: tool_result for example 01 + text prompt for example 02.
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'toolu_example_01', content: 'OK' },
      { type: 'text', text: 'อยากได้กำแพง 3.5 เมตร ดินทั่วไป' }
    ]
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_example_02',
        name: 'extract_design_params',
        input: {
          parsed: {
            H: 3.5,
            H1: 0.5,
            gamma_soil: 1.8,
            gamma_concrete: 2.4,
            phi: 30,
            mu: 0.5,
            qa: 20,
            cover: 0.075,
            material: {
              fy: 4000,
              fc: 240,
              concretePrice: 2500,
              steelPrice: 28
            }
          },
          confidence: 'medium',
          reasoning: 'ผู้ใช้ระบุความสูง 3.5 ม. และบอกว่าดินทั่วไป จึงใช้ค่าเริ่มต้นมาตรฐาน DOH สำหรับดินปกติ (phi=30, gamma=1.8) และวัสดุพื้นฐาน (fc=240, SD40)',
          missing_fields: ['gamma_soil', 'gamma_concrete', 'phi', 'mu', 'qa', 'cover', 'material.fy', 'material.fc', 'material.concretePrice', 'material.steelPrice']
        }
      }
    ]
  },

  // EXAMPLE 3: low confidence -- user gave only height
  // Rolled into a single user turn: tool_result for example 02 + text prompt for example 03.
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'toolu_example_02', content: 'OK' },
      { type: 'text', text: 'กำแพง 5 เมตร' }
    ]
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_example_03',
        name: 'extract_design_params',
        input: {
          parsed: {
            H: 5,
            H1: 0.5,
            gamma_soil: 1.8,
            gamma_concrete: 2.4,
            phi: 30,
            mu: 0.5,
            qa: 20,
            cover: 0.075,
            material: {
              fy: 4000,
              fc: 240,
              concretePrice: 2500,
              steelPrice: 28
            }
          },
          confidence: 'low',
          reasoning: 'ผู้ใช้ระบุเพียงความสูงกำแพง 5 ม. ไม่มีข้อมูลดินหรือวัสดุ จึงใช้ค่าเริ่มต้นมาตรฐาน DOH ทั้งหมด ควรขอข้อมูลเพิ่มก่อนคำนวณจริง',
          missing_fields: ['H1', 'gamma_soil', 'gamma_concrete', 'phi', 'mu', 'qa', 'cover', 'material.fy', 'material.fc', 'material.concretePrice', 'material.steelPrice']
        }
      }
    ]
  }
];

module.exports = {
  SYSTEM_PROMPT: SYSTEM_PROMPT,
  FEW_SHOT_MESSAGES: FEW_SHOT_MESSAGES,
  LAST_TOOL_USE_ID: LAST_TOOL_USE_ID,
  wrapLiveTurn: wrapLiveTurn
};
