// src/App.tsx
// Day 2 verification harness: render TraditionalForm and log the
// composed OptimizeRequest payload to the console on submit.
// Day 3 will replace this with a state machine + ResultPanel.

import TraditionalForm from './components/TraditionalForm';
import type { OptimizeRequest } from './types/api';

const App = () => {
  const handleSubmit = (request: OptimizeRequest) => {
    // Day 2 only: inspect the composed payload via DevTools console.
    // Expected for default values: H=3, fc=240, options.seed=42.
    console.log('OptimizeRequest payload:');
    console.log(JSON.stringify(request, null, 2));
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
        <TraditionalForm onSubmit={handleSubmit} />
        <p className="text-xs text-slate-400 mt-6 text-center">
          Week 2 Day 2 -- form only. API wiring comes Day 3.
        </p>
      </div>
    </div>
  );
};

export default App;
