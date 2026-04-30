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

function fmtNum1(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return Number(v).toLocaleString('th-TH', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  });
}

function fmtInt(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return Math.round(v).toLocaleString('th-TH');
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
// `axisLabel` controls the rotated y-axis caption.
function BoxPlotSvg(props) {
  var baStats = props.baStats;
  var hcaStats = props.hcaStats;
  var axisLabel = props.axisLabel || 'Value';
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
        {axisLabel}
      </text>
      {/* Boxes */}
      {renderBox(baStats, baX, BA_COLOR, 'BA')}
      {renderBox(hcaStats, hcaX, HCA_COLOR, 'HCA')}
    </svg>
  );
}

// Day 9.7-fix: caption focuses on iteration-speed hypothesis. Cost is
// reported as a confirmation that both algorithms find the same answer.
function buildCaption(statsResult) {
  if (!statsResult) return '';
  var ba = statsResult.ba.iterStats;
  var hca = statsResult.hca.iterStats;
  var w = statsResult.wilcoxon;
  var trials = statsResult.trials;

  var caption = 'จากการทดสอบ ' + trials + ' รอบ ';
  caption += 'BA พบคำตอบที่ iteration เฉลี่ย ' + fmtNum1(ba.mean) + ' \u00B1 ' + fmtNum1(ba.std) + ' รอบ ';
  caption += 'ส่วน HCA ใช้ ' + fmtNum1(hca.mean) + ' \u00B1 ' + fmtNum1(hca.std) + ' รอบ ';

  if (w.pValue < 0.05) {
    if (ba.mean < hca.mean) {
      caption += '\u2192 BA พบคำตอบเร็วกว่า HCA อย่างมีนัยสำคัญทางสถิติ ';
    } else {
      caption += '\u2192 HCA พบคำตอบเร็วกว่า BA อย่างมีนัยสำคัญทางสถิติ ';
    }
    caption += '(Wilcoxon one-sided p = ' + fmtP(w.pValue) + ')';
  } else {
    caption += '\u2192 ไม่สามารถสรุปได้ว่าอัลกอริทึมใดเร็วกว่ากัน ';
    caption += '(Wilcoxon one-sided p = ' + fmtP(w.pValue) + ')';
  }
  return caption;
}

function IterStatsBlock(props) {
  var label = props.label;
  var stats = props.stats;
  var color = props.color;
  var isBA = props.isBA;
  var border = isBA ? 'border-blue-200 bg-blue-50' : 'border-orange-200 bg-orange-50';
  var headerCls = isBA ? 'text-blue-800' : 'text-orange-700';
  void color;
  return (
    <div className={'p-3 rounded border ' + border}>
      <div className={'font-bold mb-1 ' + headerCls}>{label}</div>
      <div>mean = {fmtNum1(stats.mean)} {'\u00B1'} {fmtNum1(stats.std)} รอบ</div>
      <div>median = {fmtNum1(stats.median)}</div>
      <div>min = {fmtInt(stats.min)}, max = {fmtInt(stats.max)}</div>
      <div>Q1 = {fmtNum1(stats.q1)}, Q3 = {fmtNum1(stats.q3)}</div>
    </div>
  );
}

function CostConfirmRow(props) {
  var ba = props.baCostStats;
  var hca = props.hcaCostStats;
  var sameAnswer = Math.abs(ba.mean - hca.mean) < 1e-6 && ba.std < 1e-6 && hca.std < 1e-6;
  return (
    <div className='p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2'>
      <h4 className='font-bold text-gray-800'>ต้นทุน (ข้อมูลเสริม — ยืนยันว่าได้คำตอบเดียวกัน)</h4>
      <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
        <div className='p-3 rounded border border-blue-200 bg-blue-50'>
          <div className='font-bold text-blue-800 mb-1'>BA</div>
          <div>{fmtNum2(ba.mean)} {'\u00B1'} {fmtNum2(ba.std)} บาท/m</div>
        </div>
        <div className='p-3 rounded border border-orange-200 bg-orange-50'>
          <div className='font-bold text-orange-700 mb-1'>HCA</div>
          <div>{fmtNum2(hca.mean)} {'\u00B1'} {fmtNum2(hca.std)} บาท/m</div>
        </div>
      </div>
      <div className={sameAnswer ? 'text-green-600 text-sm' : 'text-amber-700 text-sm'}>
        {sameAnswer
          ? '✅ ทั้งสองอัลกอริทึมหาคำตอบที่ต้นทุนเท่ากัน'
          : 'ค่าต้นทุนต่างกันเล็กน้อยระหว่าง trials (อาจเกิดจาก local optima ต่างกัน)'}
      </div>
    </div>
  );
}

function StatsSection(props) {
  var data = props.data;
  if (!data) return null;

  var baIter = data.ba.iterStats;
  var hcaIter = data.hca.iterStats;
  var w = data.wilcoxon;
  var significant = w.pValue < 0.05;
  var baFaster = baIter.mean < hcaIter.mean;

  var verdictNode;
  if (significant && baFaster) {
    verdictNode = (
      <div className='text-orange-600 font-bold'>
        ⚡ BA พบคำตอบเร็วกว่า HCA อย่างมีนัยสำคัญ (p &lt; 0.05)
      </div>
    );
  } else if (significant && !baFaster) {
    verdictNode = (
      <div className='text-red-600 font-bold'>
        ⚠️ HCA พบคำตอบเร็วกว่า BA อย่างมีนัยสำคัญ (p &lt; 0.05) — ผิดสมมุติฐาน
      </div>
    );
  } else {
    verdictNode = (
      <div className='text-gray-600'>
        ➖ ไม่แตกต่างอย่างมีนัยสำคัญ (p &ge; 0.05)
      </div>
    );
  }

  return (
    <div className='mt-6 space-y-4'>
      <div className='p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4'>
        <div>
          <h3 className='font-bold text-gray-800'>
            ทดสอบประสิทธิภาพอัลกอริทึม ({data.trials} trials)
          </h3>
          <div className='text-xs text-gray-600 mt-1'>
            สมมุติฐาน: BA พบคำตอบเร็วกว่า HCA &middot; Wilcoxon Signed-Rank Test (one-sided)
          </div>
        </div>

        <div className='bg-white rounded border border-gray-200 p-3'>
          <div className='text-sm font-semibold text-gray-700 mb-2'>
            การกระจายของรอบที่พบคำตอบ (Iteration Distribution)
          </div>
          <BoxPlotSvg baStats={baIter} hcaStats={hcaIter} axisLabel='Iteration (รอบ)' />
        </div>

        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm'>
          <IterStatsBlock label='BA' stats={baIter} color={BA_COLOR} isBA={true} />
          <IterStatsBlock label='HCA' stats={hcaIter} color={HCA_COLOR} isBA={false} />
        </div>

        <div className='text-sm text-gray-700'>
          Wilcoxon (one-sided, BA &lt; HCA) {' '}
          W = {Math.round(w.W)}, z = {fmtNum2(w.z)}, p = {fmtP(w.pValue)}, n = {w.n}
        </div>

        {verdictNode}

        <div className='text-sm text-gray-700 italic'>
          {buildCaption(data)}
        </div>
      </div>

      <CostConfirmRow baCostStats={data.ba.costStats} hcaCostStats={data.hca.costStats} />
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
