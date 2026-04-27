// web/src/pages/InputPage.jsx
// Day 5 Step 3: real parseInput() call + 3 error types
// Replaces Step 2 mock setTimeout

import { useState } from 'react';
import { parseInput } from '../lib/api';

function InputPage() {
  var [text, setText] = useState('');
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(null);
  var [result, setResult] = useState(null);

  function handleSubmit() {
    setError(null);
    setResult(null);
    setLoading(true);

    parseInput(text)
      .then(function (data) {
        setResult(data);
        setLoading(false);
      })
      .catch(function (err) {
        var msg;
        if (err.message === 'network') {
          msg = 'ไม่สามารถเชื่อมต่อ server กรุณาตรวจสอบว่า backend ทำงานอยู่';
        } else if (err.status >= 400 && err.status < 500) {
          var detail = err.details ? JSON.stringify(err.details) : err.message;
          msg = 'ข้อมูลไม่ถูกต้อง: ' + detail;
        } else if (err.status >= 500) {
          msg = 'เกิดข้อผิดพลาดที่ server: ' + err.message;
        } else {
          msg = 'เกิดข้อผิดพลาด: ' + err.message;
        }
        setError(msg);
        setLoading(false);
      });
  }

  return (
    <div className='max-w-3xl mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold mb-2'>อธิบายสภาพหน้างาน</h1>
      <p className='text-gray-600 mb-6'>
        พิมพ์รายละเอียดปัญหาเป็นภาษาไทย ระบบจะแยก parameter ให้อัตโนมัติ
      </p>

      <textarea
        className='w-full border border-gray-300 rounded-lg p-3 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
        rows={12}
        placeholder='เช่น กำแพงสูง 3 เมตร หลังกำแพงรับดินถม phi=30 องศา น้ำหนักจร 1000 กก./ตร.ม.'
        value={text}
        onChange={function (e) { setText(e.target.value); }}
        disabled={loading}
      />

      <div>
        <button
          type='button'
          onClick={handleSubmit}
          disabled={loading || text.trim() === ''}
          className='bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium'
        >
          {loading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์'}
        </button>
      </div>

      {error && (
        <div className='mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700'>
          {error}
        </div>
      )}

      {result && (
        <div className='mt-6'>
          <h2 className='text-xl font-semibold mb-2'>ผลลัพธ์ parameter</h2>
          <pre className='bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm'>
{JSON.stringify(result, null, 2)}
          </pre>
          <p className='text-gray-500 text-sm mt-2'>
            (Day 6 จะแปลงเป็น form ให้แก้ไขได้)
          </p>
        </div>
      )}
    </div>
  );
}

export default InputPage;
