// web/src/components/VerificationPanel.jsx
// Day 9.5b-b: render result.verification (7 keys from /api/optimize).
// Shape follows api/src/lib/engine.js buildVerification (Day 9.5b-a).

function fmt3(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return v.toFixed(3);
}

function fmt2(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return v.toFixed(2);
}

function fmtInt(v) {
  if (typeof v !== 'number' || !isFinite(v)) return '-';
  return Math.round(v).toString();
}

function spacingCm(m) {
  if (typeof m !== 'number' || !isFinite(m)) return '-';
  return Math.round(m * 100);
}

function passMark(ok) {
  return ok ? '✅' : '❌';
}

function VerdictBadge(props) {
  var v = props.verification;
  var allPass = v.safetyFactors && v.safetyFactors.allPass === true;
  var algo = (v.optimization && v.optimization.algorithm) || '-';
  var iter = (v.optimization && typeof v.optimization.bestIteration === 'number')
    ? v.optimization.bestIteration : '-';
  var trials = (v.optimization && typeof v.optimization.trialsRun === 'number')
    ? v.optimization.trialsRun : '-';

  var badgeClass = allPass
    ? 'bg-green-100 text-green-800 border border-green-300'
    : 'bg-red-100 text-red-800 border border-red-300';
  var label = allPass
    ? '✅ ผ่านทุกเงื่อนไขความปลอดภัย'
    : '❌ ไม่ผ่านบางเงื่อนไข';

  return (
    <div className={'p-4 rounded-lg ' + badgeClass}>
      <div className='font-bold text-lg'>{label}</div>
      <div className='text-sm mt-1'>
        {algo} • {iter} iterations • {trials} trial
      </div>
    </div>
  );
}

function MaterialRow(props) {
  var m = props.material || {};
  var steel = m.steel || {};
  var wsd = m.wsd || {};
  var prices = m.prices || {};

  return (
    <div>
      <div className='font-bold text-lg mb-2'>คุณสมบัติวัสดุ</div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='p-4 rounded-lg border border-gray-200 bg-white'>
          <div className='font-semibold text-gray-800 mb-2'>เหล็ก {steel.grade || '-'}</div>
          <div className='text-sm text-gray-700 space-y-1'>
            <div>fy = {fmtInt(steel.fy)} ksc</div>
            <div>fs = {fmtInt(m.fs)} ksc</div>
            <div>n = {fmtInt(wsd.n)}</div>
            <div>ราคา = {fmtInt(prices.steelPrice)} บาท/kg</div>
          </div>
        </div>
        <div className='p-4 rounded-lg border border-gray-200 bg-white'>
          <div className='font-semibold text-gray-800 mb-2'>คอนกรีต fc&apos; = {fmtInt(m.fc_prime)} ksc</div>
          <div className='text-sm text-gray-700 space-y-1'>
            <div>fc_allow = {fmt2(m.fc_allow)} ksc</div>
            <div>k = {fmt3(wsd.k)} , j = {fmt3(wsd.j)}</div>
            <div>R = {fmt2(wsd.R)} ksc</div>
            <div>ราคา = {fmtInt(prices.concretePrice)} บาท/m³</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EarthAndWeightsRow(props) {
  var ep = props.earthPressures || {};
  var w = props.weights || {};

  return (
    <div>
      <div className='font-bold text-lg mb-2'>แรงดันดิน &amp; น้ำหนัก</div>
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
        <div className='p-4 rounded-lg border border-gray-200 bg-white'>
          <div className='font-semibold text-gray-800 mb-2'>แรงดันดิน (ton/m)</div>
          <div className='text-sm text-gray-700 space-y-1'>
            <div>Ka = {fmt3(ep.Ka)} , Kp = {fmt3(ep.Kp)}</div>
            <div>Pa = {fmt3(ep.Pa)} ton</div>
            <div>Pp = {fmt3(ep.Pp)} ton</div>
          </div>
        </div>
        <div className='p-4 rounded-lg border border-gray-200 bg-white'>
          <div className='font-semibold text-gray-800 mb-2'>น้ำหนัก (ton/m)</div>
          <div className='text-sm text-gray-700 space-y-1'>
            <div>W1 = {fmt3(w.W1)} , W2 = {fmt3(w.W2)}</div>
            <div>W3 = {fmt3(w.W3)} , W4 = {fmt3(w.W4)}</div>
            <div className='font-semibold'>W_total = {fmt3(w.W_total)} ton</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SteelTableRow(props) {
  var s = props.steel || {};
  var rows = [
    { key: 'stem', label: 'Stem', d: s.stem },
    { key: 'toe', label: 'Toe', d: s.toe },
    { key: 'heel', label: 'Heel', d: s.heel }
  ];

  return (
    <div>
      <div className='font-bold text-lg mb-2'>เหล็กเสริม (Steel Adequacy)</div>
      <div className='p-4 rounded-lg border border-gray-200 bg-white overflow-x-auto'>
        <table className='w-full text-sm'>
          <thead>
            <tr className='border-b border-gray-200 text-gray-600 text-left'>
              <th className='py-2 pr-3'>จุด</th>
              <th className='py-2 px-3 text-right'>M (t-m)</th>
              <th className='py-2 px-3 text-right'>As_req (cm²)</th>
              <th className='py-2 px-3 text-right'>As_prov (cm²)</th>
              <th className='py-2 px-3'>เหล็ก</th>
              <th className='py-2 pl-3 text-center'>ผล</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(function (r) {
              var d = r.d || {};
              var bar = d.bar || '-';
              var sp = spacingCm(d.spacing_m);
              var label = (bar === '-' || sp === '-') ? '-' : (bar + '@' + sp);
              return (
                <tr key={r.key} className='border-b border-gray-100 last:border-0'>
                  <td className='py-2 pr-3 font-medium text-gray-800'>{r.label}</td>
                  <td className='py-2 px-3 text-right text-gray-700'>{fmt2(d.moment)}</td>
                  <td className='py-2 px-3 text-right text-gray-700'>{fmt2(d.As_required)}</td>
                  <td className='py-2 px-3 text-right text-gray-700'>{fmt2(d.As_provided)}</td>
                  <td className='py-2 px-3 text-gray-700'>{label}</td>
                  <td className='py-2 pl-3 text-center'>{passMark(d.adequate === true)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FsRow(props) {
  var sf = props.safetyFactors || {};
  var items = [
    { key: 'FS_OT', label: 'FS_OT (Overturning)', d: sf.FS_OT },
    { key: 'FS_SL', label: 'FS_SL (Sliding)', d: sf.FS_SL },
    { key: 'FS_BC', label: 'FS_BC (Bearing)', d: sf.FS_BC }
  ];

  return (
    <div>
      <div className='font-bold text-lg mb-2'>Safety Factors</div>
      <div className='p-4 rounded-lg border border-gray-200 bg-white'>
        <table className='w-full text-sm'>
          <tbody>
            {items.map(function (it) {
              var d = it.d || {};
              var ok = d.pass === true;
              return (
                <tr key={it.key} className='border-b border-gray-100 last:border-0'>
                  <td className='py-2 pr-3 font-medium text-gray-800'>{it.label}</td>
                  <td className='py-2 px-3 text-right text-gray-700'>
                    {fmt2(d.value)} ≥ {fmt2(d.required)}
                  </td>
                  <td className='py-2 pl-3 text-right'>
                    {passMark(ok)} {ok ? 'ผ่าน' : 'ไม่ผ่าน'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BearingRow(props) {
  var bc = props.bearingCapacity || {};
  var qMax = bc.q_max;
  var qMin = bc.q_min;
  var qAllow = bc.q_allow;
  var ecc = bc.eccentricity;

  var qMaxOk = (typeof qMax === 'number' && typeof qAllow === 'number' && qMax > 0 && qMax <= qAllow);
  var qMinOk = (typeof qMin === 'number' && qMin >= 0);

  return (
    <div>
      <div className='font-bold text-lg mb-2'>Bearing Capacity</div>
      <div className='p-4 rounded-lg border border-gray-200 bg-white text-sm text-gray-700 space-y-1'>
        <div>e = {fmt3(ecc)} m</div>
        <div>
          q_max = {fmt2(qMax)} ≤ {fmt2(qAllow)} ton/m² {'  '}
          {passMark(qMaxOk)}
        </div>
        <div>
          q_min = {fmt2(qMin)} {qMinOk ? '(no tension)' : '(tension!)'} {'  '}
          {passMark(qMinOk)}
        </div>
      </div>
    </div>
  );
}

function VerificationPanel(props) {
  var v = props.verification;
  if (!v) return null;

  return (
    <div className='mt-8 space-y-4'>
      <h2 className='text-xl font-semibold text-gray-800'>
        ผลการตรวจสอบความปลอดภัย
      </h2>
      <VerdictBadge verification={v} />
      <MaterialRow material={v.material} />
      <EarthAndWeightsRow earthPressures={v.earthPressures} weights={v.weights} />
      <SteelTableRow steel={v.steel} />
      <FsRow safetyFactors={v.safetyFactors} />
      <BearingRow bearingCapacity={v.bearingCapacity} />
    </div>
  );
}

export default VerificationPanel;
