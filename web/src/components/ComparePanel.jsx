// web/src/components/ComparePanel.jsx
// Day 9.6: side-by-side BA vs HCA convergence chart + cost summary.
// Both algorithms ship the same costHistorySampled shape ({iter, cost}[]),
// so we merge them on `iter` and render two Lines on a single LineChart.

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

function ComparePanel(props) {
  var ba = props.baResult;
  var hca = props.hcaResult;
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
    summaryText = 'BA และ HCA ให้ผลเท่ากัน';
  } else {
    summaryText = winner + ' ดีกว่า ' + fmtCost(diff) + ' (' + diffPct.toFixed(2) + '%)';
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
    </div>
  );
}

export default ComparePanel;
