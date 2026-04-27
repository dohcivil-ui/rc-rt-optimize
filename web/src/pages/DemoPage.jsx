// web/src/pages/DemoPage.jsx
// Day 6.7: 3x3 grid of 9 case studies (H x fc) for QR landing page
// URL: /demo  -- each cell navigates to /review with pre-filled paper-aligned params

import { useNavigate } from 'react-router-dom';
import { CASE_STUDIES } from '../data/cases';

var H_VALUES = [3, 4, 5];
var FC_VALUES = [240, 280, 320];

function DemoPage() {
  var navigate = useNavigate();

  function handlePick(H, fc) {
    var key = 'H' + H + '-' + fc;
    var caseData = CASE_STUDIES[key];
    if (caseData) {
      navigate('/review', { state: caseData });
    }
  }

  return (
    <div className='max-w-3xl mx-auto px-4 py-8'>
      <h1 className='text-3xl font-bold mb-2'>กรณีศึกษา 9 แบบ</h1>
      <p className='text-gray-600 mb-6'>
        เลือกชุดพารามิเตอร์ที่ต้องการ -- ค่าตามตัวอย่างในงานวิจัย (มหาสารคาม พ.ย. 2568)
      </p>

      <div className='grid grid-cols-3 gap-3'>
        {H_VALUES.map(function (H) {
          return FC_VALUES.map(function (fc) {
            var key = 'H' + H + '-' + fc;
            var c = CASE_STUDIES[key];
            return (
              <button
                key={key}
                onClick={function () { handlePick(H, fc); }}
                className='border border-gray-300 rounded-lg p-4 text-left hover:border-blue-500 hover:bg-blue-50 transition'
              >
                <div className='text-xs text-gray-500 mb-1'>{key}</div>
                <div className='text-lg font-semibold text-gray-800'>H = {H} m</div>
                <div className='text-sm text-gray-600 mt-1'>fc' = {fc} ksc</div>
                <div className='text-xs text-gray-500 mt-2 border-t border-gray-200 pt-2'>
                  คอนกรีต {c.material.concretePrice} บาท/m³<br />
                  เหล็ก {c.material.steelPrice} บาท/kg
                </div>
              </button>
            );
          });
        })}
      </div>

      <p className='text-xs text-gray-400 mt-6 text-center'>
        ค่า defaults: H1=1.20 m, μ=0.60, qa=30 t/m², φ=30°, γ_soil=1.80 t/m³, γ_concrete=2.40 t/m³, cover=0.075 m, fy=4000 ksc
      </p>
    </div>
  );
}

export default DemoPage;
