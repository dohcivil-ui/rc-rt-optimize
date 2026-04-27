// web/src/pages/ResultPage.jsx
// Day 7.4: minimal display of /api/optimize response (4 fields)
// Defer to Day 8: dimensions table, steel layout, charts

import { useLocation, useNavigate } from 'react-router-dom';

function NoResultView() {
  var navigate = useNavigate();
  return (
    <div className='max-w-xl mx-auto py-16 px-4 text-center'>
      <h1 className='text-2xl font-semibold text-gray-800 mb-3'>
        ไม่มีผลลัพธ์
      </h1>
      <p className='text-gray-600 mb-8'>
        กรุณาเริ่มจากหน้าป้อนข้อความก่อน
      </p>
      <button
        onClick={function () { navigate('/input'); }}
        className='px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium'
      >
        ไปหน้าป้อนข้อความ →
      </button>
    </div>
  );
}

function Row(props) {
  return (
    <div className='flex items-center justify-between py-3 border-b border-gray-100'>
      <span className='text-gray-600 text-sm'>{props.label}</span>
      <span className='text-gray-900 font-medium'>{props.value}</span>
    </div>
  );
}

function fmtM(v) {
  return Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
}

function ResultPage() {
  var location = useLocation();
  var navigate = useNavigate();
  var state = location.state;

  if (!state || !state.result) {
    return <NoResultView />;
  }

  var result = state.result;
  console.log('bestDesign:', result.bestDesign);
  console.log('bestSteel:', result.bestSteel);
  var costThb = Number(result.bestCost).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  var iter = Number(result.bestIteration).toLocaleString('th-TH');
  var runtime = Number(result.runtime_ms).toLocaleString('th-TH');
  var algo = (result.algorithm || '-').toUpperCase();

  return (
    <div className='max-w-2xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-semibold text-gray-800 mb-2'>
        ผลการ optimize
      </h1>
      <p className='text-gray-600 mb-8'>
        ผลลัพธ์จากการคำนวณค่าออกแบบที่ต้นทุนต่ำสุด
      </p>

      <div className='bg-white border border-gray-200 rounded-lg p-6 mb-6'>
        <Row label='ต้นทุนต่ำสุด' value={costThb + ' บาท/m'} />
        <Row label='รอบที่พบ' value={iter} />
        <Row label='ใช้เวลา' value={runtime + ' ms'} />
        <Row label='อัลกอริทึม' value={algo} />
      </div>

      {/* Day 8.2: dimensions section */}
      <h2 className='text-lg font-semibold text-gray-800 mb-3'>
        มิติของกำแพง
      </h2>
      <h3 className='text-sm font-medium text-gray-700 mb-2'>ฐานราก</h3>
      <div className='bg-white border border-gray-200 rounded-lg p-6 mb-4'>
        <Row label='ความกว้างฐาน B' value={fmtM(result.bestDesign.Base)} />
        <Row label='ความหนาฐาน TBase' value={fmtM(result.bestDesign.TBase)} />
        <Row label='ส่วนยื่น Toe LToe' value={fmtM(result.bestDesign.LToe)} />
        <Row label='ส่วนยื่น Heel LHeel' value={fmtM(result.bestDesign.LHeel)} />
      </div>
      <h3 className='text-sm font-medium text-gray-700 mb-2'>ผนัง (Stem)</h3>
      <div className='bg-white border border-gray-200 rounded-lg p-6 mb-6'>
        <Row label='ความหนาด้านบน tt' value={fmtM(result.bestDesign.tt)} />
        <Row label='ความหนาด้านล่าง tb' value={fmtM(result.bestDesign.tb)} />
      </div>

      <p className='text-xs text-gray-400 mb-6'>
        รายละเอียดมิติ + เหล็กเสริมจะเพิ่มใน Day 8
      </p>

      <div className='flex items-center justify-between mt-8 pt-4 border-t border-gray-200'>
        <button
          onClick={function () { navigate(-1); }}
          className='px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-medium text-sm'
        >
          ← กลับไปแก้ค่า
        </button>
        <button
          disabled
          title='Day 9 จะเชื่อม /api/explain-result'
          className='px-6 py-3 bg-gray-300 text-gray-500 rounded-lg font-medium cursor-not-allowed'
        >
          อธิบายผลลัพธ์ → (Day 9)
        </button>
      </div>
    </div>
  );
}

export default ResultPage;