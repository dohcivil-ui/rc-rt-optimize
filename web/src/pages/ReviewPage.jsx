// web/src/pages/ReviewPage.jsx
// Day 6.2: useLocation + no-data fallback + back button to /input
// Day 6.3-6.5 will replace JSON placeholder with full edit form

import { useLocation, useNavigate } from 'react-router-dom';

function NoDataView() {
  var navigate = useNavigate();
  return (
    <div className='max-w-xl mx-auto py-16 px-4 text-center'>
      <h1 className='text-2xl font-semibold text-gray-800 mb-3'>
        ยังไม่มีข้อมูลพารามิเตอร์
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

export default function ReviewPage() {
  var location = useLocation();
  var parsed = location.state;

  if (!parsed) {
    return <NoDataView />;
  }

  // Day 6.3-6.5 will build the full edit form here.
  // For now: confirm state arrived by dumping JSON.
  return (
    <div className='max-w-2xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-semibold text-gray-800 mb-2'>
        ตรวจสอบและแก้ไขพารามิเตอร์
      </h1>
      <p className='text-gray-600 mb-6'>
        ระบบดึงค่าจากข้อความที่คุณป้อน กรุณาตรวจสอบและแก้ไขให้ถูกต้องก่อนเริ่มคำนวณ
      </p>
      <div className='bg-gray-50 border border-gray-200 rounded-lg p-4'>
        <p className='text-sm text-gray-500 mb-2'>
          state ที่ได้รับ (placeholder, Day 6.3 จะแทนด้วย form):
        </p>
        <pre className='text-xs text-gray-800 overflow-auto'>{JSON.stringify(parsed, null, 2)}</pre>
      </div>
    </div>
  );
}
