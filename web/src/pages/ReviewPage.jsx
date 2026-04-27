// web/src/pages/ReviewPage.jsx
// Day 6.2: useLocation + no-data fallback + back button to /input
// Day 6.3: form 8 top-level fields in 3 sections (size/soil/concrete)
// Day 6.4: material section + nested setMat helper (4 fields, fy/fc/prices)
// Day 6.5: confirm/back buttons (replace debug pre); console.log only -- Day 7 wires /api/optimize

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { optimize } from '../lib/api';

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
  var navigate = useNavigate();
  var parsed = location.state;

  if (!parsed) {
    return <NoDataView />;
  }

  var [form, setForm] = useState(parsed);
  var [optimizing, setOptimizing] = useState(false);
  var [optError, setOptError] = useState(null);

  function setTop(key) {
    return function (e) {
      var v = e.target.value;
      setForm({ ...form, [key]: v === '' ? '' : Number(v) });
    };
  }

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

  function handleBack() {
    navigate(-1);
  }

  async function handleOptimize() {
    setOptError(null);
    setOptimizing(true);
    try {
      var result = await optimize(form);
      console.log('optimize result:', result);
      navigate('/result', { state: { params: form, result: result } });
    } catch (e) {
      var msg;
      if (e.message === 'network') {
        msg = 'เชื่อมต่อ backend ไม่ได้ (port 3000) -- ตรวจว่า npm start ทำงานอยู่';
      } else if (e.status >= 400 && e.status < 500) {
        msg = 'ค่าพารามิเตอร์ไม่ถูกต้อง: ' + e.message;
        if (e.details) { msg += ' (' + JSON.stringify(e.details) + ')'; }
      } else {
        msg = 'เกิดข้อผิดพลาดใน backend: ' + e.message;
      }
      setOptError(msg);
      console.error('optimize failed:', e);
    } finally {
      setOptimizing(false);
    }
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

      {optError && (
        <div className='mt-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm'>
          ⚠️ {optError}
        </div>
      )}

      <div className='flex items-center justify-between mt-8 pt-4 border-t border-gray-200'>
        <button
          onClick={handleBack}
          disabled={optimizing}
          className='px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed'
        >
          ← กลับไปแก้ข้อความ
        </button>
        <button
          onClick={handleOptimize}
          disabled={optimizing}
          className='px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:bg-blue-400 disabled:cursor-wait'
        >
          {optimizing ? 'กำลัง optimize...' : 'ยืนยัน optimize →'}
        </button>
      </div>
    </div>
  );
}
