// ChatPanel.jsx -- Day 9.9. Thai-NLP chat panel that calls /api/chat.
// One-shot conversation (no history sent back to server) -- the server
// is stateless and the system prompt is rebuilt from currentParams +
// currentResult on every request. Tool-use indicators appear inline
// underneath each assistant turn.

import { useState, useRef, useEffect } from 'react';
import CHAT_CHIPS from '../data/chatChips';

function summarizeResult(result) {
  if (!result) return null;
  var sf = result.verification && result.verification.safetyFactors;
  return {
    bestCost: result.bestCost,
    bestIteration: result.bestIteration,
    algorithm: (result.algorithm || '').toUpperCase(),
    verification: sf ? {
      allPass: sf.allPass,
      FS_OT: sf.FS_OT && sf.FS_OT.value,
      FS_SL: sf.FS_SL && sf.FS_SL.value,
      FS_BC: sf.FS_BC && sf.FS_BC.value
    } : {}
  };
}

function fmtCost(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function ToolCallIndicator(props) {
  var tc = props.toolCall;
  var r = tc.result || {};
  if (r.error) {
    return (
      <div className='mt-2 p-2 rounded border border-orange-200 bg-orange-50 text-xs text-orange-800'>
        <div className='font-semibold'>⚠️ Tool error: {tc.name}</div>
        <div>เปลี่ยน: {JSON.stringify(tc.input)}</div>
        <div className='mt-1'>{r.error}</div>
        {r.hint && <div className='mt-1 italic'>{r.hint}</div>}
      </div>
    );
  }
  var passText = r.verification && r.verification.allPass ? 'FS ผ่านครบ ✅' : 'FS ไม่ผ่าน ❌';
  return (
    <div className='mt-2 p-2 rounded border border-gray-200 bg-gray-50 text-xs text-gray-700'>
      <div className='font-semibold'>🔧 เรียก tool: {tc.name}</div>
      <div>เปลี่ยน: {JSON.stringify(tc.input)} (algorithm={r.algorithm || '-'})</div>
      <div className='mt-1'>
        ผล: ต้นทุน {fmtCost(r.bestCost)} บาท/m {'\u00B7'} iter {r.bestIteration} {'\u00B7'} {passText}
      </div>
    </div>
  );
}

function MessageBubble(props) {
  var msg = props.message;
  var isUser = msg.role === 'user';
  var bubbleCls = isUser
    ? 'bg-blue-600 text-white'
    : 'bg-white border border-gray-200 text-gray-800';
  var rowCls = 'flex ' + (isUser ? 'justify-end' : 'justify-start');
  return (
    <div className={rowCls}>
      <div className={'max-w-[85%] rounded-lg px-3 py-2 ' + bubbleCls}>
        <div className='whitespace-pre-wrap text-sm'>{msg.text}</div>
        {Array.isArray(msg.toolCalls) && msg.toolCalls.length > 0 && msg.toolCalls.map(function (tc, i) {
          return <ToolCallIndicator key={i} toolCall={tc} />;
        })}
      </div>
    </div>
  );
}

function ChatPanel(props) {
  var [messages, setMessages] = useState([]);
  var [input, setInput] = useState('');
  var [loading, setLoading] = useState(false);
  var [usedMock, setUsedMock] = useState(false);
  var [longLoad, setLongLoad] = useState(false);
  var bottomRef = useRef(null);

  useEffect(function () {
    if (bottomRef.current) bottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function send(text) {
    var trimmed = (text || '').trim();
    if (!trimmed || loading) return;
    var userMsg = { role: 'user', text: trimmed };
    setMessages(function (prev) { return prev.concat([userMsg]); });
    setInput('');
    setLoading(true);
    setLongLoad(false);

    var longTimer = setTimeout(function () { setLongLoad(true); }, 3000);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        currentParams: props.currentParams || {},
        currentResult: summarizeResult(props.currentResult)
      })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        if (data.usedMock) setUsedMock(true);
        setMessages(function (prev) {
          return prev.concat([{
            role: 'assistant',
            text: data.reply || '(ว่างเปล่า)',
            toolCalls: data.toolCalls || []
          }]);
        });
      })
      .catch(function (err) {
        setMessages(function (prev) {
          return prev.concat([{
            role: 'assistant',
            text: 'ขอโทษครับ AI ตอบไม่ทัน ลองใหม่อีกครั้ง (' + (err && err.message ? err.message : 'unknown') + ')',
            toolCalls: []
          }]);
        });
      })
      .then(function () {
        clearTimeout(longTimer);
        setLoading(false);
        setLongLoad(false);
      });
  }

  function handleChipClick(chip) {
    setInput(chip.message);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className='mt-8 border-t border-gray-200 pt-6'>
      <h3 className='text-lg font-semibold text-gray-800 mb-3'>💬 ถาม AI เกี่ยวกับผล</h3>

      {usedMock && (
        <div className='mb-3 p-2 rounded border border-yellow-300 bg-yellow-50 text-xs text-yellow-800'>
          ⚠️ โหมดทดสอบ (mock) — ตั้งค่า ANTHROPIC_API_KEY เพื่อใช้ AI จริง
        </div>
      )}

      <div className='border border-gray-200 rounded-lg bg-gray-50 p-3 max-h-[480px] overflow-y-auto space-y-3'>
        {messages.length === 0 && (
          <div className='text-sm text-gray-500 italic'>
            พิมพ์คำถามภาษาไทย หรือคลิกตัวอย่างด้านล่าง
          </div>
        )}
        {messages.map(function (m, i) {
          return <MessageBubble key={i} message={m} />;
        })}
        {loading && (
          <div className='flex justify-start'>
            <div className='max-w-[85%] rounded-lg px-3 py-2 bg-white border border-gray-200 text-gray-600 text-sm'>
              <span className='inline-block w-3 h-3 mr-2 align-middle border-2 border-blue-500 border-t-transparent rounded-full animate-spin'></span>
              {longLoad ? 'กำลังคำนวณใหม่...' : 'กำลังคิด...'}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className='mt-3 flex flex-wrap gap-2'>
        {CHAT_CHIPS.map(function (chip, i) {
          return (
            <button
              key={i}
              type='button'
              onClick={function () { handleChipClick(chip); }}
              disabled={loading}
              className='px-3 py-1 text-xs rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50'
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      <div className='mt-3 flex items-end gap-2'>
        <textarea
          value={input}
          onChange={function (e) { setInput(e.target.value); }}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder='พิมพ์คำถาม... (Enter เพื่อส่ง, Shift+Enter เพื่อขึ้นบรรทัด)'
          rows={2}
          className='flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 resize-none'
        />
        <button
          type='button'
          onClick={function () { send(input); }}
          disabled={loading || !input.trim()}
          className='px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium text-sm'
        >
          ส่ง
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
