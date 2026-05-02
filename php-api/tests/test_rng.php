<?php
require_once __DIR__ . '/../lib/Rng.php';

$pass = 0;
$fail = 0;

function assert_eq($label, $actual, $expected) {
    global $pass, $fail;
    if ($actual === $expected) {
        $pass++;
    } else {
        $fail++;
        echo "FAIL: $label\n  expected: " . var_export($expected, true)
           . "\n  actual:   " . var_export($actual, true) . "\n";
    }
}

// Test 1: Determinism (same seed = same sequence)
$rng1 = Rng::createVB6Rng(12345);
$rng2 = Rng::createVB6Rng(12345);
for ($i = 0; $i < 100; $i++) {
    assert_eq("determinism iter $i", $rng1(), $rng2());
}

// Test 2: Range [0, 1)
$rng = Rng::createVB6Rng(99999);
for ($i = 0; $i < 1000; $i++) {
    $v = $rng();
    assert_eq("range_gte_0 iter $i", $v >= 0.0, true);
    assert_eq("range_lt_1 iter $i", $v < 1.0, true);
}

// Test 3: Default seed = 0x50000
$rng_default = Rng::createVB6Rng();
$rng_explicit = Rng::createVB6Rng(0x50000);
for ($i = 0; $i < 10; $i++) {
    assert_eq("default_seed iter $i", $rng_default(), $rng_explicit());
}

// Test 4: rand() range [low, high] inclusive
$rng = Rng::createVB6Rng(42);
for ($i = 0; $i < 500; $i++) {
    $v = Rng::rand(1, 17, $rng);
    assert_eq("rand_gte_low iter $i", $v >= 1, true);
    assert_eq("rand_lte_high iter $i", $v <= 17, true);
}

// Test 5: rand() hits both endpoints
$rng = Rng::createVB6Rng(7777);
$seen_min = false;
$seen_max = false;
for ($i = 0; $i < 10000; $i++) {
    $v = Rng::rand(1, 5, $rng);
    if ($v === 1) $seen_min = true;
    if ($v === 5) $seen_max = true;
}
assert_eq("rand_hits_min", $seen_min, true);
assert_eq("rand_hits_max", $seen_max, true);

// Summary
$total = $pass + $fail;
echo "\nRng tests: $pass/$total passed" . ($fail > 0 ? " ($fail FAILED)" : " -- ALL GREEN") . "\n";
exit($fail > 0 ? 1 : 0);