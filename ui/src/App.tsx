import { Play } from 'lucide-react';

function App() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          เครื่องมือออกแบบกำแพงกันดิน RC (Prototype)
        </h1>
        <p className="text-sm text-slate-600 mb-6">
          RC Retaining Wall Design Tool
        </p>
        <button
          onClick={() => console.log('clicked')}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
        >
          <Play size={16} />
          Start (placeholder)
        </button>
        <p className="text-xs text-slate-400 mt-6">
          Week 2 Day 1 -- scaffold only. Form coming Day 2.
        </p>
      </div>
    </div>
  );
}

export default App;
