// src/components/TraditionalForm.tsx
// Traditional Mode form for POST /api/optimize.
// 13 controlled number inputs grouped into 4 sections.
// Defaults to the ground-truth scenario from handoff v5.1
// (expected bestCost ~ 2992.4507519999997 with seed=42).

import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Calculator } from 'lucide-react';
import type { OptimizeRequest } from '../types/api';

// All form values are stored as strings to match native HTMLInputElement
// behaviour (avoids NaN flicker while user is typing).
type FormState = {
  H: string;
  H1: string;
  gamma_soil: string;
  gamma_concrete: string;
  phi: string;
  mu: string;
  qa: string;
  cover: string;
  fy: string;
  fc: string;
  concretePrice: string;
  steelPrice: string;
  seed: string;
};

// Ground-truth scenario from handoff v5.1.
const DEFAULTS: FormState = {
  H: '3',
  H1: '0.5',
  gamma_soil: '1.8',
  gamma_concrete: '2.4',
  phi: '30',
  mu: '0.5',
  qa: '20',
  cover: '0.075',
  fy: '4000',
  fc: '240',
  concretePrice: '2500',
  steelPrice: '28',
  seed: '42',
};

// Field metadata. Ranges mirror handoff v5.1 validation table.
type FieldMeta = {
  key: keyof FormState;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
};

const GEOMETRY_FIELDS: FieldMeta[] = [
  { key: 'H',  label: 'ความสูงรวม (H)',           unit: 'ม.', min: 2, max: 6, step: 0.1 },
  { key: 'H1', label: 'ความสูงดินหน้ากำแพง (H1)', unit: 'ม.', min: 0, max: 2, step: 0.1 },
];

const SOIL_FIELDS: FieldMeta[] = [
  { key: 'gamma_soil', label: 'หน่วยน้ำหนักดิน (γ_soil)',    unit: 'ต/ม³', min: 1.4, max: 2.2, step: 0.1  },
  { key: 'phi',        label: 'มุมเสียดทานภายในดิน (φ)',     unit: 'องศา', min: 20,  max: 45,  step: 1    },
  { key: 'mu',         label: 'สัมประสิทธิ์เสียดทานฐาน (μ)', unit: '-',    min: 0.3, max: 0.7, step: 0.05 },
  { key: 'qa',         label: 'กำลังรับน้ำหนักดิน (q_a)',    unit: 'ต/ม²', min: 10,  max: 50,  step: 1    },
];

const MATERIAL_FIELDS: FieldMeta[] = [
  { key: 'gamma_concrete', label: 'หน่วยน้ำหนักคอนกรีต (γ_c)', unit: 'ต/ม³',    min: 2.0,  max: 2.8,  step: 0.1   },
  { key: 'cover',          label: 'ระยะหุ้มเหล็ก (cover)',     unit: 'ม.',      min: 0.04, max: 0.15, step: 0.005 },
  { key: 'fy',             label: 'กำลังครากเหล็ก (fy)',       unit: 'ksc',     min: 2400, max: 6000, step: 100   },
  { key: 'fc',             label: "กำลังคอนกรีต (f'c)",        unit: 'ksc',     min: 180,  max: 400,  step: 10    },
  { key: 'concretePrice',  label: 'ราคาคอนกรีต',               unit: 'บาท/ม³',  min: 1500, max: 5000, step: 100   },
  { key: 'steelPrice',     label: 'ราคาเหล็ก',                 unit: 'บาท/กก.', min: 15,   max: 60,   step: 1     },
];

type Props = {
  onSubmit: (request: OptimizeRequest) => void;
  disabled?: boolean;
};

const TraditionalForm = ({ onSubmit, disabled = false }: Props) => {
  const [state, setState] = useState<FormState>(DEFAULTS);

  const handleChange = (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setState((prev) => ({ ...prev, [key]: next }));
  };

  const handleSubmit = () => {
    const request: OptimizeRequest = {
      H: Number(state.H),
      H1: Number(state.H1),
      gamma_soil: Number(state.gamma_soil),
      gamma_concrete: Number(state.gamma_concrete),
      phi: Number(state.phi),
      mu: Number(state.mu),
      qa: Number(state.qa),
      cover: Number(state.cover),
      material: {
        fy: Number(state.fy),
        fc: Number(state.fc),
        concretePrice: Number(state.concretePrice),
        steelPrice: Number(state.steelPrice),
      },
    };

    // Only include options.seed when the user provided a value.
    const seedTrimmed = state.seed.trim();
    if (seedTrimmed !== '') {
      request.options = { seed: Number(seedTrimmed) };
    }

    onSubmit(request);
  };

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="space-y-6"
    >
      <Section
        title="เรขาคณิต"
        subtitle="Geometry"
        fields={GEOMETRY_FIELDS}
        state={state}
        onChange={handleChange}
        disabled={disabled}
      />
      <Section
        title="คุณสมบัติดิน"
        subtitle="Soil properties"
        fields={SOIL_FIELDS}
        state={state}
        onChange={handleChange}
        disabled={disabled}
      />
      <Section
        title="วัสดุและราคา"
        subtitle="Materials & pricing"
        fields={MATERIAL_FIELDS}
        state={state}
        onChange={handleChange}
        disabled={disabled}
      />

      {/* Options section -- seed is the only optional field */}
      <div className="border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">
          ตัวเลือก <span className="font-normal text-slate-400">/ Options</span>
        </h2>
        <NumberField
          label="Seed"
          hint="ใส่เพื่อให้ผลลัพธ์ทำซ้ำได้ -- เว้นว่างเพื่อใช้ random"
          value={state.seed}
          onChange={handleChange('seed')}
          unit="-"
          step={1}
          disabled={disabled}
          required={false}
        />
      </div>

      <button
        type="submit"
        disabled={disabled}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-md font-semibold hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
      >
        <Calculator size={18} />
        คำนวณ
      </button>
    </form>
  );
};

// ---- Internal helpers ----

type SectionProps = {
  title: string;
  subtitle: string;
  fields: FieldMeta[];
  state: FormState;
  onChange: (key: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => void;
  disabled: boolean;
};

const Section = ({ title, subtitle, fields, state, onChange, disabled }: SectionProps) => (
  <div className="border border-slate-200 rounded-lg p-4">
    <h2 className="text-sm font-semibold text-slate-700 mb-3">
      {title} <span className="font-normal text-slate-400">/ {subtitle}</span>
    </h2>
    <div className="space-y-3">
      {fields.map((f) => (
        <NumberField
          key={f.key}
          label={f.label}
          value={state[f.key]}
          onChange={onChange(f.key)}
          unit={f.unit}
          min={f.min}
          max={f.max}
          step={f.step}
          hint={'[' + f.min + ' - ' + f.max + ']'}
          disabled={disabled}
          required
        />
      ))}
    </div>
  </div>
);

type NumberFieldProps = {
  label: string;
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  unit: string;
  min?: number;
  max?: number;
  step: number;
  hint?: string;
  disabled: boolean;
  required: boolean;
};

const NumberField = ({
  label, value, onChange, unit, min, max, step, hint, disabled, required,
}: NumberFieldProps) => (
  <label className="block">
    <div className="flex items-baseline justify-between mb-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </div>
    <div className="flex items-stretch">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={onChange}
        min={min}
        max={max}
        step={step}
        required={required}
        disabled={disabled}
        className="flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-l-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none disabled:bg-slate-100"
      />
      <span className="inline-flex items-center px-3 bg-slate-100 border border-l-0 border-slate-300 rounded-r-md text-sm text-slate-600 whitespace-nowrap">
        {unit}
      </span>
    </div>
  </label>
);

export default TraditionalForm;
