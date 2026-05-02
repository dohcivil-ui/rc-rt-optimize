<?php
require_once __DIR__ . '/../lib/Shared.php';

$pass = 0;
$fail = 0;

function assert_near($label, $actual, $expected, $tol = 1e-6) {
    global $pass, $fail;
    if (abs($actual - $expected) < $tol) { $pass++; }
    else { $fail++; echo "FAIL: $label  expected=$expected  actual=$actual\n"; }
}
function assert_eq($label, $actual, $expected) {
    global $pass, $fail;
    if ($actual === $expected) { $pass++; }
    else { $fail++; echo "FAIL: $label  expected=" . var_export($expected,true) . "  actual=" . var_export($actual,true) . "\n"; }
}

// --- initArrays ---
$a = Shared::initArrays();
assert_eq("DB count", count($a['DB']), 5);
assert_eq("SP count", count($a['SP']), 4);
assert_eq("tt count", count($a['tt']), 17);
assert_eq("tb count", count($a['tb']), 17);
assert_eq("TBase count", count($a['TBase']), 15);
assert_eq("Base count", count($a['Base']), 12);
assert_eq("LToe count", count($a['LToe']), 10);
assert_near("tt[0]", $a['tt'][0], 0.200);
assert_near("tt[16]", $a['tt'][16], 0.600);
assert_near("tb[0]", $a['tb'][0], 0.200);
assert_near("tb[16]", $a['tb'][16], 1.000);
assert_near("TBase[0]", $a['TBase'][0], 0.300);
assert_near("TBase[14]", $a['TBase'][14], 1.000);
assert_near("Base[0]", $a['Base'][0], 1.500);
assert_near("Base[11]", $a['Base'][11], 7.000);
assert_near("LToe[0]", $a['LToe'][0], 0.300);
assert_near("LToe[9]", $a['LToe'][9], 1.200);

// --- Ka/Kp (phi=30) ---
assert_near("Ka(30)", Shared::calculateKa(30), 0.333333, 1e-4);
assert_near("Kp(30)", Shared::calculateKp(30), 3.0, 1e-4);

// --- Safety Factors with known design ---
$d = ['tt'=>0.250, 'tb'=>0.400, 'TBase'=>0.400, 'Base'=>2.500, 'LToe'=>0.500, 'LHeel'=>2.500-0.500-0.400];
$H = 3.0; $H1 = 1.0; $gs = 1.8; $gc = 2.4; $phi = 30; $mu = 0.5; $qa = 20;

$fsOT = Shared::checkFS_OT($d, $H, $H1, $gs, $gc, $phi);
assert_eq("FS_OT is array", is_array($fsOT), true);
assert_eq("FS_OT has pass", isset($fsOT['pass']), true);
assert_eq("FS_OT > 0", $fsOT['FS_OT'] > 0, true);

$fsSL = Shared::checkFS_SL($d, $H, $H1, $gs, $gc, $phi, $mu);
assert_eq("FS_SL > 0", $fsSL['FS_SL'] > 0, true);

$fsBC = Shared::checkFS_BC($d, $H, $H1, $gs, $gc, $phi, $qa);
assert_eq("FS_BC > 0", $fsBC['FS_BC'] > 0, true);

// --- WSD params (fy=4000, fc=280) ---
$wsd = Shared::calculateWSDParams(4000, 280);
assert_near("wsd.fs", $wsd['fs'], 1700);
assert_near("wsd.fc", $wsd['fc'], 126.0);
assert_eq("wsd.n", $wsd['n'], 9);

// --- Cost calc with known steel indices ---
$steel = [
    'stemDB_idx'=>102, 'stemSP_idx'=>111,
    'toeDB_idx'=>100, 'toeSP_idx'=>112,
    'heelDB_idx'=>101, 'heelSP_idx'=>111
];
$cost = Shared::calculateCost($d, $H, $gc, 2524, 24, $steel);
assert_eq("cost is array", is_array($cost), true);
assert_eq("cost > 0", $cost['cost'] > 0, true);
assert_eq("V_total > 0", $cost['V_total'] > 0, true);

// --- checkDesignValid ---
$arrays = Shared::initArrays();
$steelZero = [
    'stemDB_idx'=>2, 'stemSP_idx'=>1,
    'toeDB_idx'=>0, 'toeSP_idx'=>2,
    'heelDB_idx'=>1, 'heelSP_idx'=>1
];
$result = Shared::checkDesignValid($d, $H, $H1, $gs, $gc, $phi, $mu, $qa, 0.07, $wsd, $steelZero, $arrays);
assert_eq("checkDesignValid is array", is_array($result), true);
assert_eq("checkDesignValid has valid", isset($result['valid']), true);

// --- Summary ---
$total = $pass + $fail;
echo "\nShared tests: $pass/$total passed" . ($fail > 0 ? " ($fail FAILED)" : " -- ALL GREEN") . "\n";
exit($fail > 0 ? 1 : 0);