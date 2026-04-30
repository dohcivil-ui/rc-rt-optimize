// chatTools.js -- Day 9.9 chat tool definitions + handler.
// Single tool: re_optimize_with_params lets the assistant explore
// "what if" scenarios by overriding selected parameters of the user's
// current design and re-running the BA/HCA optimizer at a reduced
// iteration budget (2000 vs 5000 default) to keep chat latency under
// ~6 seconds end-to-end.

var engine = require('./engine');

// Anthropic tool schema. Field names use snake_case per chat UX (e.g.
// fc_prime, q_allow) and are translated to /optimize body shape inside
// handleToolCall. All fields are optional so Claude can patch a single
// parameter at a time.
var TOOLS = [{
  name: 're_optimize_with_params',
  description: 'รัน optimize ใหม่โดยเปลี่ยน parameter บางตัวจากค่าเดิม. ' +
    'ใช้เมื่อผู้ใช้ถาม "ถ้าเปลี่ยน X เป็น Y แล้วเป็นยังไง?". ' +
    'จะ inherit ค่าอื่นจาก currentParams และ override เฉพาะที่ส่งมา. ' +
    'หมายเหตุ: tool นี้รัน 2000 iter เพื่อความเร็ว -- ผลอาจต่างจากผลหลัก ~2%.',
  input_schema: {
    type: 'object',
    properties: {
      H:          { type: 'number', description: 'ความสูงกำแพง (m), 3-7' },
      fc_prime:   { type: 'number', description: 'fc คอนกรีต (ksc), เช่น 240, 280, 320' },
      fy:         { type: 'number', description: 'fy เหล็ก (ksc), เช่น 4000 (SD40), 5000 (SD50)' },
      gamma_soil: { type: 'number', description: 'หน่วยน้ำหนักดิน (ton/m^3)' },
      phi:        { type: 'number', description: 'มุมเสียดทานดิน (deg)' },
      q_allow:    { type: 'number', description: 'BC ดิน allowable (ton/m^2)' },
      algorithm:  { type: 'string', enum: ['BA', 'HCA'], description: 'default BA' }
    },
    required: []
  }
}];

// Range gate (looser than /optimize validator on purpose -- chat is
// for exploration). Engine itself does not validate, so we guard here.
var PARAM_RANGES = {
  H:          [3,    7],
  fc_prime:   [180,  400],
  fy:         [2400, 6000],
  gamma_soil: [1.4,  2.2],
  phi:        [20,   40],
  q_allow:    [5,    50]
};

function validateParams(toolInput) {
  var errors = [];
  var key;
  for (key in PARAM_RANGES) {
    if (Object.prototype.hasOwnProperty.call(toolInput, key) && toolInput[key] !== undefined) {
      var v = toolInput[key];
      if (typeof v !== 'number' || !isFinite(v)) {
        errors.push(key + ' ต้องเป็นตัวเลข');
        continue;
      }
      var range = PARAM_RANGES[key];
      if (v < range[0] || v > range[1]) {
        errors.push(key + '=' + v + ' นอกช่วง [' + range[0] + ', ' + range[1] + ']');
      }
    }
  }
  return errors;
}

// Map snake_case tool fields onto /optimize body shape and merge with
// currentParams (which is whatever was sent to /optimize originally).
function mergeParams(currentParams, toolInput) {
  var base = currentParams || {};
  var material = Object.assign({}, base.material || {});
  if (typeof toolInput.fc_prime === 'number') material.fc = toolInput.fc_prime;
  if (typeof toolInput.fy === 'number')       material.fy = toolInput.fy;

  var merged = Object.assign({}, base, {
    material: material
  });
  if (typeof toolInput.H === 'number')          merged.H = toolInput.H;
  if (typeof toolInput.gamma_soil === 'number') merged.gamma_soil = toolInput.gamma_soil;
  if (typeof toolInput.phi === 'number')        merged.phi = toolInput.phi;
  if (typeof toolInput.q_allow === 'number')    merged.qa = toolInput.q_allow;

  // Force a fast budget for chat ("what if" exploration). 2000 iter is
  // enough for BA/HCA to land within ~2% of the true optimum on the
  // 9-case grid we tested.
  merged.options = Object.assign({}, base.options || {}, {
    maxIterations: 2000,
    seed: 1
  });
  return merged;
}

function handleToolCall(toolName, toolInput, currentParams) {
  if (toolName !== 're_optimize_with_params') {
    return { error: 'Unknown tool: ' + toolName };
  }
  toolInput = toolInput || {};

  var algorithm = toolInput.algorithm === 'HCA' ? 'HCA' : 'BA';

  var errors = validateParams(toolInput);
  if (errors.length > 0) {
    return {
      error: 'Parameter นอก range: ' + errors.join('; '),
      changedParams: toolInput,
      hint: 'ลองค่าใน range ที่ระบุในคำอธิบาย tool'
    };
  }

  var merged = mergeParams(currentParams, toolInput);

  try {
    var result = engine.runOptimize(merged, { algorithm: algorithm });
    if (!result || !result.bestDesign || !result.verification) {
      return { error: 'Engine ไม่คืนผลลัพธ์ที่ valid', changedParams: toolInput };
    }
    var sf = result.verification.safetyFactors || {};
    return {
      changedParams: toolInput,
      algorithm: algorithm,
      bestCost: result.bestCost,
      bestIteration: result.bestIteration,
      verification: {
        allPass: !!(sf.allPass),
        FS_OT: sf.FS_OT && sf.FS_OT.value,
        FS_SL: sf.FS_SL && sf.FS_SL.value,
        FS_BC: sf.FS_BC && sf.FS_BC.value
      },
      design: {
        Base:  result.bestDesign.Base,
        TBase: result.bestDesign.TBase,
        tb:    result.bestDesign.tb,
        tt:    result.bestDesign.tt,
        LToe:  result.bestDesign.LToe,
        LHeel: result.bestDesign.LHeel
      },
      steel: result.bestSteelDecoded || null
    };
  } catch (err) {
    return {
      error: 'Engine error: ' + (err && err.message ? err.message : String(err)),
      changedParams: toolInput
    };
  }
}

module.exports = {
  TOOLS: TOOLS,
  PARAM_RANGES: PARAM_RANGES,
  validateParams: validateParams,
  mergeParams: mergeParams,
  handleToolCall: handleToolCall
};
