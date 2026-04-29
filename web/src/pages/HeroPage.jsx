import { useNavigate } from 'react-router-dom';
import { CASE_STUDIES, REFERENCE_COSTS } from '../data/cases';

var H_VALUES = [3, 4, 5];
var FC_VALUES = [240, 280, 320];

function HeroPage() {
  var navigate = useNavigate();

  // CTA: start design -> /input
  var handleStart = function () {
    navigate('/input');
  };

  // Day 9.5: direct preset injection -> /review (skip /input mount)
  function handlePreset(caseKey) {
    var preset = CASE_STUDIES[caseKey];
    if (preset) {
      navigate('/review', { state: preset });
    }
  }

  return (
    <div className='min-h-[calc(100vh-65px)] flex flex-col items-center justify-start px-4 py-12'>
      <div className='max-w-2xl text-center'>
        <h1 className='text-4xl font-bold text-slate-900 mb-6'>
          ระบบออกแบบกำแพงดิน คสล. ด้วย AI
        </h1>
        <p className='text-lg text-slate-600 mb-10 leading-relaxed'>
          ป้อนความต้องการเป็นภาษาไทย ระบบจะ optimize ขนาดและเหล็กเสริม
          ให้ต้นทุนต่ำสุด ตามมาตรฐาน วสท. 2562 และ ACI 318-19
        </p>
        <button
          onClick={handleStart}
          className='px-8 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow hover:bg-blue-700 transition-colors text-lg'
        >
          เริ่มออกแบบ →
        </button>
      </div>

      {/* Day 9.5: Preset 3x3 grid */}
      <div className='max-w-3xl w-full mt-16 pt-10 border-t border-slate-200'>
        <div className='text-center mb-6'>
          <h2 className='text-xl font-semibold text-slate-800 mb-1'>
            หรือเลือกตัวอย่างที่มีค่าอ้างอิง
          </h2>
          <p className='text-sm text-slate-500'>
            9 เคสจาก VB6 v2.0 — 30 trials/algorithm, BA + HCA convergent
          </p>
        </div>

        <div className='grid grid-cols-[60px_repeat(3,1fr)] gap-2 mb-2 px-1'>
          <div></div>
          {FC_VALUES.map(function (fc) {
            return (
              <div key={fc} className='text-sm font-medium text-slate-600 text-center'>
                fc&apos; = {fc} ksc
              </div>
            );
          })}
        </div>

        {H_VALUES.map(function (H) {
          return (
            <div key={H} className='grid grid-cols-[60px_repeat(3,1fr)] gap-2 mb-2 items-stretch'>
              <div className='flex items-center justify-center text-sm font-medium text-slate-600'>
                H = {H} m
              </div>
              {FC_VALUES.map(function (fc) {
                var key = 'H' + H + '-' + fc;
                var cost = REFERENCE_COSTS[key];
                return (
                  <button
                    key={key}
                    onClick={function () { handlePreset(key); }}
                    className='py-3 px-2 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors text-center'
                  >
                    <div className='text-sm font-semibold text-slate-800 mb-1'>{key}</div>
                    <div className='text-xs text-slate-600 mb-1.5'>
                      &asymp; {cost.toLocaleString()} ฿/ม.
                    </div>
                    <div className='inline-block text-[10px] px-1.5 py-0.5 bg-green-50 text-green-800 rounded-full'>
                      &#10003; VB6
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}

        <p className='text-xs text-slate-400 text-center mt-3'>
          คลิกปุ่มเพื่อโหลดค่าเข้า /review โดยตรง — เลขใน /result ควรตรงกับ &asymp; ที่แสดงไว้
        </p>
      </div>
    </div>
  );
}

export default HeroPage;
