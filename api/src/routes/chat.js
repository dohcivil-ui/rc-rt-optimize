// chat.js -- POST /api/chat (Day 9.9). Thai-NLP chat with optional
// Claude tool-use. When ANTHROPIC_API_KEY is set, we run a 1-3 round
// agentic loop where Claude can call re_optimize_with_params; without
// the key, we fall back to chatMock (keyword + regex). The mock is the
// path exercised by CI tests.

var express = require('express');
var Anthropic = require('@anthropic-ai/sdk');
var chatTools = require('../lib/chatTools');
var chatMock = require('../lib/chatMock');

var router = express.Router();

var clientCache = null;
function getClient() {
  if (clientCache) return clientCache;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  clientCache = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return clientCache;
}
function _setClientForTest(client) {
  clientCache = client;
}

function buildSystemPrompt(currentParams, currentResult) {
  var p = currentParams || {};
  var mat = p.material || {};
  var r = currentResult || {};
  var sf = r.verification || {};
  return [
    'คุณคือผู้ช่วยอธิบายผล optimize กำแพงกันดิน คอนกรีตเสริมเหล็ก ตอบเป็นภาษาไทย กระชับ ตรงประเด็น',
    '',
    'บริบทปัจจุบัน:',
    '- ค่าออกแบบ: H=' + (p.H || '-') + ' m, fc=' + (mat.fc || '-') + ' ksc, fy=' + (mat.fy || '-') + ' ksc',
    '- ผลล่าสุด: ต้นทุน ' + (typeof r.bestCost === 'number' ? r.bestCost.toFixed(2) : '-') + ' บาท/m ' +
      '(' + (r.algorithm || '-') + ', iter ' + (r.bestIteration || '-') + ')',
    '- Safety: FS_OT=' + (sf.FS_OT || '-') + ', FS_SL=' + (sf.FS_SL || '-') + ', FS_BC=' + (sf.FS_BC || '-'),
    '',
    'ถ้าผู้ใช้ถามเชิง "ถ้าเปลี่ยน X" / "ลองสูง Y" -> ใช้ tool re_optimize_with_params',
    'ถ้าถามความรู้ทั่วไป -> ตอบจากความรู้ ห้ามแต่งตัวเลขเอง',
    'หมายเหตุ tool: รัน 2000 iter เร็วกว่าผลหลัก 5000 ผลอาจต่าง ~2%. ถ้า tool คืน error ให้อธิบายสาเหตุ + แนะนำค่าที่อยู่ใน range'
  ].join('\n');
}

function validateBody(body) {
  var errors = [];
  if (!body || typeof body !== 'object') {
    errors.push({ field: 'body', message: 'must be a JSON object' });
    return errors;
  }
  if (typeof body.message !== 'string' || body.message.trim().length === 0) {
    errors.push({ field: 'message', message: 'must be a non-empty string' });
  }
  if (body.currentParams !== undefined && (body.currentParams === null || typeof body.currentParams !== 'object')) {
    errors.push({ field: 'currentParams', message: 'when present, must be an object' });
  }
  if (body.currentResult !== undefined && (body.currentResult === null || typeof body.currentResult !== 'object')) {
    errors.push({ field: 'currentResult', message: 'when present, must be an object' });
  }
  return errors;
}

// Run the Claude tool-use loop, max 3 rounds. Returns
// { reply, toolCalls, usedMock: false } or throws.
function runClaudeLoop(client, body) {
  var system = buildSystemPrompt(body.currentParams, body.currentResult);
  var messages = [{ role: 'user', content: body.message }];
  var toolCalls = [];
  var MAX_ROUNDS = 3;

  function step(round) {
    if (round > MAX_ROUNDS) {
      return Promise.resolve({
        reply: 'ขอโทษครับ ตอบไม่สำเร็จในจำนวนรอบที่กำหนด (tool loop หยุดที่ ' + MAX_ROUNDS + ')',
        toolCalls: toolCalls,
        usedMock: false,
        warning: 'max_rounds_reached'
      });
    }
    return client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: system,
      tools: chatTools.TOOLS,
      messages: messages
    }).then(function (response) {
      if (response.stop_reason === 'tool_use') {
        // Append assistant turn (text + tool_use blocks) verbatim.
        messages.push({ role: 'assistant', content: response.content });
        // Find and execute every tool_use block (typically just one).
        var toolUses = response.content.filter(function (b) { return b.type === 'tool_use'; });
        var toolResults = toolUses.map(function (tu) {
          var result = chatTools.handleToolCall(tu.name, tu.input, body.currentParams);
          toolCalls.push({ name: tu.name, input: tu.input, result: result });
          return {
            type: 'tool_result',
            tool_use_id: tu.id,
            content: JSON.stringify(result)
          };
        });
        messages.push({ role: 'user', content: toolResults });
        return step(round + 1);
      }
      // end_turn / max_tokens / stop_sequence -- harvest final text.
      var textBlock = (response.content || []).find(function (b) { return b.type === 'text'; });
      var reply = textBlock && textBlock.text ? textBlock.text : '(AI ตอบกลับว่างเปล่า)';
      return { reply: reply, toolCalls: toolCalls, usedMock: false };
    });
  }

  return step(1);
}

router.post('/', function (req, res, next) {
  var body = req.body || {};
  var errors = validateBody(body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'validation_failed', details: errors });
  }

  var client = getClient();
  if (!client) {
    var mockResp = chatMock.generateMockReply(body.message, body.currentParams, body.currentResult);
    return res.status(200).json(mockResp);
  }

  runClaudeLoop(client, body)
    .then(function (out) { res.status(200).json(out); })
    .catch(function (err) {
      // Graceful: do not 500 the user -- return a friendly Thai apology
      // so the chat UI stays usable. Logged via global handler too.
      console.error('[chat]', err && err.stack ? err.stack : err);
      res.status(200).json({
        reply: 'ขอโทษครับ AI ตอบไม่ทัน ลองใหม่อีกครั้ง (' + (err && err.message ? err.message : 'unknown') + ')',
        toolCalls: [],
        usedMock: false,
        error: true
      });
    });
});

module.exports = router;
module.exports._setClientForTest = _setClientForTest;
module.exports.validateBody = validateBody;
module.exports.buildSystemPrompt = buildSystemPrompt;
