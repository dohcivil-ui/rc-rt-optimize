import { useNavigate } from 'react-router-dom';

function HeroPage() {
  var navigate = useNavigate();


  // CTA: start design -> /input
  var handleStart = function () {
    navigate('/input');
  };

  return (
    <div className='min-h-[calc(100vh-65px)] flex items-center justify-center px-4'>
      <div className='max-w-2xl text-center'>
        <h1 className='text-4xl font-bold text-slate-900 mb-6'>
          ระบบออกแบบกำแพงกันดิน คสล. ด้วย AI
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
    </div>
  );
}

export default HeroPage;
