// web/src/components/ComparePanel.jsx
// Day 9.6: side-by-side BA vs HCA convergence chart + cost summary.
// Day 9.7: 30-trial paired Wilcoxon test, boxplot, statistical caption.
// Both algorithms ship the same costHistorySampled shape ({iter, cost}[]),
// so we merge them on `iter` and render two Lines on a single LineChart.

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Label } from 'recharts';

var BA_COLOR = '#3B82F6';
var HCA_COLOR = '#F97316';

function fmtCost(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return Number(v).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) + ' บาท/m';
}

function fmtNum2(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return Number(v).toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtP(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return v.toFixed(4);
}

function fmtIter(v) {
  if (typeof v !== 'number') return '-';
  return Number(v).toLocaleString('th-TH');
}

function mergeHistories(baHist, hcaHist) {
  var iterSet = {};
  var i;
  if (Array.isArray(baHist)) {
    for (i = 0; i < baHist.length; i++) {
      iterSet[baHist[i].iter] = true;
    }
  }
  if (Array.isArray(hcaHist)) {
    for (i = 0; i < hcaHist.length; i++) {
      iterSet[hcaHist[i].iter] = true;
    }
  }
  var iters = Object.keys(iterSet).map(function (k) { return Number(k); });
  iters.sort(function (a, b) { return a - b; });

  var baMap = {};
  var hcaMap = {};
  if (Array.isArray(baHist)) {
    for (i = 0; i < baHist.length; i++) {
      baMap[baHist[i].iter] = baHist[i].cost;
    }
  }
  if (Array.isArray(hcaHist)) {
    for (i = 0; i < hcaHist.length; i++) {
      hcaMap[hcaHist[i].iter] = hcaHist[i].cost;
    }
  }

  var rows = [];
  for (i = 0; i < iters.length; i++) {
    var it = iters[i];
    rows.push({
      iter: it,
      ba: typeof baMap[it] === 'number' ? baMap[it] : null,
      hca: typeof hcaMap[it] === 'number' ? hcaMap[it] : null
    });
  }
  return rows;
}

// Inline SVG boxplot. Draws two side-by-side box-whisker plots (BA, HCA)
// scaled to a common y-axis. Outliers are not detected separately;
// whiskers run from min to max so the full range is visible.
function BoxPlotSvg(props) {
  var baStats = props.baStats;
  var hcaStats = props.hcaStats;
  if (!baStats || !hcaStats) return null;

  var width = 480;
  var height = 280;
  var marginTop = 20;
  var marginBottom = 40;
  var marginLeft = 70;
  var marginRight = 30;
  var plotH = height - marginTop - marginBottom;

  var allMin = Math.min(baStats.min, hcaStats.min);
  var allMax = Math.max(baStats.max, hcaStats.max);
  // Pad 5% on each end so caps are not flush with the frame.
  var range = allMax - allMin || 1;
  var yMin = allMin - 0.05 * range;
  var yMax = allMax + 0.05 * range;

  function yScale(v) {
    return marginTop + plotH * (1 - (v - yMin) / (yMax - yMin));
  }

  // 4 evenly spaced y-axis ticks (including endpoints).
  var ticks = [];
  var i;
  for (i = 0; i <= 4; i++) {
    ticks.push(yMin + (yMax - yMin) * (i / 4));
  }

  function renderBox(stats, centerX, color, label) {
    var boxW = 80;
    var x0 = centerX - boxW / 2;
    var x1 = centerX + boxW / 2;
    var capW = 30;
    return (
      <g key={label}>
        {/* Whiskers */}
        <line x1={centerX} y1={yScale(stats.min)} x2={centerX} y2={yScale(stats.q1)} stroke={color} strokeWidth='2' />
        <line x1={centerX} y1={yScale(stats.q3)} x2={centerX} y2={yScale(stats.max)} stroke={color} strokeWidth='2' />
        <line x1={centerX - capW / 2} y1={yScale(stats.min)} x2={centerX + capW / 2} y2={yScale(stats.min)} stroke={color} strokeWidth='2' />
        <line x1={centerX - capW / 2} y1={yScale(stats.max)} x2={centerX + capW / 2} y2={yScale(stats.max)} stroke={color} strokeWidth='2' />
        {/* Box (Q1 .. Q3) */}
        <rect x={x0} y={yScale(stats.q3)} width={x1 - x0} height={yScale(stats.q1) - yScale(stats.q3)} fill={color} fillOpacity='0.18' stroke={color} strokeWidth='2' />
        {/* Median */}
        <line x1={x0} y1={yScale(stats.median)} x2={x1} y2={yScale(stats.median)} stroke={color} strokeWidth='3' />
        {/* Mean marker (small filled circle) */}
        <circle cx={centerX} cy={yScale(stats.mean)} r='4' fill={color} />
        {/* Label */}
        <text x={centerX} y={height - marginBottom + 24} textAnchor='middle' fontSize='14' fontWeight='600' fill={color}>
          {label}
        </text>
      </g>
    );
  }

  var plotW = width - marginLeft - marginRight;
  var baX = marginLeft + plotW * 0.30;
  var hcaX = marginLeft + plotW * 0.70;

  return (
    <svg width='100%' viewBox={'0 0 ' + width + ' ' + height} role='img' aria-label='BA vs HCA boxplot'>
      {/* Y-axis line */}
      <line x1={marginLeft} y1={marginTop} x2={marginLeft} y2={marginTop + plotH} stroke='#9ca3af' strokeWidth='1' />
      {/* Y-axis ticks + labels + grid lines */}
      {ticks.map(function (t, idx) {
        var y = yScale(t);
        return (
          <g key={idx}>
            <line x1={marginLeft - 5} y1={y} x2={marginLeft} y2={y} stroke='#9ca3af' strokeWidth='1' />
            <line x1={marginLeft} y1={y} x2={width - marginRight} y2={y} stroke='#e5e7eb' strokeWidth='1' strokeDasharray='3 3' />
            <text x={marginLeft - 8} y={y + 4} textAnchor='end' fontSize='11' fill='#6b7280'>
              {Math.round(t).toLocaleString('en-US')}
            </text>
          </g>
        );
      })}
      {/* Y-axis label */}
      <text x={20} y={marginTop + plotH / 2} textAnchor='middle' fontSize='12' fill='#4b5563' transform={'rotate(-90 20 ' + (marginTop + plotH / 2) + ')'}>
        Cost (Baht/m)
      </text>
      {/* Boxes */}
      {renderBox(baStats, baX, BA_COLOR, 'BA')}
      {renderBox(hcaStats, hcaX, HCA_COLOR, 'HCA')}
    </svg>
  );
}

function buildCaption(statsResult) {
  if (!statsResult) return '';
  var ba = statsResult.ba.stats;
  var hca = statsResult.hca.stats;
  var w = statsResult.wilcoxon;
  var trials = statsResult.trials;

  var caption = 'จากการทดสอบ ' + trials + ' รอบ ';
  caption += 'BA ได้ต้นทุนเฉลี่ย ' + ba.mean.toFixed(2) + ' \u00B1 ' + ba.std.toFixed(2) + ' บาท/m, ';
  caption += 'HCA ได้ต้นทุนเฉลี่ย ' + hca.mean.toFixed(2) + ' \u00B1 ' + hca.std.toFixed(2) + ' บาท/m. ';

  if (w.pValue < 0.05) {
    var better = ba.mean < hca.mean ? 'BA' : 'HCA';
    caption += better + ' ให้ผลดีกว่าอย่างมีนัยสำคัญทางสถิติ ';
    caption += '(Wilcoxon p = ' + fmtP(w.pValue) + ')';
  } else {
    caption += 'ทั้งสองอัลกอริทึมไม่แตกต่างอย่างมีนัยสำคัญ ';
    caption += '(Wilcoxon p = ' + fmtP(w.pValue) + ')';
  }
  return caption;
}

function StatsSection(props) {
  var data = props.data;
  if (!data) return null;

  var ba = data.ba.stats;
  var hca = data.hca.stats;
  var w = data.wilcoxon;
  var significant = w.pValue < 0.05;

  return (
    <div className='mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4'>
      <h3 className='font-bold text-gray-800'>
        ทดสอบทางสถิติ ({data.trials} trials, Wilcoxon Signed-Rank Test)
      </h3>

      <div className='bg-white rounded border border-gray-200 p-3'>
        <BoxPlotSvg baStats={ba} hcaStats={hca} />
      </div>

      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
        <div className='p-3 rounded border border-blue-200 bg-blue-50'>
          <div className='font-bold text-blue-800 mb-1'>BA</div>
          <div>mean = {fmtNum2(ba.mean)} {'\u00B1'} {fmtNum2(ba.std)} บาท/m</div>
          <div>median = {fmtNum2(ba.median)}</div>
          <div>min = {fmtNum2(ba.min)}, max = {fmtNum2(ba.max)}</div>
          <div>Q1 = {fmtNum2(ba.q1)}, Q3 = {fmtNum2(ba.q3)}</div>
        </div>
        <div className='p-3 rounded border border-orange-200 bg-orange-50'>
          <div className='font-bold text-orange-700 mb-1'>HCA</div>
          <div>mean = {fmtNum2(hca.mean)} {'\u00B1'} {fmtNum2(hca.std)} บาท/m</div>
          <div>median = {fmtNum2(hca.median)}</div>
          <div>min = {fmtNum2(hca.min)}, max = {fmtNum2(hca.max)}</div>
          <div>Q1 = {fmtNum2(hca.q1)}, Q3 = {fmtNum2(hca.q3)}</div>
        </div>
      </div>

      <div className='text-sm text-gray-700'>
        Wilcoxon W = {Math.round(w.W)}, z = {fmtNum2(w.z)}, p = {fmtP(w.pValue)}, n = {w.n}
      </div>

      <div className={significant ? 'text-orange-600 font-bold' : 'text-green-600 font-bold'}>
        {significant
          ? '⚡ แตกต่างอย่างมีนัยสำคัญ (p < 0.05)'
          : '✅ ไม่แตกต่างอย่างมีนัยสำคัญ (p ≥ 0.05)'}
      </div>

      <div className='text-sm text-gray-700 italic'>
        {buildCaption(data)}
      </div>
    </div>
  );
}

function ComparePanel(props) {
  var ba = props.baResult;
  var hca = props.hcaResult;
  var input = props.input;

  var [statsState, setStatsState] = useState('idle');
  var [statsData, setStatsData] = useState(null);

  if (!ba || !hca) return null;

  var data = mergeHistories(ba.costHistorySampled, hca.costHistorySampled);

  var baCost = ba.bestCost;
  var hcaCost = hca.bestCost;
  var diff = Math.abs(baCost - hcaCost);
  var winner = baCost < hcaCost ? 'BA' : (hcaCost < baCost ? 'HCA' : 'TIE');
  var pivot = Math.min(baCost, hcaCost);
  var diffPct = pivot > 0 ? (diff / pivot) * 100 : 0;

  var summaryText;
  if (winner === 'TIE') {
    summaryText = 'BA และ HCA ให้ผลเท่ากัน (1 trial)';
  } else {
    summaryText = winner + ' ดีกว่า ' + fmtCost(diff) + ' (' + diffPct.toFixed(2) + '%) (1 trial)';
  }

  function handleRunStats() {
    setStatsState('loading');
    var body = Object.assign({}, input || {}, { trials: 30 });
    fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (resp) {
        setStatsData(resp);
        setStatsState('success');
      })
      .catch(function () {
        setStatsState('error');
      });
  }

  return (
    <div className='mt-8 space-y-4'>
      <h2 className='text-xl font-semibold text-gray-800'>
        เปรียบเทียบ BA vs HCA
      </h2>

      <div className='bg-white border border-gray-200 rounded-lg p-4'>
        <ResponsiveContainer width='100%' height={320}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 30 }}>
            <CartesianGrid strokeDasharray='3 3' />
            <XAxis dataKey='iter' type='number' tick={{ fontSize: 12 }} tickCount={6} domain={[0, 'dataMax']}>
              <Label value='Iteration' position='bottom' offset={10} style={{ fontSize: 13, fill: '#4b5563' }} />
            </XAxis>
            <YAxis tick={{ fontSize: 12 }} domain={['auto', 'auto']}>
              <Label value='Cost (Baht/m)' angle={-90} position='insideLeft' offset={0} style={{ fontSize: 13, fill: '#4b5563', textAnchor: 'middle' }} />
            </YAxis>
            <Tooltip formatter={function (v) { return [Number(v).toFixed(2) + ' Baht/m', '']; }} />
            <Legend verticalAlign='top' height={28} />
            <Line type='stepAfter' dataKey='ba' name='BA' stroke={BA_COLOR} strokeWidth={2} dot={false} connectNulls={true} />
            <Line type='stepAfter' dataKey='hca' name='HCA' stroke={HCA_COLOR} strokeWidth={2} dot={false} connectNulls={true} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className='bg-white border border-gray-200 rounded-lg p-4 text-sm'>
        <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
          <div className='p-3 rounded border border-blue-200 bg-blue-50'>
            <div className='font-bold text-blue-800 mb-1'>BA</div>
            <div className='text-gray-800'>Best: {fmtCost(baCost)}</div>
            <div className='text-gray-600'>iter {fmtIter(ba.bestIteration)}</div>
          </div>
          <div className='p-3 rounded border border-orange-200 bg-orange-50'>
            <div className='font-bold text-orange-700 mb-1'>HCA</div>
            <div className='text-gray-800'>Best: {fmtCost(hcaCost)}</div>
            <div className='text-gray-600'>iter {fmtIter(hca.bestIteration)}</div>
          </div>
        </div>
        <div className='mt-3 pt-3 border-t border-gray-200 font-medium text-gray-800'>
          {summaryText}
        </div>
      </div>

      <div>
        {statsState === 'idle' && (
          <button
            type='button'
            onClick={handleRunStats}
            className='px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium'
          >
            ทดสอบทางสถิติ 30 รอบ
          </button>
        )}
        {statsState === 'loading' && (
          <div className='flex items-center gap-2 text-gray-600'>
            <span className='inline-block w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin'></span>
            <span>กำลังทดสอบ 30 รอบ... (ใช้เวลาประมาณ 5-10 วินาที)</span>
          </div>
        )}
        {statsState === 'error' && (
          <div className='flex items-center gap-3'>
            <div className='text-red-600 text-sm'>❌ ทดสอบสถิติไม่สำเร็จ</div>
            <button
              type='button'
              onClick={handleRunStats}
              className='px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm'
            >
              ลองใหม่
            </button>
          </div>
        )}
      </div>

      {statsState === 'success' && statsData && (
        <StatsSection data={statsData} />
      )}
    </div>
  );
}

export default ComparePanel;
