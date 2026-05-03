<?php
declare(strict_types=1);

// ============================================================
// xval_compare.php -- field-by-field diff of PHP vs Node xval JSON
// Usage:
//   php xval_compare.php              # bit-identical mode (tol=0, strict ===)
//   php xval_compare.php --tol=0.0001 # tolerance mode for floats
// Exit: 0 pass, 1 mismatch, 2 invalid CLI/missing input
// ============================================================

// --- CLI tol parsing ---
$tol = 0.0;
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('/^--tol=(.+)$/', $arg, $m)) {
        if (!is_numeric($m[1]) || (float) $m[1] < 0) {
            fwrite(STDERR, "ERROR: --tol must be non-negative number, got: " . $m[1] . "\n");
            exit(2);
        }
        $tol = (float) $m[1];
    } else {
        fwrite(STDERR, "ERROR: unknown arg: $arg\n");
        exit(2);
    }
}

$phpPath  = __DIR__ . '/xval_hca_php.json';
$nodePath = __DIR__ . '/../../xval_hca_node.json';

if (!file_exists($phpPath))  { fwrite(STDERR, "ERROR: PHP JSON not found at $phpPath\n");  exit(2); }
if (!file_exists($nodePath)) { fwrite(STDERR, "ERROR: Node JSON not found at $nodePath\n"); exit(2); }

$php  = json_decode(file_get_contents($phpPath),  true);
$node = json_decode(file_get_contents($nodePath), true);

if ($php === null)  { fwrite(STDERR, "ERROR: PHP JSON parse failed\n");  exit(2); }
if ($node === null) { fwrite(STDERR, "ERROR: Node JSON parse failed\n"); exit(2); }

// --- Recursive deep equality ---
// Returns ['ok' => bool, 'diffs' => [path => "PHP=X Node=Y"]]
function deepEq($a, $b, float $tol, string $path = ''): array
{
    // Both arrays -- recurse over union of keys
    if (is_array($a) && is_array($b)) {
        $diffs = [];
        $keys = array_unique(array_merge(array_keys($a), array_keys($b)));
        foreach ($keys as $k) {
            $sub = $path === '' ? (string) $k : $path . '.' . $k;
            if (!array_key_exists($k, $a)) { $diffs[$sub] = "missing in PHP";  continue; }
            if (!array_key_exists($k, $b)) { $diffs[$sub] = "missing in Node"; continue; }
            $r = deepEq($a[$k], $b[$k], $tol, $sub);
            if (!$r['ok']) $diffs = array_merge($diffs, $r['diffs']);
        }
        return ['ok' => empty($diffs), 'diffs' => $diffs];
    }

    // Both null
    if ($a === null && $b === null) return ['ok' => true, 'diffs' => []];

    // Null mismatch
    if ($a === null xor $b === null) {
        return ['ok' => false, 'diffs' => [$path => "PHP=" . var_export($a, true) . " Node=" . var_export($b, true)]];
    }

    // String compare -- always strict
    if (is_string($a) || is_string($b)) {
        $ok = ($a === $b);
        return ['ok' => $ok, 'diffs' => $ok ? [] : [$path => "PHP=" . var_export($a, true) . " Node=" . var_export($b, true)]];
    }

    // Bool compare -- always strict
    if (is_bool($a) || is_bool($b)) {
        $ok = ($a === $b);
        return ['ok' => $ok, 'diffs' => $ok ? [] : [$path => "PHP=" . var_export($a, true) . " Node=" . var_export($b, true)]];
    }

    // Numeric (int or float)
    if ((is_int($a) || is_float($a)) && (is_int($b) || is_float($b))) {
        if ($tol === 0.0) {
            // Strict: type AND value must match (1 !== 1.0)
            $ok = ($a === $b);
        } else {
            // Tolerance: numeric compare regardless of int/float type
            $ok = abs((float) $a - (float) $b) <= $tol;
        }
        return ['ok' => $ok, 'diffs' => $ok ? [] : [$path => "PHP=" . var_export($a, true) . " Node=" . var_export($b, true)]];
    }

    // Type mismatch fallback
    return ['ok' => false, 'diffs' => [$path => "type mismatch: PHP=" . gettype($a) . "(" . var_export($a, true) . ") Node=" . gettype($b) . "(" . var_export($b, true) . ")"]];
}

// --- Run compare ---
$result = deepEq($php, $node, $tol);

echo "PHP:  $phpPath\n";
echo "Node: $nodePath\n";
echo "Tolerance: $tol\n";
echo str_repeat('-', 60) . "\n";

if ($result['ok']) {
    echo "PASS bit-identical (tol=$tol, 0 mismatches)\n";
    exit(0);
} else {
    $count = count($result['diffs']);
    echo "FAIL: $count mismatches:\n";
    foreach ($result['diffs'] as $p => $d) {
        echo "  $p: $d\n";
    }
    if ($tol === 0.0) {
        echo "\nHint: if mismatches are int vs float of same value,\n";
        echo "      try: php xval_compare.php --tol=1e-15\n";
    }
    exit(1);
}
