// web/src/pages/ReviewPage.jsx
// Day 6.2: useLocation + no-data fallback + back button to /input
// Day 6.3: form 8 top-level fields in 3 sections (size/soil/concrete)
// Day 6.4: material section + nested setMat helper (4 fields, fy/fc/prices)
// Day 6.5 will add confirm + back buttons (replace debug <pre>)

import { useState } from 'react';
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

// Reusable input row: label on left, number input + unit on right
function Field(props) {
  var label = props.label;
  var value = props.value;
  var unit = props.unit;
  var step = props.step || '0.01';
  var onChange = props.onChange;
  return (
    <div className='flex items-center justify-between py-2'>
      <label className='text-gray-700 text-sm flex-1'>{label}</label>
      <div className='flex items-center gap-2'>
        <input
          type='number'
          step={step}
          value={value}
          onChange={onChange}
          className='w-28 px-3 py-1.5 border border-gray-300 rounded text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-400'
        />
        <span className='text-xs text-gray-500 w-16'>{unit}</span>
      </div>
    </div>
  );
}

// Section wrapper with title
function Section(props) {
  return (
    <div className='mb-6'>
      <h2 className='text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2 border-b border-gray-200 pb-1'>
        {props.title}
      </h2>
      {props.children}
    </div>
  );
}

export default function ReviewPage() {
  var location = useLocation();
  var parsed = location.state;

  if (!parsed) {
    return <NoDataView />;
  }

  var [form, setForm] = useState(parsed);

  // Helper to build top-level field onChange (NOT material)
  function setTop(key) {
    return function (e) {
      var v = e.target.value;
      setForm({ ...form, [key]: v === '' ? '' : Number(v) });
    };
  }

  // Helper to build nested material field onChange
  function setMat(key) {
    return function (e) {
      var v = e.target.value;
      setForm({
        ...form,
        material: {
          ...form.material,
          [key]: v === '' ? '' : Number(v)
        }
      });
    };
  }

  return (
    <div className='max-w-2xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-semibold text-gray-800 mb-2'>
        ตรวจสอบและแก้ไขพารามิเตอร์
      </h1>
      <p className='text-gray-600 mb-6'>
        ระบบดึงค่าจากข้อความที่คุณป้อน กรุณาตรวจสอบและแก้ไขให้ถูกต้องก่อนเริ่มคำนวณ
      </p>

      <Section title='ขนาดกำแพง'>
        <Field label='ความสูงรวม H' value={form.H} unit='m' onChange={setTop('H')} />
        <Field label='ความสูงดินบน H1' value={form.H1} unit='m' onChange={setTop('H1')} />
      </Section>

      <Section title='คุณสมบัติดิน'>
        <Field label='น้ำหนักหน่วย γ_soil' value={form.gamma_soil} unit='t/m³' onChange={setTop('gamma_soil')} />
        <Field label='มุมเสียดทาน φ' value={form.phi} unit='องศา' onChange={setTop('phi')} />
        <Field label='สัมประสิทธิ์เสียดทาน μ' value={form.mu} unit='—' onChange={setTop('mu')} />
        <Field label='กำลังรับน้ำหนัก qa' value={form.qa} unit='t/m²' onChange={setTop('qa')} />
      </Section>

      <Section title='คอนกรีต'>
        <Field label='น้ำหนักหน่วย γ_concrete' value={form.gamma_concrete} unit='t/m³' onChange={setTop('gamma_concrete')} />
        <Field label='ระยะหุ้มเหล็ก cover' value={form.cover} unit='m' step='0.005' onChange={setTop('cover')} />
      </Section>

      <Section title='วัสดุและราคา'>
        <Field label='fy (เหล็ก)' value={form.material.fy} unit='ksc' step='1' onChange={setMat('fy')} />
        <Field label="fc' (คอนกรีต)" value={form.material.fc} unit='ksc' step='1' onChange={setMat('fc')} />
        <Field label='ราคาคอนกรีต' value={form.material.concretePrice} unit='บาท/m³' step='1' onChange={setMat('concretePrice')} />
        <Field label='ราคาเหล็ก' value={form.material.steelPrice} unit='บาท/kg' step='0.5' onChange={setMat('steelPrice')} />
      </Section>

      {/* Day 6.5 will replace this debug block with confirm/back buttons */}
      <div className='mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4'>
        <p className='text-xs text-yellow-700 mb-2'>DEBUG (Day 6.4) -- form state จะอัปเดตเมื่อแก้ฟิลด์:</p>
        <pre className='text-xs text-gray-800 overflow-auto'>{JSON.stringify(form, null, 2)}</pre>
      </div>
    </div>
  );
}
