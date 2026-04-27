import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { parseInput } from '../lib/api';

function InputPage() {
  var navigate = useNavigate();
  var [text, setText] = useState('');
  var [loading, setLoading] = useState(false);
  var [error, setError] = useState(null);
  var [result, setResult] = useState(null);

  function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);

    parseInput(text)
      .then(function (data) {
        setResult(data);
      })
      .catch(function (err) {
        if (err.message === 'network' || err.status === 502 || err.status === 503 || err.status === 504) {
          setError('ไม่สามารถเชื่อมต่อ server กรุณาตรวจสอบว่า backend ทำงานอยู่');
        } else if (err.status >= 400 && err.status < 500) {
          setError('ข้อมูลไม่ถูกต้อง: ' + JSON.stringify(err.details || err.message));
        } else {
          setError('เกิดข้อผิดพลาดที่ server: ' + err.message);
        }
      })
      .finally(function () {
        setLoading(false);
      });
  }

  function handleReset() {
    setResult(null);
    setError(null);
  }

  function handleGoReview() {
    if (result && result.parsed) {
      navigate('/review', { state: result.parsed });
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">ป้อนข้อความบรรยายปัญหา</h1>
      <p className="text-gray-600 mb-6">
        พิมพ์ข้อมูลกำแพงเป็นภาษาไทยธรรมชาติ ระบบจะแปลงเป็น parameters ให้อัตโนมัติ
      </p>

      <textarea
        className="w-full border border-gray-300 rounded p-3 mb-4 font-sans text-base"
        rows="12"
        placeholder="ตัวอย่าง: กำแพงสูง 3 เมตร phi=30 องศา qa=30 t/m2 fc=280 ksc"
        value={text}
        onChange={function (e) { setText(e.target.value); }}
        disabled={loading || result !== null}
      />

      {!result && (
        <button
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded font-medium"
          onClick={handleAnalyze}
          disabled={loading || text.trim() === ''}
        >
          {loading ? 'กำลังวิเคราะห์...' : 'วิเคราะห์'}
        </button>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h2 className="text-xl font-semibold mb-2">ผลการวิเคราะห์</h2>
          <pre className="bg-gray-50 border border-gray-200 rounded p-4 text-sm overflow-x-auto">
{JSON.stringify(result, null, 2)}
          </pre>

          <div className="mt-4 flex gap-3 flex-wrap">
            <button
              className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-5 py-2 rounded font-medium"
              onClick={handleReset}
            >
              วิเคราะห์ใหม่
            </button>
            <button
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded font-medium"
              onClick={handleGoReview}
              disabled={!result.parsed}
            >
              ตรวจสอบและแก้ไข →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InputPage;
