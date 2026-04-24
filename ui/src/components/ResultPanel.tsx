// src/components/ResultPanel.tsx
// Pure presentation component for POST /api/optimize success responses.
// No state, no effects -- parent owns fetch/result lifecycle.

import type { OptimizeSuccess } from '../types/api';

type Props = {
  result: OptimizeSuccess;
  onReset?: () => void;
};

// Design row order matches the engine's bestDesign shape in handoff v5.1.
// Tuple of [key, Thai label] -- avoids any mapping surprises.
const DESIGN_ROWS: ReadonlyArray<[keyof OptimizeSuccess['bestDesign'], string]> = [
  ['tt',    'ความหนาส่วนบนกำแพง (tt)'],
  ['tb',    'ความหนาส่วนล่างกำแพง (tb)'],
  ['TBase', 'ความหนาฐาน (TBase)'],
  ['Base',  'ความกว้างฐานรวม (Base)'],
  ['LToe',  'ความยาว toe (LToe)'],
  ['LHeel', 'ความยาว heel (LHeel)'],
];

// Thai-locale cost formatting: grouping commas + exactly 2 decimals.
const formatBaht = (n: number): string =>
  n.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// Dimension formatting: fixed 3 decimals (meters) -- matches the
// precision used in backend engine result objects.
const formatMeters = (n: number): string => n.toFixed(3);

const ResultPanel = ({ result, onReset }: Props) => {
  const algo = result.algorithm.toUpperCase();
  const badgeClass =
    result.algorithm === 'ba'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-amber-100 text-amber-700';

  return (
    <div className="border border-slate-200 rounded-lg p-4 bg-white">
      {/* Header row: section label + algorithm badge */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          ผลการคำนวณ
        </span>
        <span
          className={
            'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ' +
            badgeClass
          }
        >
          {algo}
        </span>
      </div>

      {/* Best cost -- prominent number + unit */}
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-bold text-blue-600">
          {formatBaht(result.bestCost)}
        </span>
        <span className="text-base text-slate-500">บาท</span>
      </div>

      {/* Meta row: bestIteration and runtime */}
      <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
        <span>พบที่ iteration #{result.bestIteration}</span>
        <span aria-hidden="true" className="text-slate-300">•</span>
        <span>ใช้เวลา {result.runtime_ms} ms</span>
      </div>

      {/* Best design table -- 6 fixed rows */}
      <h3 className="text-sm font-semibold text-slate-700 mt-4 mb-2">
        มิติที่เหมาะสมที่สุด
      </h3>
      <dl className="divide-y divide-slate-100">
        {DESIGN_ROWS.map(([key, label]) => (
          <div key={key} className="flex items-center justify-between py-2">
            <dt className="text-sm text-slate-700">{label}</dt>
            <dd className="text-sm font-mono text-slate-900 text-right">
              {formatMeters(result.bestDesign[key])} ม.
            </dd>
          </div>
        ))}
      </dl>

      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="mt-4 w-full px-4 py-2 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 transition"
        >
          คำนวณใหม่
        </button>
      )}
    </div>
  );
};

export default ResultPanel;
