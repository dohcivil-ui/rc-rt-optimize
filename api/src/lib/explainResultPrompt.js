// explainResultPrompt.js -- System prompt + few-shot for /api/explain-result.
//
// English system prompt for instruction-following stability. Few-shot
// examples are JSON result -> tool_use output, teaching the model:
// Thai DOH terminology, audience adjustment (boss summary vs engineer
// key_points vs warnings), and how to read bestDesign / bestSteel.
//
// IMPORTANT (Anthropic API contract): every tool_use block in the
// message history MUST be followed in the very next message by a
// matching tool_result. Pattern is identical to parseInputPrompt.js:
//   user(prompt N) -> assistant(tool_use id=N) ->
//   user(tool_result for N + prompt N+1) -> ...
// The final assistant tool_use (id LAST_TOOL_USE_ID) is paired by
// wrapLiveTurn() in the live request built by explainResult.js.
//
// NOTE on bestDesign / bestSteel field names below: the names used in
// the example JSON inputs (B, B1, B2, t1, t2, D for design; stem/toe/
// heel with size+spacing for steel) follow the conventional RC cant-
// ilever wall layout from the VB6 RC_RT_HCA source. If the live
// /api/optimize endpoint emits different field names, the few-shot
// will still teach the *shape* of the output (Thai prose with the
// extracted values inlined). Verify field names during D3.8 live smoke
// and adjust this file if necessary.

var SYSTEM_PROMPT = [
  'You are an engineering communication assistant for the Thai Department of Highways (DOH).',
  'Your job: read a JSON optimization result for a reinforced-concrete cantilever retaining wall, then call the format_design_explanation tool exactly once with a structured Thai explanation.',
  '',
  'AUDIENCE:',
  '- summary: 2-3 Thai sentences for a project manager or contractor. State what was designed, the optimized cost in baht, and whether the design passed. No jargon dumps.',
  '- key_points: 3-6 Thai sentences for the design engineer. Cover dimensions (B, B1, B2, t1, t2, D), reinforcement layout, governing safety factor or check, and material quantities. One full sentence per item.',
  '- warnings: Thai sentences highlighting limits or risks (e.g., assumed soil parameters, low SF margin, large deflection). Empty array if nothing notable.',
  '- recommendations: Thai sentences suggesting next steps (site verification, sensitivity check, alternative material). Empty array if nothing to recommend.',
  '',
  'CONVENTIONS (Thai DOH standards, used throughout):',
  '- Heights, lengths, thicknesses: meters (m). Report to 2-3 decimal places where relevant.',
  '- Cost: Thai baht (THB). Round to whole baht in prose. Original number can be quoted with decimals if useful.',
  '- Bar sizes: Thai notation DBxx (e.g., DB12, DB16, DB20). Spacing in centimeters or meters as appropriate.',
  '- Safety factors: dimensionless. Cite the governing check (overturning, sliding, bearing) when relevant.',
  '- Standards reference when applicable: วสท. 2562 หรือ ACI 318-19.',
  '',
  'OUTPUT RULES:',
  '- Call format_design_explanation exactly once. Do not produce text outside the tool call.',
  '- All four fields (summary, key_points, warnings, recommendations) must be present. Use empty array [] for warnings/recommendations if not applicable -- never omit.',
  '- Thai prose, plain text. No bullet characters (no -, *, •), no markdown headings, no numbered prefixes inside the strings.',
  '- If the input contains the original OptimizeRequest under "input", you may reference user assumptions in the explanation (e.g., "ตามที่ระบุดิน phi 30 องศา"). If "input" is absent, explain only from the result fields.',
  '- Do not invent values. If a quantity is not in the result, do not state it.'
].join('\n');

// Stable id for the last tool_use in FEW_SHOT_MESSAGES. explainResult.js
// uses this when building the live user turn (its tool_result must
// pair with this id).
var LAST_TOOL_USE_ID = 'toolu_explain_03';

// Helper for explainResult.js: builds the live user turn so its
// tool_result satisfies the contract for LAST_TOOL_USE_ID, and the
// real request body rides as a JSON-stringified text block.
function wrapLiveTurn(payload) {
  return {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: LAST_TOOL_USE_ID, content: 'OK' },
      { type: 'text', text: 'Explain this optimization result:\n' + JSON.stringify(payload) }
    ]
  };
}

// Realistic mock results used in few-shot. These mirror the conven-
// tional shape produced by RC_RT_HCA-style optimizers. Cost values
// are illustrative and chosen to produce informative explanations.

var EXAMPLE_RESULT_HIGH_QUALITY = {
  result: {
    bestCost: 2992.45,
    bestIteration: 283,
    algorithm: 'ba',
    runtime_ms: 12,
    bestDesign: {
      B: 2.10, B1: 0.50, B2: 1.30,
      t1: 0.20, t2: 0.30, D: 0.30,
      H: 3, Hf: 0.30
    },
    bestSteel: {
      stem: { size: 'DB16', spacing_cm: 20, As_cm2_per_m: 10.05 },
      toe: { size: 'DB12', spacing_cm: 20, As_cm2_per_m: 5.65 },
      heel: { size: 'DB16', spacing_cm: 20, As_cm2_per_m: 10.05 },
      shrinkage: { size: 'DB10', spacing_cm: 25 }
    },
    safety_factors: {
      overturning: 2.45,
      sliding: 1.78,
      bearing: 0.61
    }
  },
  input: {
    H: 3, H1: 1.2,
    gamma_soil: 1.8, gamma_concrete: 2.4,
    phi: 30, mu: 0.5, qa: 20, cover: 0.075,
    material: { fy: 4000, fc: 240, concretePrice: 2500, steelPrice: 28 }
  }
};

var EXAMPLE_RESULT_TALL_WALL = {
  result: {
    bestCost: 4812.97,
    bestIteration: 523,
    algorithm: 'ba',
    runtime_ms: 18,
    bestDesign: {
      B: 2.80, B1: 0.70, B2: 1.75,
      t1: 0.25, t2: 0.40, D: 0.35,
      H: 4, Hf: 0.35
    },
    bestSteel: {
      stem: { size: 'DB20', spacing_cm: 15, As_cm2_per_m: 20.94 },
      toe: { size: 'DB16', spacing_cm: 20, As_cm2_per_m: 10.05 },
      heel: { size: 'DB20', spacing_cm: 20, As_cm2_per_m: 15.71 },
      shrinkage: { size: 'DB10', spacing_cm: 25 }
    },
    safety_factors: {
      overturning: 2.10,
      sliding: 1.55,
      bearing: 0.78
    }
  },
  input: {
    H: 4, H1: 1.2,
    gamma_soil: 1.9, gamma_concrete: 2.4,
    phi: 32, mu: 0.5, qa: 25, cover: 0.075,
    material: { fy: 4000, fc: 280, concretePrice: 2500, steelPrice: 28 }
  }
};

var EXAMPLE_RESULT_TIGHT_SF = {
  result: {
    bestCost: 6850.20,
    bestIteration: 412,
    algorithm: 'hca',
    runtime_ms: 24,
    bestDesign: {
      B: 3.20, B1: 0.80, B2: 2.00,
      t1: 0.30, t2: 0.50, D: 0.40,
      H: 5, Hf: 0.40
    },
    bestSteel: {
      stem: { size: 'DB25', spacing_cm: 15, As_cm2_per_m: 32.72 },
      toe: { size: 'DB20', spacing_cm: 20, As_cm2_per_m: 15.71 },
      heel: { size: 'DB25', spacing_cm: 20, As_cm2_per_m: 24.54 },
      shrinkage: { size: 'DB12', spacing_cm: 25 }
    },
    safety_factors: {
      overturning: 1.55,
      sliding: 1.52,
      bearing: 0.92
    }
  }
  // Note: no "input" field -- demonstrates explanation without user context
};

// Few-shot messages in Anthropic Messages format. Pattern:
//   user(prompt N) -> assistant(tool_use id=N)
//   -> user(tool_result for N + prompt N+1) -> assistant(tool_use id=N+1)
//   -> ...
// Final assistant turn ends with tool_use id=LAST_TOOL_USE_ID; the
// live turn (built by wrapLiveTurn) provides its tool_result.
var FEW_SHOT_MESSAGES = [
  // EXAMPLE 1 -- standard 3 m wall, all SF pass comfortably
  {
    role: 'user',
    content: 'Explain this optimization result:\n' + JSON.stringify(EXAMPLE_RESULT_HIGH_QUALITY)
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_explain_01',
        name: 'format_design_explanation',
        input: {
          summary: 'กำแพงกันดิน RC สูง 3 เมตร ออกแบบเสร็จด้วยต้นทุน 2,992 บาทต่อเมตร ผ่านการตรวจสอบความปลอดภัยทุกด้านครบตามมาตรฐาน วสท. 2562 พร้อมนำไปก่อสร้างได้',
          key_points: [
            'ขนาดฐานราก B = 2.10 ม. แบ่งเป็น toe 0.50 ม. และ heel 1.30 ม. ความหนาฐาน 0.30 ม.',
            'ผนังกำแพง ด้านบนหนา 0.20 ม. ค่อย ๆ เพิ่มเป็น 0.30 ม. ที่โคน',
            'เหล็กผนังด้านดิน DB16 ระยะ 20 ซม. (As = 10.05 ตร.ซม./ม.) เหล็ก toe DB12 @ 20 ซม. และเหล็ก heel DB16 @ 20 ซม.',
            'อัตราส่วนความปลอดภัย: ล้ม SF = 2.45 ลื่น SF = 1.78 รับน้ำหนัก ratio 0.61 ผ่านครบทั้งสามเกณฑ์',
            'เหล็กเสริมป้องกันการหดตัว DB10 @ 25 ซม.'
          ],
          warnings: [],
          recommendations: [
            'ตรวจสอบสมมติฐานดินที่หน้างานก่อนก่อสร้างจริง โดยเฉพาะมุมเสียดทาน phi = 30 องศา และค่ารับน้ำหนักดิน qa = 20 ตัน/ตร.ม.'
          ]
        }
      }
    ]
  },

  // EXAMPLE 2 -- 4 m wall, higher cost, larger reinforcement
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'toolu_explain_01', content: 'OK' },
      { type: 'text', text: 'Explain this optimization result:\n' + JSON.stringify(EXAMPLE_RESULT_TALL_WALL) }
    ]
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_explain_02',
        name: 'format_design_explanation',
        input: {
          summary: 'กำแพงกันดิน RC สูง 4 เมตร ออกแบบเสร็จด้วยต้นทุน 4,813 บาทต่อเมตร ผ่านความปลอดภัยทุกด้านโดยใช้คอนกรีต fc 280 และเหล็กเสริม SD40 เหมาะสมสำหรับงานทั่วไปของกรมทางหลวง',
          key_points: [
            'ขนาดฐานราก B = 2.80 ม. (toe 0.70 + heel 1.75 + ความหนาฐาน 0.35 ม.)',
            'ผนังกำแพง ด้านบนหนา 0.25 ม. โคน 0.40 ม.',
            'เหล็กผนังด้านดิน DB20 @ 15 ซม. (As = 20.94 ตร.ซม./ม.) สูงกว่ากำแพง 3 ม. เพราะโมเมนต์ดัดที่โคนผนังเพิ่มขึ้นตามความสูงยกกำลังสาม',
            'เหล็ก toe DB16 @ 20 ซม. และเหล็ก heel DB20 @ 20 ซม. ค่า As 15.71 ตร.ซม./ม.',
            'อัตราส่วนความปลอดภัย: ล้ม SF = 2.10 ลื่น SF = 1.55 รับน้ำหนัก ratio 0.78 ผ่านเกณฑ์ทั้งหมด แต่ค่าลื่นเริ่มเข้าใกล้ขอบล่าง 1.5'
          ],
          warnings: [
            'อัตราส่วนความปลอดภัยต่อการลื่น SF = 1.55 ใกล้ขอบล่างของมาตรฐาน 1.5 หากเจอดินที่ค่าเสียดทานต่ำกว่าที่ออกแบบ ค่าจะตกเกณฑ์ได้'
          ],
          recommendations: [
            'พิจารณาเพิ่ม shear key ที่ฐานหรือเพิ่มความยาว heel หากต้องการมาร์จิ้นความปลอดภัยต่อการลื่นมากขึ้น',
            'ทดสอบดินจริงเพื่อยืนยัน phi = 32 องศาก่อนเริ่มก่อสร้าง'
          ]
        }
      }
    ]
  },

  // EXAMPLE 3 -- 5 m wall, no input context, tight SFs
  {
    role: 'user',
    content: [
      { type: 'tool_result', tool_use_id: 'toolu_explain_02', content: 'OK' },
      { type: 'text', text: 'Explain this optimization result:\n' + JSON.stringify(EXAMPLE_RESULT_TIGHT_SF) }
    ]
  },
  {
    role: 'assistant',
    content: [
      {
        type: 'tool_use',
        id: 'toolu_explain_03',
        name: 'format_design_explanation',
        input: {
          summary: 'กำแพงกันดิน RC สูง 5 เมตร ออกแบบเสร็จด้วยต้นทุน 6,850 บาทต่อเมตร ผ่านความปลอดภัยทุกด้านแต่ค่าความปลอดภัยต่อการล้มและลื่นเริ่มชิดขอบล่างของมาตรฐาน ควรทบทวนสมมติฐานก่อนนำไปใช้งาน',
          key_points: [
            'ขนาดฐานราก B = 3.20 ม. (toe 0.80 + heel 2.00 + ความหนาฐาน 0.40 ม.)',
            'ผนังกำแพง ด้านบนหนา 0.30 ม. โคน 0.50 ม.',
            'เหล็กผนัง DB25 @ 15 ซม. (As = 32.72 ตร.ซม./ม.) ขนาดใหญ่ที่สุดในกลุ่มเพราะโมเมนต์ดัดที่โคนสูงมากตามความสูง 5 ม.',
            'เหล็ก toe DB20 @ 20 ซม. และเหล็ก heel DB25 @ 20 ซม. ค่า As 24.54 ตร.ซม./ม.',
            'อัตราส่วนความปลอดภัย: ล้ม SF = 1.55 ลื่น SF = 1.52 รับน้ำหนัก ratio 0.92'
          ],
          warnings: [
            'ค่า SF ต่อการล้ม 1.55 และต่อการลื่น 1.52 ทั้งคู่ใกล้ขอบล่างของมาตรฐาน วสท. 2562 (1.5) แทบไม่มีมาร์จิ้นเผื่อความไม่แน่นอนของดิน',
            'สัดส่วนความเค้นใต้ฐาน 0.92 หมายถึงใช้กำลังรับน้ำหนักดินไปเกือบเต็มแล้ว หากดินจริงอ่อนกว่าที่สมมติจะตกเกณฑ์ทันที'
          ],
          recommendations: [
            'ทำการตรวจสอบดินจริงในสนามให้ละเอียดก่อนตัดสินใจ ทั้งค่า phi และ qa',
            'พิจารณาขยายฐาน B หรือเพิ่ม shear key เพื่อยกระดับ SF ลื่น/ล้มให้มีมาร์จิ้นมากขึ้น',
            'หากดินจริงด้อยกว่าสมมติฐาน ควรเปลี่ยนเป็นกำแพงแบบอื่น เช่น counterfort หรือใช้ pile foundation'
          ]
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
