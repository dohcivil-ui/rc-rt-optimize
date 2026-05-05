<?php
// Engine.php -- thin wrapper around Ba and Hca optimizers.
//
// Mirror of api/src/lib/engine.js (Node, 370L). Public API:
//   Engine::runOptimize($validatedParams, $runOptions)
//   Engine::runMultiTrial($validatedParams, $runOptions)
//   Engine::buildVerification($params, $bestDesign, $bestSteel, $bestIteration, $algorithm)
//   Engine::decodeSteel($bestSteel)
//   Engine::sampleCostHistory($history, $maxPoints)
//
// Day 11.4 -- PHP port locked to Node engine.js byte-for-byte semantics:
//   - algorithm fallback ('HCA' or default 'BA')
//   - d-effective floor 0.05 m
//   - grade derivation SD40 / SD30 / OTHER from fy
//   - paired-seed multi-trial (seed = trialIndex + 1)
//   - costHistorySampled: dense first 100 + stride sampling
//   - safetyFactors expose value + required + pass
//   - algorithm field in runOptimize return = lowercase ('ba' or 'hca')
//   - algorithm passed to buildVerification = UPPERCASE
//
// Statistics dependency: Day 11.3 (5541ab5) provides descriptiveStats and
// wilcoxonSignedRank used by runMultiTrial.

require_once __DIR__ . '/Shared.php';
require_once __DIR__ . '/Ba.php';
require_once __DIR__ . '/Hca.php';
require_once __DIR__ . '/Statistics.php';

class Engine
{
    // arrays cache -- mirror Node module-load caching of shared.initArrays().
    private static ?array $arraysCache = null;

    private static function getArrays(): array
    {
        if (self::$arraysCache === null) {
            self::$arraysCache = Shared::initArrays();
        }
        return self::$arraysCache;
    }

    // decodeSteel -- map raw bestSteel _idx values to human-readable.
    // DB_idx: 100-104 (arrays['DB'][0..4]) = 12, 16, 20, 25, 28 mm
    // SP_idx: 110-113 (arrays['SP'][0..3]) = 0.10, 0.15, 0.20, 0.25 m
    public static function decodeSteel(array $bestSteel): array
    {
        $arrays = self::getArrays();
        return [
            'stem' => self::decodeOne($bestSteel['stemDB_idx'], $bestSteel['stemSP_idx'], $arrays),
            'toe'  => self::decodeOne($bestSteel['toeDB_idx'],  $bestSteel['toeSP_idx'],  $arrays),
            'heel' => self::decodeOne($bestSteel['heelDB_idx'], $bestSteel['heelSP_idx'], $arrays),
        ];
    }

    private static function decodeOne(int $dbIdxVb, int $spIdxVb, array $arrays): array
    {
        $db = $arrays['DB'][$dbIdxVb - 100];
        $sp = $arrays['SP'][$spIdxVb - 110];
        return [
            'size'       => 'DB' . $db,
            'spacing_cm' => (int) round($sp * 100),
            'spacing_m'  => $sp,
        ];
    }

    // sampleCostHistory -- downsample costHistory to ~maxPoints for chart.
    // Skips null / non-finite entries. Always includes last valid point.
    public static function sampleCostHistory(array $history, ?int $maxPoints = null): array
    {
        if ($maxPoints === null || $maxPoints <= 0) {
            $maxPoints = 200;
        }
        $out = [];
        $historyLen = count($history);
        $denseEnd = min(100, $historyLen);

        // Dense first 100 entries (skip iter 0, mirror Node loop start at i=1)
        for ($i = 1; $i < $denseEnd; $i++) {
            $v = $history[$i];
            if ($v !== null && is_finite((float) $v)) {
                $out[] = ['iter' => $i, 'cost' => $v];
            }
        }

        // Stride-sampled remainder
        $remaining = $maxPoints - count($out);
        if ($remaining > 0) {
            $step = max(1, (int) floor(($historyLen - $denseEnd) / $remaining));
        } else {
            // Mirror JS Math.max(1, Math.floor(neg)) = 1 for negative remaining
            $step = 1;
        }
        for ($i = $denseEnd; $i < $historyLen; $i += $step) {
            $v = $history[$i];
            if ($v !== null && is_finite((float) $v)) {
                $out[] = ['iter' => $i, 'cost' => $v];
            }
        }

        // Always include last valid point
        $last = $historyLen - 1;
        if ($last >= 0 && (count($out) === 0 || $out[count($out) - 1]['iter'] !== $last)) {
            $v = $history[$last];
            if ($v !== null && is_finite((float) $v)) {
                $out[] = ['iter' => $last, 'cost' => $v];
            }
        }

        return $out;
    }

    // buildVerification -- deterministic geotech + WSD snapshot from Shared.
    // VB6-parity formulas only; no duplicate math here.
    // $algorithm is optional; defaults to 'BA' for back-compat with callers
    // that omit it.
    public static function buildVerification(
        array $params,
        array $bestDesign,
        array $bestSteel,
        int $bestIteration,
        ?string $algorithm = null
    ): array {
        $algoLabel = ($algorithm === 'HCA') ? 'HCA' : 'BA';
        $fy = $params['material']['fy'];
        $fcPrime = $params['material']['fc'];

        if ($fy === 4000) {
            $gradeStr = 'SD40';
        } elseif ($fy === 3000) {
            $gradeStr = 'SD30';
        } else {
            $gradeStr = 'OTHER';
        }

        $wsd = Shared::calculateWSDParams($fy, $fcPrime);

        $optimization = [
            'algorithm'     => $algoLabel,
            'trialsRun'     => 1,
            'bestIteration' => $bestIteration,
        ];

        $material = [
            'steel' => [
                'grade' => $gradeStr,
                'fy'    => $fy,
            ],
            'fs'       => $wsd['fs'],
            'fc_prime' => $fcPrime,
            'fc_allow' => $wsd['fc'],
            'wsd' => [
                'n' => $wsd['n'],
                'k' => $wsd['k'],
                'j' => $wsd['j'],
                'R' => $wsd['R'],
            ],
            'prices' => [
                'concretePrice' => $params['material']['concretePrice'],
                'steelPrice'    => $params['material']['steelPrice'],
            ],
        ];

        $Ka = Shared::calculateKa($params['phi']);
        $Kp = Shared::calculateKp($params['phi']);
        $Pa = Shared::calculatePa($params['gamma_soil'], $Ka, $params['H']);
        $Pp = Shared::calculatePp($params['gamma_soil'], $Kp, $params['H1']);

        $earthPressures = [
            'Ka' => $Ka,
            'Kp' => $Kp,
            'Pa' => $Pa,
            'Pp' => $Pp,
        ];

        $wtot = Shared::calculateWTotal($bestDesign, $params['H'], $params['H1'], $params['gamma_soil'], $params['gamma_concrete']);
        $w1r  = Shared::calculateW1($bestDesign, $params['H'], $params['H1'], $params['gamma_soil']);
        $w2r  = Shared::calculateW2($bestDesign, $params['H'], $params['gamma_soil']);
        $w3r  = Shared::calculateW3($bestDesign, $params['H'], $params['gamma_concrete']);
        $w4r  = Shared::calculateW4($bestDesign, $params['gamma_concrete']);

        $weights = [
            'W1'      => $w1r['W'],
            'W2'      => $w2r['W'],
            'W3'      => $w3r['W'],
            'W4'      => $w4r['W'],
            'W_total' => $wtot['WTotal'],
        ];

        $cover = $params['cover'];
        $dStem = $bestDesign['tb'] - $cover;
        $dToe  = $bestDesign['TBase'] - $cover;
        $dHeel = $bestDesign['TBase'] - $cover;
        if ($dStem <= 0.05) { $dStem = 0.05; }
        if ($dToe  <= 0.05) { $dToe  = 0.05; }
        if ($dHeel <= 0.05) { $dHeel = 0.05; }

        $MStem = Shared::calculateMomentStem($params['H1'], $params['gamma_soil'], $params['phi']);
        $MToe  = Shared::calculateMomentToe($bestDesign, $params['H'], $params['H1'], $params['gamma_soil'], $params['gamma_concrete'], $params['phi']);
        $MHeel = Shared::calculateMomentHeel($bestDesign, $params['H'], $params['H1'], $params['gamma_soil'], $params['gamma_concrete'], $params['phi']);

        $arrays = self::getArrays();

        $steel = [
            'stem' => self::oneSteel($bestSteel['stemDB_idx'], $bestSteel['stemSP_idx'], $MStem, $dStem, $wsd, $arrays),
            'toe'  => self::oneSteel($bestSteel['toeDB_idx'],  $bestSteel['toeSP_idx'],  $MToe,  $dToe,  $wsd, $arrays),
            'heel' => self::oneSteel($bestSteel['heelDB_idx'], $bestSteel['heelSP_idx'], $MHeel, $dHeel, $wsd, $arrays),
        ];

        $fsOtResult = Shared::checkFS_OT($bestDesign, $params['H'], $params['H1'], $params['gamma_soil'], $params['gamma_concrete'], $params['phi']);
        $fsSlResult = Shared::checkFS_SL($bestDesign, $params['H'], $params['H1'], $params['gamma_soil'], $params['gamma_concrete'], $params['phi'], $params['mu']);
        $fsBcResult = Shared::checkFS_BC($bestDesign, $params['H'], $params['H1'], $params['gamma_soil'], $params['gamma_concrete'], $params['phi'], $params['qa']);

        $safetyFactors = [
            'FS_OT' => [
                'value'    => $fsOtResult['FS_OT'],
                'required' => Shared::FS_OT_MIN,
                'pass'     => $fsOtResult['pass'],
            ],
            'FS_SL' => [
                'value'    => $fsSlResult['FS_SL'],
                'required' => Shared::FS_SL_MIN,
                'pass'     => $fsSlResult['pass'],
            ],
            'FS_BC' => [
                'value'    => $fsBcResult['FS_BC'],
                'required' => Shared::FS_BC_MIN,
                'pass'     => $fsBcResult['pass'],
            ],
            'allPass' => $fsOtResult['pass'] && $fsSlResult['pass'] && $fsBcResult['pass'],
        ];

        $bearingCapacity = [
            'eccentricity' => $fsBcResult['e'],
            'q_max'        => $fsBcResult['q_max'],
            'q_min'        => $fsBcResult['q_min'],
            'q_allow'      => $params['qa'],
        ];

        return [
            'optimization'    => $optimization,
            'material'        => $material,
            'earthPressures'  => $earthPressures,
            'weights'         => $weights,
            'steel'           => $steel,
            'safetyFactors'   => $safetyFactors,
            'bearingCapacity' => $bearingCapacity,
        ];
    }

    private static function oneSteel(int $dbIdxVb, int $spIdxVb, float $momentVal, float $dEff, array $wsd, array $arrays): array
    {
        $db0 = $dbIdxVb - 100;
        $sp0 = $spIdxVb - 110;
        $dbMm = $arrays['DB'][$db0];
        $barLabel = 'DB' . $dbMm;
        $spv = $arrays['SP'][$sp0];
        $AsReq  = Shared::calculateAsRequired($momentVal, $wsd['fs'], $wsd['j'], $dEff);
        $AsProv = Shared::calculateAsProvided($db0, $sp0, $arrays);
        return [
            'moment'      => $momentVal,
            'd_effective' => $dEff,
            'bar'         => $barLabel,
            'spacing_m'   => $spv,
            'As_required' => $AsReq,
            'As_provided' => $AsProv,
            'adequate'    => $AsProv >= $AsReq,
        ];
    }

    // runOptimize -- call BA or HCA with validated params, strip large
    // internal state (log, costHistory, finalState) before returning.
    // Wall-clock runtime measured here, not inside the engine.
    public static function runOptimize(array $validatedParams, ?array $runOptions = null): array
    {
        $options = $validatedParams['options'] ?? [];
        $runOptions = $runOptions ?? [];
        $algorithm = (($runOptions['algorithm'] ?? null) === 'HCA') ? 'HCA' : 'BA';

        $engineParams = [
            'H'              => $validatedParams['H'],
            'H1'             => $validatedParams['H1'],
            'gamma_soil'     => $validatedParams['gamma_soil'],
            'gamma_concrete' => $validatedParams['gamma_concrete'],
            'phi'            => $validatedParams['phi'],
            'mu'             => $validatedParams['mu'],
            'qa'             => $validatedParams['qa'],
            'cover'          => $validatedParams['cover'],
            'material'       => $validatedParams['material'],
        ];

        $maxIterInput = $options['maxIterations'] ?? null;
        $engineOptions = [
            'maxIterations' => (is_int($maxIterInput) || is_float($maxIterInput))
                ? $maxIterInput
                : 5000,
        ];
        if (isset($options['seed'])) {
            $engineOptions['seed'] = $options['seed'];
        }

        $startTime = microtime(true);
        if ($algorithm === 'HCA') {
            $result = Hca::hcaOptimize($engineParams, $engineOptions);
        } else {
            $result = Ba::baOptimize($engineParams, $engineOptions);
        }
        $endTime = microtime(true);

        $verification = self::buildVerification(
            $validatedParams,
            $result['bestDesign'],
            $result['bestSteel'],
            $result['bestIteration'],
            $algorithm
        );

        return [
            'bestCost'           => $result['bestCost'],
            'bestIteration'      => $result['bestIteration'],
            'bestDesign'         => $result['bestDesign'],
            'bestSteel'          => $result['bestSteel'],
            'bestSteelDecoded'   => self::decodeSteel($result['bestSteel']),
            'runtime_ms'         => (int) round(($endTime - $startTime) * 1000),
            'algorithm'          => strtolower($algorithm),
            'costHistorySampled' => self::sampleCostHistory($result['costHistory']),
            'verification'       => $verification,
        ];
    }

    // runMultiTrial -- Day 9.7. Runs BA and HCA `trials` times each with
    // paired seeds (seed = trialIndex + 1 for both algorithms), then
    // summarizes both cost AND iteration distributions and runs Wilcoxon
    // signed-rank tests on the paired arrays.
    //
    // Day 9.7-fix: PRIMARY metric is `bestIteration`. The hypothesis is
    // that BA reaches its best design earlier than HCA, so the iteration
    // test is one-sided ('less'). Cost is reported as a secondary stat to
    // confirm both algorithms converge to the same optimum.
    public static function runMultiTrial(array $validatedParams, ?array $runOptions = null): array
    {
        $runOptions = $runOptions ?? [];
        $trialsInput = $runOptions['trials'] ?? 30;
        $trials = (is_int($trialsInput) || is_float($trialsInput))
            ? (int) floor($trialsInput)
            : 30;
        if ($trials < 2)   { $trials = 2; }
        if ($trials > 100) { $trials = 100; }

        $maxIterInput = $runOptions['maxIterations'] ?? null;
        $maxIterations = (is_int($maxIterInput) || is_float($maxIterInput))
            ? $maxIterInput
            : 5000;

        $baCosts = [];
        $hcaCosts = [];
        $baIters = [];
        $hcaIters = [];
        $baRuntimes = [];
        $hcaRuntimes = [];
        $baBestRun = null;
        $hcaBestRun = null;

        $totalStart = microtime(true);
        for ($i = 0; $i < $trials; $i++) {
            $seed = $i + 1;

            $pBa = $validatedParams;
            $pBa['options'] = array_merge($validatedParams['options'] ?? [], [
                'seed'          => $seed,
                'maxIterations' => $maxIterations,
            ]);
            $pHca = $validatedParams;
            $pHca['options'] = array_merge($validatedParams['options'] ?? [], [
                'seed'          => $seed,
                'maxIterations' => $maxIterations,
            ]);

            $rBa  = self::runOptimize($pBa,  ['algorithm' => 'BA']);
            $rHca = self::runOptimize($pHca, ['algorithm' => 'HCA']);

            $baCosts[]     = $rBa['bestCost'];
            $hcaCosts[]    = $rHca['bestCost'];
            $baIters[]     = $rBa['bestIteration'];
            $hcaIters[]    = $rHca['bestIteration'];
            $baRuntimes[]  = $rBa['runtime_ms'];
            $hcaRuntimes[] = $rHca['runtime_ms'];

            if ($baBestRun === null || $rBa['bestCost'] < $baBestRun['bestCost']) {
                $rBa['trialIndex'] = $i + 1;
                $rBa['seed'] = $seed;
                $baBestRun = $rBa;
            }
            if ($hcaBestRun === null || $rHca['bestCost'] < $hcaBestRun['bestCost']) {
                $rHca['trialIndex'] = $i + 1;
                $rHca['seed'] = $seed;
                $hcaBestRun = $rHca;
            }
        }
        $totalRuntime = (int) round((microtime(true) - $totalStart) * 1000);

        $baCostStats  = Statistics::descriptiveStats($baCosts);
        $hcaCostStats = Statistics::descriptiveStats($hcaCosts);
        $baIterStats  = Statistics::descriptiveStats($baIters);
        $hcaIterStats = Statistics::descriptiveStats($hcaIters);

        // Primary: one-sided iteration test (H1: BA reaches optimum sooner).
        $wilcoxonIter = Statistics::wilcoxonSignedRank($baIters, $hcaIters, ['alternative' => 'less']);
        // Secondary: two-sided cost test.
        $wilcoxonCost = Statistics::wilcoxonSignedRank($baCosts, $hcaCosts);

        return [
            'trials'        => $trials,
            'maxIterations' => $maxIterations,
            'runtime_ms'    => $totalRuntime,
            'metric'        => 'iteration',
            'ba' => [
                'costs'       => $baCosts,
                'iterations'  => $baIters,
                'runtimes_ms' => $baRuntimes,
                'iterStats'   => $baIterStats,
                'costStats'   => $baCostStats,
            ],
            'hca' => [
                'costs'       => $hcaCosts,
                'iterations'  => $hcaIters,
                'runtimes_ms' => $hcaRuntimes,
                'iterStats'   => $hcaIterStats,
                'costStats'   => $hcaCostStats,
            ],
            'baBestRun'    => $baBestRun,
            'hcaBestRun'   => $hcaBestRun,
            'wilcoxon'     => $wilcoxonIter,
            'wilcoxonCost' => $wilcoxonCost,
        ];
    }
}
