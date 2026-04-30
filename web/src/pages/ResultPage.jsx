// web/src/pages/ResultPage.jsx
// Day 7.4: minimal display of /api/optimize response (4 fields)
// Day 8.2: dimensions table + steel layout
// Day 8.5: cost convergence chart (Recharts)
// Day 9: ExplainPage (AI explanation)
// Day 9.5b-b: VerificationPanel
// Day 9.6: BA/HCA toggle + compare tabs

import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceDot, Label } from 'recharts';
import VerificationPanel from '../components/VerificationPanel';
import ComparePanel from '../components/ComparePanel';

function NoResultView() {
  var navigate = useNavigate();
  return (
    <div className='max-w-xl mx-auto py-16 px-4 text-center'>
      <h1 className='text-2xl font-semibold text-gray-800 mb-3'>
        ไม่มีผลลัพธ์
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

function Row(props) {
  return (
    <div className='flex items-center justify-between py-3 border-b border-gray-100'>
      <span className='text-gray-600 text-sm'>{props.label}</span>
      <span className='text-gray-900 font-medium'>{props.value}</span>
    </div>
  );
}

function fmtM(v) {
  return Number(v).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' m';
}

// ResultBlock -- per-algorithm content (summary + dimensions + steel +
// verification + chart). Used inside both BA and HCA tabs.
function ResultBlock(props) {
  var result = props.result;
  if (!result) return null;

  var costThb = Number(result.bestCost).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  var iter = Number(result.bestIteration).toLocaleString('th-TH');
  var runtime = Number(result.runtime_ms).toLocaleString('th-TH');
  var algo = (result.algorithm || '-').toUpperCase();

  return (
    <div>
      <div className='bg-white border border-gray-200 rounded-lg p-6 mb-6'>
        <Row label='ต้นทุนต่ำสุด' value={costThb + ' บาท/m'} />
        <Row label='รอบที่พบ' value={iter} />
        <Row label='ใช้เวลา' value={runtime + ' ms'} />
        <Row label='อัลกอริทึม' value={algo} />
      </div>

      <h2 className='text-lg font-semibold text-gray-800 mb-3'>
        มิติของกำแพง
      </h2>
      <h3 className='text-sm font-medium text-gray-700 mb-2'>ฐานราก</h3>
      <div className='bg-white border border-gray-200 rounded-lg p-6 mb-4'>
        <Row label='ความกว้างฐาน B' value={fmtM(result.bestDesign.Base)} />
        <Row label='ความหนาฐาน TBase' value={fmtM(result.bestDesign.TBase)} />
        <Row label='ส่วนยื่น Toe LToe' value={fmtM(result.bestDesign.LToe)} />
        <Row label='ส่วนยื่น Heel LHeel' value={fmtM(result.bestDesign.LHeel)} />
      </div>
      <h3 className='text-sm font-medium text-gray-700 mb-2'>ผนัง (Stem)</h3>
      <div className='bg-white border border-gray-200 rounded-lg p-6 mb-6'>
        <Row label='ความหนาด้านบน tt' value={fmtM(result.bestDesign.tt)} />
        <Row label='ความหนาด้านล่าง tb' value={fmtM(result.bestDesign.tb)} />
      </div>

      <h2 className='text-lg font-semibold text-gray-800 mb-3'>
        เหล็กเสริม
      </h2>
      <div className='bg-white border border-gray-200 rounded-lg p-6 mb-6'>
        <Row label='เหล็กผนัง stem' value={(result.bestSteelDecoded?.stem?.size || '-') + ' @ ' + (result.bestSteelDecoded?.stem?.spacing_cm || '-') + ' ซม.'} />
        <Row label='เหล็ก toe' value={(result.bestSteelDecoded?.toe?.size || '-') + ' @ ' + (result.bestSteelDecoded?.toe?.spacing_cm || '-') + ' ซม.'} />
        <Row label='เหล็ก heel' value={(result.bestSteelDecoded?.heel?.size || '-') + ' @ ' + (result.bestSteelDecoded?.heel?.spacing_cm || '-') + ' ซม.'} />
      </div>

      {result.verification && (
        <VerificationPanel verification={result.verification} />
      )}

      {result.costHistorySampled && result.costHistorySampled.length > 0 && (
        <>
          <h2 className='text-lg font-semibold text-gray-800 mb-3 mt-6'>
            กราฟค่าใช้จ่าย (Cost Reduction Graph)
          </h2>
          <div className='bg-white border border-gray-200 rounded-lg p-4 mb-6'>
            <ResponsiveContainer width='100%' height={300}>
              <LineChart data={result.costHistorySampled} margin={{ top: 10, right: 30, left: 10, bottom: 25 }}>
                <CartesianGrid strokeDasharray='3 3' />
                <XAxis dataKey='iter' type='number' tick={{ fontSize: 12 }} tickCount={6} domain={[0, 'dataMax']}>
                  <Label value='Iteration' position='bottom' offset={10} style={{ fontSize: 13, fill: '#4b5563' }} />
                </XAxis>
                <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']}>
                  <Label value='Cost (Baht/m)' angle={-90} position='insideLeft' offset={0} style={{ fontSize: 13, fill: '#4b5563', textAnchor: 'middle' }} />
                </YAxis>
                <Tooltip formatter={function (v) { return [Number(v).toFixed(2) + ' Baht/m', 'Cost']; }} />
                <Line type='stepAfter' dataKey='cost' stroke='#2563eb' strokeWidth={2} dot={false} />
                <ReferenceDot x={result.bestIteration} y={result.bestCost} r={6} fill='#dc2626' stroke='#dc2626'>
                  <Label value={'Best: ' + Number(result.bestCost).toLocaleString('th-TH', { maximumFractionDigits: 0 }) + ' \u0E3F'} position='right' offset={8} style={{ fontSize: 14, fill: '#dc2626', fontWeight: 700 }} />
                </ReferenceDot>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function TabButton(props) {
  var activeCls = 'border-b-2 border-blue-500 text-blue-600 font-bold';
  var inactiveCls = 'text-gray-500 hover:text-gray-700 cursor-pointer';
  var cls = 'px-4 py-2 text-sm transition-colors ' + (props.active ? activeCls : inactiveCls);
  return (
    <button onClick={props.onClick} className={cls} type='button'>
      {props.label}
    </button>
  );
}

function ResultPage() {
  var location = useLocation();
  var navigate = useNavigate();
  var state = location.state;
  var initialResult = (state && state.result) ? state.result : null;
  var initialParams = (state && state.params) ? state.params : {};

  var [explainState, setExplainState] = useState('idle');
  var [explainData, setExplainData] = useState(null);
  // Day 9.7-final: compare mode is now driven by /api/compare (30 paired
  // trials of BA+HCA at full maxIterations). The single-trial baResult
  // remains as the very first view; once compareData arrives, BA/HCA
  // tabs surface the *best of 30* run instead.
  var [baResult] = useState(initialResult);
  var [compareData, setCompareData] = useState(null);
  var [compareState, setCompareState] = useState('idle');
  var [activeTab, setActiveTab] = useState('BA');

  if (!initialResult) {
    return <NoResultView />;
  }

  var input = initialParams;
  var hcaResult = compareData ? compareData.hcaBestRun : null;
  var baBestOfN = compareData ? compareData.baBestRun : baResult;
  var activeResult = activeTab === 'HCA' ? hcaResult : baBestOfN;

  function handleExplain() {
    setExplainState('loading');
    var controller = new AbortController();
    var timeoutId = setTimeout(function () { controller.abort(); }, 30000);
    var explainBody = activeResult || baResult;

    fetch('/api/explain-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: explainBody, input: input }),
      signal: controller.signal
    })
      .then(function (res) {
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        setExplainData(data);
        setExplainState('success');
      })
      .catch(function () {
        clearTimeout(timeoutId);
        setExplainState('error');
      });
  }

  function handleRunCompare() {
    setCompareState('loading');
    // 30 paired trials of BA + HCA at default maxIterations (5000 each
    // unless the upstream input overrides it). This is the single
    // entry point for the comparison flow -- one click yields tabs +
    // overlaid graph + per-trial chart + Wilcoxon test.
    var body = Object.assign({}, input, { trials: 30 });
    if (!body.maxIterations && (!input.options || !input.options.maxIterations)) {
      body.maxIterations = 5000;
    }

    fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (data) {
        setCompareData(data);
        setCompareState('success');
        setActiveTab('compare');
      })
      .catch(function () {
        setCompareState('error');
      });
  }

  return (
    <div className='max-w-2xl mx-auto py-8 px-4'>
      <h1 className='text-2xl font-semibold text-gray-800 mb-2'>
        ผลการ optimize
      </h1>
      <p className='text-gray-600 mb-6'>
        ผลลัพธ์จากการคำนวณค่าออกแบบที่ต้นทุนต่ำสุด
      </p>

      {!compareData && (
        <div className='mb-6 flex items-center gap-3'>
          {compareState === 'idle' && (
            <button
              type='button'
              onClick={handleRunCompare}
              className='px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded font-medium'
            >
              เปรียบเทียบกับ HCA
            </button>
          )}
          {compareState === 'loading' && (
            <div className='flex items-center gap-2 text-gray-600'>
              <span className='inline-block w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin'></span>
              <span>กำลังทดสอบ 30 รอบ × 5000 iterations... (~30-60 วินาที)</span>
            </div>
          )}
          {compareState === 'error' && (
            <div className='flex items-center gap-3'>
              <div className='text-red-600 text-sm'>❌ ทดสอบเปรียบเทียบไม่สำเร็จ</div>
              <button
                type='button'
                onClick={handleRunCompare}
                className='px-3 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded text-sm'
              >
                ลองใหม่
              </button>
            </div>
          )}
        </div>
      )}

      {compareData && (
        <div className='mb-6 border-b border-gray-200 flex'>
          <TabButton label='BA' active={activeTab === 'BA'} onClick={function () { setActiveTab('BA'); }} />
          <TabButton label='HCA' active={activeTab === 'HCA'} onClick={function () { setActiveTab('HCA'); }} />
          <TabButton label='เปรียบเทียบ' active={activeTab === 'compare'} onClick={function () { setActiveTab('compare'); }} />
        </div>
      )}

      {activeTab === 'compare' && compareData ? (
        <ComparePanel compareData={compareData} input={input} />
      ) : (
        <ResultBlock result={activeResult || baResult} />
      )}

      <div className='mt-8 pt-4 border-t border-gray-200'>
        <h3 className='text-lg font-semibold text-gray-800 mb-3'>🤖 อธิบายผลด้วย AI</h3>

        {explainState === 'idle' && (
          <button
            onClick={handleExplain}
            className='px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium'
          >
            ✨ อธิบายผลด้วย AI
          </button>
        )}

        {explainState === 'loading' && (
          <div className='text-gray-600'>⏳ กำลังวิเคราะห์ผล... (2-5 วินาที)</div>
        )}

        {explainState === 'error' && (
          <div className='space-y-2'>
            <div className='text-red-600'>❌ ไม่สามารถอธิบายผลได้ในขณะนี้</div>
            <button
              onClick={handleExplain}
              className='px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium text-sm'
            >
              ลองใหม่
            </button>
          </div>
        )}

        {explainState === 'success' && explainData && (
          <div className='space-y-3'>
            {explainData.summary && (
              <div className='p-3 bg-gray-50 border border-gray-200 rounded-lg'>
                <div className='font-semibold text-gray-800 mb-1'>📝 สรุป</div>
                <div className='text-gray-700'>{explainData.summary}</div>
              </div>
            )}
            {Array.isArray(explainData.key_points) && explainData.key_points.length > 0 && (
              <div className='p-3 bg-blue-50 border border-blue-200 rounded-lg'>
                <div className='font-semibold text-blue-900 mb-1'>⭐ ประเด็นหลัก</div>
                <ul className='list-disc list-inside text-blue-900 space-y-1'>
                  {explainData.key_points.map(function (point, i) {
                    return <li key={i}>{point}</li>;
                  })}
                </ul>
              </div>
            )}
            {Array.isArray(explainData.warnings) && explainData.warnings.length > 0 && (
              <div className='p-3 bg-amber-50 border border-amber-200 rounded-lg'>
                <div className='font-semibold text-amber-900 mb-1'>⚠️ ข้อควรระวัง</div>
                <ul className='list-disc list-inside text-amber-900 space-y-1'>
                  {explainData.warnings.map(function (w, i) {
                    return <li key={i}>{w}</li>;
                  })}
                </ul>
              </div>
            )}
            {Array.isArray(explainData.recommendations) && explainData.recommendations.length > 0 && (
              <div className='p-3 bg-green-50 border border-green-200 rounded-lg'>
                <div className='font-semibold text-green-900 mb-1'>💡 คำแนะนำ</div>
                <ul className='list-disc list-inside text-green-900 space-y-1'>
                  {explainData.recommendations.map(function (r, i) {
                    return <li key={i}>{r}</li>;
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className='flex items-center justify-between mt-8 pt-4 border-t border-gray-200'>
        <button
          onClick={function () { navigate(-1); }}
          className='px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg font-medium text-sm'
        >
          ← กลับไปแก้ค่า
        </button>
      </div>
    </div>
  );
}

export default ResultPage;
