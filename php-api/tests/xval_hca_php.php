<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/Rng.php';
require_once __DIR__ . '/../lib/Shared.php';
require_once __DIR__ . '/../lib/Hca.php';

// MUST match Hca::NO_VALID_SENTINEL = 999000 in lib/Hca.php:38
// (hardcoded here so this script is self-contained and the value is explicit
// in the cross-validation contract; do NOT change without updating Hca.php)
const NO_VALID_SENTINEL = 999000;

// === Fixed params (handoff Day 9.96 spec; H=3, fc=280) ===
$params = [
    'H' => 3.0, 'H1' => 0.5,
    'gamma_soil' => 1.8, 'gamma_concrete' => 2.4,
    'phi' => 30.0, 'mu' => 0.5, 'qa' => 15.0, 'cover' => 0.05,
    'material' => [
        'fy' => 4000.0, 'fc' => 280.0,
        'concretePrice' => 2200.0, 'steelPrice' => 25.0,
    ],
];
$options = ['seed' => 12345, 'maxIterations' => 1000];

$result = Hca::hcaOptimize($params, $options);

// CRITICAL: INF -> 999000 (json_encode(INF) returns 0 silently and breaks parity)
$bestCost = is_infinite((float) $result['bestCost'])
    ? NO_VALID_SENTINEL
    : $result['bestCost'];

// === Schema (must match xval_hca_node.js value-for-value) ===
$summary = [
    'params'        => $params,
    'options'       => $options,
    'bestCost'      => $bestCost,
    'bestIteration' => $result['bestIteration'],
    'bestDesign'    => $result['bestDesign'],
    'bestSteel'     => $result['bestSteel'],
    'costHistorySample' => [
        '1'    => $result['costHistory'][1]    ?? null,
        '100'  => $result['costHistory'][100]  ?? null,
        '250'  => $result['costHistory'][250]  ?? null,
        '500'  => $result['costHistory'][500]  ?? null,
        '750'  => $result['costHistory'][750]  ?? null,
        '1000' => $result['costHistory'][1000] ?? null,
    ],
];

$outPath = __DIR__ . '/xval_hca_php.json';
file_put_contents($outPath, json_encode($summary, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "xval_hca_php.json written: bestCost="
   . (is_int($bestCost) ? (string) $bestCost : sprintf('%.4f', $bestCost))
   . " bestIteration=" . $result['bestIteration'] . "\n";
exit(0);
