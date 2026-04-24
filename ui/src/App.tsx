// src/App.tsx
// Day 3: wire TraditionalForm to POST /api/optimize, render ResultPanel
// on success and a banner on any error. Uses a discriminated-union
// state machine so the render branches stay exhaustive.

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import TraditionalForm from './components/TraditionalForm';
import ResultPanel from './components/ResultPanel';
import { optimize } from './lib/api';
import { translateValidationError } from './lib/validation-i18n';
import { isOptimizeError } from './types/api';
import type { OptimizeRequest, OptimizeSuccess } from './types/api';

type AppState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; result: OptimizeSuccess }
  | { kind: 'error'; errorKind: 'validation' | 'internal' | 'network'; messages: string[] };

// Thai banner titles keyed by errorKind.
const ERROR_TITLES: Record<'validation' | 'internal' | 'network', string> = {
  validation: 'ข้อมูลไม่ผ่านการตรวจสอบ',
  internal:   'เกิดข้อผิดพลาดภายในระบบ',
  network:    'เชื่อมต่อ API ไม่สำเร็จ',
};

const App = () => {
  const [state, setState] = useState<AppState>({ kind: 'idle' });
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.kind === 'success' && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [state.kind]);

  const handleSubmit = async (request: OptimizeRequest) => {
    setState({ kind: 'loading' });
    try {
      const res = await optimize(request);
      if (isOptimizeError(res)) {
        if (res.error === 'validation_failed') {
          setState({ kind: 'error', errorKind: 'validation', messages: res.details });
        } else {
          // internal_error
          setState({ kind: 'error', errorKind: 'internal', messages: [res.message] });
        }
      } else {
        setState({ kind: 'success', result: res });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ kind: 'error', errorKind: 'network', messages: [msg] });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-xl mx-auto px-4 py-6">
        <header className="mb-6">
          <h1 className="text-xl font-bold text-slate-900">
            ออกแบบกำแพงกันดิน RC
          </h1>
          <p className="text-sm text-slate-600">
            RC Retaining Wall Design -- Traditional Mode
          </p>
        </header>

        <TraditionalForm
          onSubmit={handleSubmit}
          disabled={state.kind === 'loading'}
        />

        {state.kind === 'loading' && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600">
            <Loader2 size={16} className="animate-spin" />
            <span>กำลังคำนวณ...</span>
          </div>
        )}

        {state.kind === 'error' && (
          <div className="mt-4 rounded-lg border p-4 bg-red-50 border-red-200 text-red-800">
            <div className="font-semibold text-sm mb-2">
              {ERROR_TITLES[state.errorKind]}
            </div>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {(state.errorKind === 'validation'
                ? state.messages.map(translateValidationError)
                : state.messages
              ).map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          </div>
        )}

        {state.kind === 'success' && (
          <div ref={resultRef} className="mt-6 scroll-mt-4">
            <ResultPanel
              result={state.result}
              onReset={() => setState({ kind: 'idle' })}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
