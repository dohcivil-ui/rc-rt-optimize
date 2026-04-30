// chatMock.js -- deterministic mock for /api/chat when no API key.
// Keyword-based detection of tool-triggering questions; numeric
// extraction for fc_prime, fy (SD40/50), and H. When a tool is
// triggered, we route through the real handleToolCall so the mock's
// numbers come from the actual engine -- this lets tests assert that
// reply text contains the same bestCost the tool computed.

var chatTools = require('./chatTools');

var TOOL_TRIGGER_KEYWORDS = [
  'เปลี่ยน', 'ลอง', 'ถ้า', 'ปรับ', 'แก้',
  'fc\'', 'fc prime', 'fy', 'SD40', 'SD50',
  'สูง', 'กว่า', 'ดีมั้ย', 'ดีกว่า'
];

// fc_prime: matches "fc" / "fc'" optionally followed by "เป็น" / "=" then a 3-digit ksc grade.
var FC_PRIME_RE = /fc'?\s*(?:เป็น|=)?\s*(\d{3})/i;
// fy: SD40 / SD50 / fy4000 / fy=5000
var FY_RE = /(?:fy\s*(?:เป็น|=)?\s*|SD)\s*(\d{2,4})/i;
// H: "สูง 5 m" / "สูง 5 เมตร" / "5m"
var H_RE = /สูง\s*(\d+(?:\.\d+)?)\s*(?:m|เมตร|ม\.?)/i;

function shouldTriggerTool(message) {
  if (typeof message !== 'string') return false;
  var i;
  for (i = 0; i < TOOL_TRIGGER_KEYWORDS.length; i++) {
    if (message.indexOf(TOOL_TRIGGER_KEYWORDS[i]) !== -1) return true;
  }
  return false;
}

function extractParams(message) {
  var params = {};
  if (typeof message !== 'string') return params;
  var m;
  if ((m = message.match(FC_PRIME_RE))) {
    params.fc_prime = parseInt(m[1], 10);
  }
  if ((m = message.match(FY_RE))) {
    var n = parseInt(m[1], 10);
    // SD40 -> 4000, SD50 -> 5000; fy=4000 stays 4000.
    params.fy = n <= 60 ? n * 100 : n;
  }
  if ((m = message.match(H_RE))) {
    params.H = parseFloat(m[1]);
  }
  return params;
}

function getMockKnowledgeReply(message, currentResult) {
  var fs = (currentResult && currentResult.verification) || {};
  if (message.indexOf('FS_OT') !== -1) {
    var v = typeof fs.FS_OT === 'number' ? fs.FS_OT.toFixed(2) : '-';
    return 'FS_OT คือ Factor of Safety ต่อการพลิกคว่ำ ในผลปัจจุบัน FS_OT=' + v + ' (เกณฑ์ >= 2.0)';
  }
  if (message.indexOf('FS_SL') !== -1) {
    var v2 = typeof fs.FS_SL === 'number' ? fs.FS_SL.toFixed(2) : '-';
    return 'FS_SL คือ Factor of Safety ต่อการเลื่อน ในผลปัจจุบัน FS_SL=' + v2 + ' (เกณฑ์ >= 1.5)';
  }
  if (message.indexOf('FS_BC') !== -1) {
    var v3 = typeof fs.FS_BC === 'number' ? fs.FS_BC.toFixed(2) : '-';
    return 'FS_BC คือ Factor of Safety ต่อกำลังรับน้ำหนัก ในผลปัจจุบัน FS_BC=' + v3 + ' (เกณฑ์ >= 2.0)';
  }
  if (message.indexOf('BA') !== -1 && message.indexOf('HCA') !== -1) {
    return 'BA (Bisection) ใช้การหด search range รอบ best solution ตามแกน tb/TBase/Base ' +
      'ส่วน HCA (Hill Climbing Annealed) ใช้ neighbor search แบบสุ่มทั้ง space ' +
      'ในชุดทดสอบ 30 trials × 9 cases ของเรา BA convergent เร็วกว่า HCA อย่างมีนัยสำคัญ (Wilcoxon p < 0.05)';
  }
  return 'นี่เป็นโหมด mock -- ตั้ง ANTHROPIC_API_KEY แล้ว restart server เพื่อใช้ AI จริง';
}

function generateMockReply(message, currentParams, currentResult) {
  if (!shouldTriggerTool(message)) {
    return {
      reply: '[MOCK] ' + getMockKnowledgeReply(message, currentResult || {}),
      toolCalls: [],
      usedMock: true
    };
  }

  var extracted = extractParams(message);
  if (Object.keys(extracted).length === 0) {
    return {
      reply: '[MOCK] เข้าใจว่าอยากทดลองเปลี่ยน parameter แต่ไม่เจอตัวเลขชัดเจน ' +
        'ลองพิมพ์เช่น "เปลี่ยน fc\' เป็น 320" หรือ "ถ้าสูง 5 เมตร"',
      toolCalls: [],
      usedMock: true
    };
  }

  var toolResult = chatTools.handleToolCall('re_optimize_with_params', extracted, currentParams || {});

  if (toolResult.error) {
    return {
      reply: '[MOCK] ' + toolResult.error + (toolResult.hint ? ' -- ' + toolResult.hint : ''),
      toolCalls: [{ name: 're_optimize_with_params', input: extracted, result: toolResult }],
      usedMock: true
    };
  }

  var currentCost = (currentResult && typeof currentResult.bestCost === 'number') ? currentResult.bestCost : null;
  var summary;
  if (currentCost === null) {
    summary = 'ผลใหม่: ต้นทุน ' + toolResult.bestCost.toFixed(0) + ' บาท/m';
  } else {
    var delta = toolResult.bestCost - currentCost;
    var pct = currentCost > 0 ? (delta / currentCost) * 100 : 0;
    var sign = delta < 0 ? 'ลดลง' : (delta > 0 ? 'เพิ่มขึ้น' : 'เท่าเดิม');
    summary = 'ผลใหม่: ต้นทุน ' + toolResult.bestCost.toFixed(0) + ' บาท/m (' +
      sign + ' ' + Math.abs(delta).toFixed(0) + ' บาท/m หรือ ' + Math.abs(pct).toFixed(1) + '%)';
  }
  var passText = toolResult.verification && toolResult.verification.allPass ? 'FS ผ่านครบ ✅' : 'FS ไม่ผ่าน ❌';

  return {
    reply: '[MOCK] ลองเปลี่ยน ' + JSON.stringify(extracted) + ' (algorithm=' + toolResult.algorithm + '): ' +
      summary + '. ' + passText,
    toolCalls: [{ name: 're_optimize_with_params', input: extracted, result: toolResult }],
    usedMock: true
  };
}

module.exports = {
  TOOL_TRIGGER_KEYWORDS: TOOL_TRIGGER_KEYWORDS,
  shouldTriggerTool: shouldTriggerTool,
  extractParams: extractParams,
  generateMockReply: generateMockReply,
  getMockKnowledgeReply: getMockKnowledgeReply
};
