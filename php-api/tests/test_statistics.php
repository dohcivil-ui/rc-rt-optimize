<?php
// test_statistics.php -- Day 11.3. Mirrors Node api/test/statistics.test.js
// Sections 1, 2, 2b. Section 3 (/api/compare integration) deferred to
// Engine.php commit (Day 11 Commit 4).
//
// Run from project root:
//   php php-api/tests/test_statistics.php
//
// Expected: PASS: 12 tests

declare(strict_types=1);

require_once __DIR__ . '/../lib/Statistics.php';

$passed = 0;
$failed = 0;

function pass(string $label): void {
    global $passed;
    $passed++;
    echo "  PASS: $label\n";
}

function fail(string $label, string $err): void {
    global $failed;
    $failed++;
    echo "  FAIL: $label  --  $err\n";
}

function check(string $label, callable $fn): void {
    try {
        $fn();
        pass($label);
    } catch (Throwable $e) {
        fail($label, $e->getMessage());
    }
}

// ---------- Assertion helpers (Node assert.* parallels) ----------

function assertStrictEqual($actual, $expected, string $msg = ''): void {
    if ($actual !== $expected) {
        $a = is_scalar($actual) ? var_export($actual, true) : gettype($actual);
        $e = is_scalar($expected) ? var_export($expected, true) : gettype($expected);
        $tail = $msg !== '' ? " ($msg)" : '';
        throw new RuntimeException("expected $e, got $a$tail");
    }
}

function assertOK($cond, string $msg = ''): void {
    if (!$cond) {
        throw new RuntimeException("expected truthy" . ($msg !== '' ? " ($msg)" : ''));
    }
}

function assertNaN($val, string $msg = ''): void {
    if (!is_float($val) || !is_nan($val)) {
        $tail = $msg !== '' ? " ($msg)" : '';
        throw new RuntimeException("expected NaN, got " . var_export($val, true) . $tail);
    }
}

function assertFinite($val, string $msg = ''): void {
    if (!(is_float($val) || is_int($val))) {
        throw new RuntimeException("not numeric" . ($msg !== '' ? " ($msg)" : ''));
    }
    if (is_nan((float)$val) || is_infinite((float)$val)) {
        throw new RuntimeException("not finite: " . var_export($val, true) . ($msg !== '' ? " ($msg)" : ''));
    }
}

function assertThrows(callable $fn, string $msg = ''): void {
    $threw = false;
    try { $fn(); } catch (Throwable $e) { $threw = true; }
    if (!$threw) {
        throw new RuntimeException("expected throw" . ($msg !== '' ? " ($msg)" : ''));
    }
}

// ---------- Section 1: descriptiveStats ----------
check('descriptiveStats: empty array', function () {
    $d = Statistics::descriptiveStats([]);
    assertStrictEqual($d['n'], 0);
    assertNaN($d['mean']);
});

check('descriptiveStats: single value', function () {
    $d = Statistics::descriptiveStats([5]);
    assertStrictEqual($d['n'], 1);
    assertStrictEqual($d['mean'], 5.0);
    assertStrictEqual($d['median'], 5.0);
    assertStrictEqual($d['std'], 0.0);
});

check('descriptiveStats: known array', function () {
    // [1,2,3,4,5,6,7,8,9,10]
    $arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    $d = Statistics::descriptiveStats($arr);
    assertStrictEqual($d['n'], 10);
    assertStrictEqual($d['mean'], 5.5);
    assertStrictEqual($d['median'], 5.5);
    assertStrictEqual($d['min'], 1);
    assertStrictEqual($d['max'], 10);
    // Sample std for 1..10 = sqrt(sum((x-5.5)^2)/9) = sqrt(82.5/9) ~ 3.0277
    assertOK(abs($d['std'] - 3.0277) < 1e-3, 'std got ' . $d['std']);
    // q1 / q3 via linear interpolation: 3.25, 7.75
    assertOK(abs($d['q1'] - 3.25) < 1e-9, 'q1 got ' . $d['q1']);
    assertOK(abs($d['q3'] - 7.75) < 1e-9, 'q3 got ' . $d['q3']);
});

// ---------- Section 2: wilcoxonSignedRank ----------
check('wilcoxon: identical arrays -> p = 1, n = 0', function () {
    $r = Statistics::wilcoxonSignedRank([1, 2, 3], [1, 2, 3]);
    assertStrictEqual($r['n'], 0);
    assertStrictEqual($r['W'], 0);
    assertStrictEqual($r['pValue'], 1);
    assertStrictEqual($r['conclusion'], 'ไม่แตกต่างอย่างมีนัยสำคัญ');
});

check('wilcoxon: A consistently larger than B -> small p', function () {
    // A - B always +5 -> all positive, n=8, W- = 0
    $a = [10, 11, 12, 13, 14, 15, 16, 17];
    $b = [5, 6, 7, 8, 9, 10, 11, 12];
    $r = Statistics::wilcoxonSignedRank($a, $b);
    assertStrictEqual($r['n'], 8);
    assertStrictEqual($r['Wminus'], 0.0);
    // Wplus = 1+2+...+8 = 36
    assertStrictEqual($r['Wplus'], 36.0);
    assertOK($r['pValue'] < 0.05, 'expected p<0.05 got ' . $r['pValue']);
    assertStrictEqual($r['conclusion'], 'แตกต่างอย่างมีนัยสำคัญ');
});

check('wilcoxon: mixed differences with one tie -> finite p', function () {
    // pairs: (5,3)=+2, (4,7)=-3, (8,8)=0(skip), (9,6)=+3, (2,5)=-3,
    //        (10,4)=+6, (1,7)=-6
    // Non-zero diffs after dropping the 0:
    //   d = +2, -3, +3, -3, +6, -6  -> n = 6
    // |d| sorted: 2, 3, 3, 3, 6, 6
    // ranks (avg ties): 2 -> 1; three 3s -> (2+3+4)/3 = 3; two 6s -> (5+6)/2 = 5.5
    // Wplus = 1 + 3 + 5.5 = 9.5
    // Wminus = 3 + 3 + 5.5 = 11.5
    $a = [5, 4, 8, 9, 2, 10, 1];
    $b = [3, 7, 8, 6, 5, 4, 7];
    $r = Statistics::wilcoxonSignedRank($a, $b);
    assertStrictEqual($r['n'], 6);
    assertOK(abs($r['Wplus'] - 9.5) < 1e-9, 'Wplus ' . $r['Wplus']);
    assertOK(abs($r['Wminus'] - 11.5) < 1e-9, 'Wminus ' . $r['Wminus']);
    assertStrictEqual($r['W'], 9.5);
    assertFinite($r['z']);
    assertOK($r['pValue'] >= 0 && $r['pValue'] <= 1);
});

check('wilcoxon: length mismatch throws', function () {
    assertThrows(function () {
        Statistics::wilcoxonSignedRank([1, 2], [1, 2, 3]);
    }, 'expected throw on length mismatch');
});

// ---------- Section 2b: one-sided alternatives (Day 9.7-fix) ----------
check('wilcoxon: invalid alternative throws', function () {
    assertThrows(function () {
        Statistics::wilcoxonSignedRank([1, 2], [3, 4], ['alternative' => 'bogus']);
    }, 'expected throw on invalid alternative');
});

check('wilcoxon: one-sided "less" -- A < B clearly -> small p_less', function () {
    $a = [1, 2, 3, 4, 5, 6];
    $b = [10, 20, 30, 40, 50, 60];
    $r = Statistics::wilcoxonSignedRank($a, $b, ['alternative' => 'less']);
    assertStrictEqual($r['alternative'], 'less');
    assertStrictEqual($r['Wplus'], 0.0);
    assertOK($r['pValue'] < 0.05, 'expected p_less < 0.05 got ' . $r['pValue']);
    assertOK($r['pGreater'] > 0.95, 'expected p_greater > 0.95 got ' . $r['pGreater']);
});

check('wilcoxon: one-sided "less" -- A > B -> large p_less', function () {
    $a = [10, 20, 30, 40, 50, 60];
    $b = [1, 2, 3, 4, 5, 6];
    $r = Statistics::wilcoxonSignedRank($a, $b, ['alternative' => 'less']);
    assertOK($r['pValue'] > 0.5, 'expected p_less > 0.5 got ' . $r['pValue']);
    assertOK($r['pGreater'] < 0.05, 'expected p_greater < 0.05 got ' . $r['pGreater']);
});

check('wilcoxon: one-sided "greater" -- A > B -> small p_greater', function () {
    $a = [10, 20, 30, 40, 50, 60];
    $b = [1, 2, 3, 4, 5, 6];
    $r = Statistics::wilcoxonSignedRank($a, $b, ['alternative' => 'greater']);
    assertStrictEqual($r['alternative'], 'greater');
    assertOK($r['pValue'] < 0.05, 'expected p_greater < 0.05 got ' . $r['pValue']);
});

check('wilcoxon: pTwoSided ~ 2 * min(pLess, pGreater) for non-zero diffs', function () {
    // Sanity: the two-sided p-value should equal twice the smaller
    // one-sided tail under symmetric continuity correction in cases
    // where there is a clear sign.
    $a = [1, 2, 3, 4, 5, 6, 7, 8];
    $b = [3, 5, 4, 6, 7, 9, 10, 12];
    $r = Statistics::wilcoxonSignedRank($a, $b, ['alternative' => 'two-sided']);
    $smaller = min($r['pLess'], $r['pGreater']);
    // Loose tolerance because continuity correction differs between
    // 'two-sided' (centred on 0) and one-sided (biased away from H1).
    assertOK(abs($r['pTwoSided'] - 2 * $smaller) < 0.05,
        'pTwoSided=' . $r['pTwoSided'] . ', 2*smaller=' . (2 * $smaller));
});

// ---------- Summary ----------
echo "\n";
if ($failed === 0) {
    echo "PASS: $passed tests\n";
    exit(0);
} else {
    echo "FAIL: $failed of " . ($passed + $failed) . " tests\n";
    exit(1);
}
