<?php
declare(strict_types=1);

require_once __DIR__ . '/Rng.php';
require_once __DIR__ . '/Shared.php';

/**
 * Bisection Algorithm (BA) for RC retaining wall optimization.
 *
 * Ported from backend/src/ba.js (which itself ports modBA.bas v3.1).
 * BA = HCA inner loop + outer bisection wrapper on 3 dims (tb, TBase, Base).
 *
 * VB6 quirks preserved:
 *   - bestIteration = 1 when initial design is valid (1-indexed)
 *   - costHistory sentinel = 999000 (when no valid design found yet)
 *   - Invalid cost sentinel = INF (PHP equivalent of JS Infinity)
 *   - Midpoint via intdiv (positive indices only -> matches Math.floor)
 *   - Inner iterations = 20 * countLoop (grows each outer loop)
 */
final class Ba
{
    // ============================================================
    // Constants -- VB6-style index bounds (identical to hca.js)
    // ============================================================
    public const TT_MIN    = 1;   public const TT_MAX    = 17;
    public const TB_MIN    = 20;  public const TB_MAX    = 36;
    public const TBASE_MIN = 40;  public const TBASE_MAX = 54;
    public const BASE_MIN  = 60;  public const BASE_MAX  = 71;
    public const LTOE_MIN  = 80;  public const LTOE_MAX  = 89;
    public const DB_MIN    = 100; public const DB_MAX    = 104;
    public const SP_MIN    = 110; public const SP_MAX    = 113;

    public const OFFSETS = [
        'tt'    => 1,
        'tb'    => 20,
        'TBase' => 40,
        'Base'  => 60,
        'LToe'  => 80,
    ];

    /** costHistory sentinel when no valid design found yet (VB6 line 668). */
    private const COST_HISTORY_SENTINEL = 999000;

    // ============================================================
    // Public API -- mirrors module.exports of ba.js
    // ============================================================

    /**
     * Lookup VB6 index -> physical value.
     */
    public static function wpLookup(array $arrays, string $type, int $vb6Idx): float
    {
        return (float) $arrays[$type][$vb6Idx - self::OFFSETS[$type]];
    }

    /**
     * Factory -- creates BA state with bisection structure.
     * VB6 ref: modBA.bas lines 30-73
     *
     * @param array $params  {H, H1, gamma_soil, gamma_concrete, phi, mu, qa, cover,
     *                        material:{fy, fc, concretePrice, steelPrice}}
     * @param array $options {seed?: int, rng?: callable}
     */
    public static function createBAState(array $params, array $options = []): array
    {
        $mat = $params['material'];

        if (isset($options['rng']) && is_callable($options['rng'])) {
            $rng = $options['rng'];
        } elseif (isset($options['seed'])) {
            $rng = Rng::createVB6Rng((int) $options['seed']);
        } else {
            // Non-deterministic default (parity with JS Math.random)
            $rng = static function () {
                return mt_rand() / (mt_getrandmax() + 1.0);
            };
        }

        return [
            'params'   => $params,
            'arrays'   => Shared::initArrays(),
            'wsd'      => Shared::calculateWSDParams($mat['fy'], $mat['fc']),
            'indices'  => [
                'tt' => 0, 'tb' => 0, 'TBase' => 0, 'Base' => 0, 'LToe' => 0,
                'stemDB' => 0, 'stemSP' => 0,
                'toeDB'  => 0, 'toeSP'  => 0,
                'heelDB' => 0, 'heelSP' => 0,
            ],
            'bisection' => [
                'tb'    => ['min' => 0, 'max' => 0, 'mid' => 0, 'midPrice' => 0.0],
                'TBase' => ['min' => 0, 'max' => 0, 'mid' => 0, 'midPrice' => 0.0],
                'Base'  => ['min' => 0, 'max' => 0, 'mid' => 0, 'midPrice' => 0.0],
            ],
            'counters' => [
                'totalCount' => 0,
                'countLoop'  => 0,
            ],
            'rng' => $rng,
        ];
    }

    /**
     * Compute bisection bounds + set initial indices (Mid-initial strategy).
     * VB6 ref: modBA.bas lines 105-218
     * Mutates state.indices and state.bisection.
     */
    public static function initializeDesignBA(array &$state): void
    {
        $H = $state['params']['H'];
        $arrays = $state['arrays'];

        $lim_tb_hi    = Shared::roundTo(0.12 * $H, 3);
        $lim_TBase_hi = Shared::roundTo(0.15 * $H, 3);
        $lim_Base_hi  = Shared::roundTo(0.70 * $H, 3);
        $lim_Base_lo  = Shared::roundTo(0.50 * $H, 3);
        $lim_LToe_hi  = Shared::roundTo(0.20 * $H, 3);
        $lim_LToe_lo  = Shared::roundTo(0.10 * $H, 3);

        // === tb bounds ===
        $tb_max_idx = self::TB_MAX;
        for ($i = self::TB_MAX; $i >= self::TB_MIN; $i--) {
            if (self::wpLookup($arrays, 'tb', $i) <= $lim_tb_hi) {
                $tb_max_idx = $i;
                break;
            }
        }
        $state['bisection']['tb']['min']      = self::TB_MIN;
        $state['bisection']['tb']['max']      = $tb_max_idx;
        $state['bisection']['tb']['mid']      = intdiv(self::TB_MIN + $tb_max_idx, 2);
        $state['bisection']['tb']['midPrice'] = INF;
        $state['indices']['tb']               = $state['bisection']['tb']['mid'];

        // === tt: Max-initial, scan down ===
        $state['indices']['tt'] = self::TT_MAX;
        for ($i = self::TT_MAX; $i >= self::TT_MIN; $i--) {
            if (self::wpLookup($arrays, 'tt', $i) <= self::wpLookup($arrays, 'tb', $state['indices']['tb'])) {
                $state['indices']['tt'] = $i;
                break;
            }
        }
        if ($state['indices']['tt'] < self::TT_MIN) $state['indices']['tt'] = self::TT_MIN;
        if ($state['indices']['tt'] > self::TT_MAX) $state['indices']['tt'] = self::TT_MAX;

        // Safety: tt <= tb (VB6 lines 142-149)
        if (self::wpLookup($arrays, 'tt', $state['indices']['tt']) > self::wpLookup($arrays, 'tb', $state['indices']['tb'])) {
            for ($i = self::TT_MAX; $i >= self::TT_MIN; $i--) {
                if (self::wpLookup($arrays, 'tt', $i) <= self::wpLookup($arrays, 'tb', $state['indices']['tb'])) {
                    $state['indices']['tt'] = $i;
                    break;
                }
            }
        }

        // === TBase bounds ===
        $TBase_max_idx = self::TBASE_MAX;
        for ($i = self::TBASE_MAX; $i >= self::TBASE_MIN; $i--) {
            if (self::wpLookup($arrays, 'TBase', $i) <= $lim_TBase_hi) {
                $TBase_max_idx = $i;
                break;
            }
        }
        $state['bisection']['TBase']['min']      = self::TBASE_MIN;
        $state['bisection']['TBase']['max']      = $TBase_max_idx;
        $state['bisection']['TBase']['mid']      = intdiv(self::TBASE_MIN + $TBase_max_idx, 2);
        $state['bisection']['TBase']['midPrice'] = INF;
        $state['indices']['TBase']               = $state['bisection']['TBase']['mid'];

        // === Base bounds ===
        $Base_min_idx = self::BASE_MIN;
        for ($i = self::BASE_MIN; $i <= self::BASE_MAX; $i++) {
            if (self::wpLookup($arrays, 'Base', $i) >= $lim_Base_lo) {
                $Base_min_idx = $i;
                break;
            }
        }
        $Base_max_idx = self::BASE_MAX;
        for ($i = self::BASE_MAX; $i >= self::BASE_MIN; $i--) {
            if (self::wpLookup($arrays, 'Base', $i) <= $lim_Base_hi) {
                $Base_max_idx = $i;
                break;
            }
        }
        $state['bisection']['Base']['min']      = $Base_min_idx;
        $state['bisection']['Base']['max']      = $Base_max_idx;
        $state['bisection']['Base']['mid']      = intdiv($Base_min_idx + $Base_max_idx, 2);
        $state['bisection']['Base']['midPrice'] = INF;
        $state['indices']['Base']               = $state['bisection']['Base']['mid'];

        // === LToe: mid of [0.1H, 0.2H] (not bisected) ===
        $LToe_min_idx = self::LTOE_MIN;
        for ($i = self::LTOE_MIN; $i <= self::LTOE_MAX; $i++) {
            if (self::wpLookup($arrays, 'LToe', $i) >= $lim_LToe_lo) {
                $LToe_min_idx = $i;
                break;
            }
        }
        $LToe_max_idx = self::LTOE_MAX;
        for ($i = self::LTOE_MAX; $i >= self::LTOE_MIN; $i--) {
            if (self::wpLookup($arrays, 'LToe', $i) <= $lim_LToe_hi) {
                $LToe_max_idx = $i;
                break;
            }
        }
        $state['indices']['LToe'] = intdiv($LToe_min_idx + $LToe_max_idx, 2);

        // === Steel: all DB/SP to mid of full range (VB6 integer truncation) ===
        $dbMid = intdiv(self::DB_MIN + self::DB_MAX, 2); // = 102
        $spMid = intdiv(self::SP_MIN + self::SP_MAX, 2); // = 111
        $state['indices']['stemDB'] = $dbMid; $state['indices']['stemSP'] = $spMid;
        $state['indices']['toeDB']  = $dbMid; $state['indices']['toeSP']  = $spMid;
        $state['indices']['heelDB'] = $dbMid; $state['indices']['heelSP'] = $spMid;
    }

    /**
     * Extract design + steel struct from current indices.
     * VB6 ref: modBA.bas lines 224-243
     */
    public static function getDesignFromCurrentBA(array $state): array
    {
        $arrays = $state['arrays'];
        $idx = $state['indices'];

        $tt    = self::wpLookup($arrays, 'tt',    $idx['tt']);
        $tb    = self::wpLookup($arrays, 'tb',    $idx['tb']);
        $TBase = self::wpLookup($arrays, 'TBase', $idx['TBase']);
        $Base  = self::wpLookup($arrays, 'Base',  $idx['Base']);
        $LToe  = self::wpLookup($arrays, 'LToe',  $idx['LToe']);
        $LHeel = Shared::calculateLHeel($Base, $LToe, $tb);

        return [
            'design' => [
                'tt' => $tt, 'tb' => $tb, 'TBase' => $TBase,
                'Base' => $Base, 'LToe' => $LToe, 'LHeel' => $LHeel,
            ],
            'steel' => [
                'stemDB_idx' => $idx['stemDB'], 'stemSP_idx' => $idx['stemSP'],
                'toeDB_idx'  => $idx['toeDB'],  'toeSP_idx'  => $idx['toeSP'],
                'heelDB_idx' => $idx['heelDB'], 'heelSP_idx' => $idx['heelSP'],
            ],
        ];
    }

    /**
     * BA-style neighbor generation with bisection-bounded clamping.
     * VB6 ref: modBA.bas lines 250-354
     * Returns NEW indices array; does NOT mutate state.
     */
    public static function generateNeighborBA(array $state): array
    {
        $arrays = $state['arrays'];
        $cur    = $state['indices'];
        $bis    = $state['bisection'];
        $H      = $state['params']['H'];
        $rng    = $state['rng'];

        // LToe constraint indices -- recomputed every call (VB6 parity)
        $lim_LToe_hi = Shared::roundTo(0.20 * $H, 3);
        $lim_LToe_lo = Shared::roundTo(0.10 * $H, 3);
        $LToe_min_idx = self::LTOE_MIN;
        for ($i = self::LTOE_MIN; $i <= self::LTOE_MAX; $i++) {
            if (self::wpLookup($arrays, 'LToe', $i) >= $lim_LToe_lo) {
                $LToe_min_idx = $i;
                break;
            }
        }
        $LToe_max_idx = self::LTOE_MAX;
        for ($i = self::LTOE_MAX; $i >= self::LTOE_MIN; $i--) {
            if (self::wpLookup($arrays, 'LToe', $i) <= $lim_LToe_hi) {
                $LToe_max_idx = $i;
                break;
            }
        }

        // 1) tb: rand(-1,1), clamp to bisection bounds
        $step = Rng::rand(-1, 1, $rng);
        $newTb = $cur['tb'] + $step;
        if ($newTb < $bis['tb']['min']) $newTb = $bis['tb']['min'];
        if ($newTb > $bis['tb']['max']) $newTb = $bis['tb']['max'];

        // 2) tt: rand(-2,2), clamp to IDX, then re-scan if WP_tt > WP_tb(newTb)
        $step = Rng::rand(-2, 2, $rng);
        $newTt = $cur['tt'] + $step;
        if ($newTt < self::TT_MIN) $newTt = self::TT_MIN;
        if ($newTt > self::TT_MAX) $newTt = self::TT_MAX;
        if (self::wpLookup($arrays, 'tt', $newTt) > self::wpLookup($arrays, 'tb', $newTb)) {
            for ($i = self::TT_MAX; $i >= self::TT_MIN; $i--) {
                if (self::wpLookup($arrays, 'tt', $i) <= self::wpLookup($arrays, 'tb', $newTb)) {
                    $newTt = $i;
                    break;
                }
            }
        }

        // 3) TBase: rand(-1,1), clamp to bisection bounds
        $step = Rng::rand(-1, 1, $rng);
        $newTBase = $cur['TBase'] + $step;
        if ($newTBase < $bis['TBase']['min']) $newTBase = $bis['TBase']['min'];
        if ($newTBase > $bis['TBase']['max']) $newTBase = $bis['TBase']['max'];

        // 4) LToe: rand(-2,2), clamp to scanned LToe min/max
        $step = Rng::rand(-2, 2, $rng);
        $newLToe = $cur['LToe'] + $step;
        if ($newLToe < $LToe_min_idx) $newLToe = $LToe_min_idx;
        if ($newLToe > $LToe_max_idx) $newLToe = $LToe_max_idx;

        // 5) Base: rand(-1,1), clamp to bisection bounds
        $step = Rng::rand(-1, 1, $rng);
        $newBase = $cur['Base'] + $step;
        if ($newBase < $bis['Base']['min']) $newBase = $bis['Base']['min'];
        if ($newBase > $bis['Base']['max']) $newBase = $bis['Base']['max'];

        // 6-11) Steel: rand(-2,2) each, clamp to full IDX range
        $step = Rng::rand(-2, 2, $rng);
        $newStemDB = $cur['stemDB'] + $step;
        if ($newStemDB < self::DB_MIN) $newStemDB = self::DB_MIN;
        if ($newStemDB > self::DB_MAX) $newStemDB = self::DB_MAX;

        $step = Rng::rand(-2, 2, $rng);
        $newStemSP = $cur['stemSP'] + $step;
        if ($newStemSP < self::SP_MIN) $newStemSP = self::SP_MIN;
        if ($newStemSP > self::SP_MAX) $newStemSP = self::SP_MAX;

        $step = Rng::rand(-2, 2, $rng);
        $newToeDB = $cur['toeDB'] + $step;
        if ($newToeDB < self::DB_MIN) $newToeDB = self::DB_MIN;
        if ($newToeDB > self::DB_MAX) $newToeDB = self::DB_MAX;

        $step = Rng::rand(-2, 2, $rng);
        $newToeSP = $cur['toeSP'] + $step;
        if ($newToeSP < self::SP_MIN) $newToeSP = self::SP_MIN;
        if ($newToeSP > self::SP_MAX) $newToeSP = self::SP_MAX;

        $step = Rng::rand(-2, 2, $rng);
        $newHeelDB = $cur['heelDB'] + $step;
        if ($newHeelDB < self::DB_MIN) $newHeelDB = self::DB_MIN;
        if ($newHeelDB > self::DB_MAX) $newHeelDB = self::DB_MAX;

        $step = Rng::rand(-2, 2, $rng);
        $newHeelSP = $cur['heelSP'] + $step;
        if ($newHeelSP < self::SP_MIN) $newHeelSP = self::SP_MIN;
        if ($newHeelSP > self::SP_MAX) $newHeelSP = self::SP_MAX;

        return [
            'tt' => $newTt, 'tb' => $newTb, 'TBase' => $newTBase, 'Base' => $newBase, 'LToe' => $newLToe,
            'stemDB' => $newStemDB, 'stemSP' => $newStemSP,
            'toeDB'  => $newToeDB,  'toeSP'  => $newToeSP,
            'heelDB' => $newHeelDB, 'heelSP' => $newHeelSP,
        ];
    }

    /**
     * Triple bisection update for tb, TBase, Base after inner loop.
     * VB6 ref: modBA.bas lines 681-727
     * Mutates state.bisection. Does NOT mutate state.indices.
     *
     * NOTE: Caller must pass INF (not a finite sentinel) for invalid designs,
     * so that `INF < INF === false` matches VB6's `999999999 < 999999999 === false`.
     */
    public static function doBisectionStep(array &$state, float $currentPrice): void
    {
        $idx = $state['indices'];
        $dims = ['tb', 'TBase', 'Base'];

        foreach ($dims as $dim) {
            $curIdx = $idx[$dim];

            if ($currentPrice < $state['bisection'][$dim]['midPrice']) {
                $state['bisection'][$dim]['max']      = $curIdx;
                $state['bisection'][$dim]['midPrice'] = $currentPrice;
            } else {
                $state['bisection'][$dim]['min']      = $curIdx;
            }

            $newMid = intdiv(
                $state['bisection'][$dim]['min'] + $state['bisection'][$dim]['max'],
                2
            );
            if ($newMid < $state['bisection'][$dim]['min']) $newMid = $state['bisection'][$dim]['min'];
            if ($newMid > $state['bisection'][$dim]['max']) $newMid = $state['bisection'][$dim]['max'];
            $state['bisection'][$dim]['mid'] = $newMid;
        }
    }

    /**
     * Main BA optimization loop.
     * VB6 ref: modBA.bas lines 361-744
     *
     * @param array $params  same shape as createBAState
     * @param array $options {maxIterations?: int=10000, seed?: int, rng?: callable, onIteration?: callable}
     * @return array {bestDesign, bestSteel, bestCost, bestIteration, costHistory, log, finalState}
     */
    public static function baOptimize(array $params, array $options = []): array
    {
        $maxIterations = (int) ($options['maxIterations'] ?? 10000);
        $onIteration   = $options['onIteration'] ?? null;

        $stateOpts = [];
        if (isset($options['seed'])) $stateOpts['seed'] = $options['seed'];
        if (isset($options['rng']))  $stateOpts['rng']  = $options['rng'];

        $state = self::createBAState($params, $stateOpts);
        self::initializeDesignBA($state);

        $mat         = $params['material'];
        $logArr      = [];
        $costHistory = array_fill(0, $maxIterations + 1, null);

        // === Initial design evaluation (iteration 0) ===
        $initial = self::getDesignFromCurrentBA($state);
        $initialCostResult = Shared::calculateCost(
            $initial['design'], $params['H'], $params['gamma_concrete'],
            $mat['concretePrice'], $mat['steelPrice'], $initial['steel']
        );
        $initialCost = $initialCostResult['cost'];
        $initialValidity = Shared::checkDesignValid(
            $initial['design'], $params['H'], $params['H1'],
            $params['gamma_soil'], $params['gamma_concrete'],
            $params['phi'], $params['mu'], $params['qa'], $params['cover'],
            $state['wsd'], self::steelTo0Based($initial['steel']), $state['arrays']
        );

        if ($initialValidity['valid']) {
            // VB6 quirk (modBA.bas line 529): bestIteration = 1 when initial valid
            $best          = $initial['design'];
            $bestSteel     = $initial['steel'];
            $bestCost      = $initialCost;
            $bestIteration = 1;
            $currentCost   = $initialCost;
            self::pushLogBA($logArr, 0, $initialCost, true, true, true, '', $bestCost, $bestIteration, $onIteration);
        } else {
            $best          = null;
            $bestSteel     = null;
            $bestCost      = INF;
            $bestIteration = 0;
            $currentCost   = INF;
            self::pushLogBA($logArr, 0, $initialCost, false, false, false, $initialValidity['reason'] ?? '', $bestCost, $bestIteration, $onIteration);
        }

        // === Main outer loop ===
        while ($state['counters']['totalCount'] < $maxIterations) {
            $state['counters']['countLoop']++;
            $innerIterations = 20 * $state['counters']['countLoop'];
            if ($state['counters']['totalCount'] + $innerIterations > $maxIterations) {
                $innerIterations = $maxIterations - $state['counters']['totalCount'];
            }

            // Reset Current values to bisection Mids
            $state['indices']['Base']  = $state['bisection']['Base']['mid'];
            $state['indices']['TBase'] = $state['bisection']['TBase']['mid'];
            $state['indices']['tb']    = $state['bisection']['tb']['mid'];

            // Clamp tt after reset
            if (self::wpLookup($state['arrays'], 'tt', $state['indices']['tt']) > self::wpLookup($state['arrays'], 'tb', $state['indices']['tb'])) {
                for ($j = self::TT_MAX; $j >= self::TT_MIN; $j--) {
                    if (self::wpLookup($state['arrays'], 'tt', $j) <= self::wpLookup($state['arrays'], 'tb', $state['indices']['tb'])) {
                        $state['indices']['tt'] = $j;
                        break;
                    }
                }
            }

            // Evaluate reset design to set currentCost
            $resetEval = self::getDesignFromCurrentBA($state);
            $resetCostResult = Shared::calculateCost(
                $resetEval['design'], $params['H'], $params['gamma_concrete'],
                $mat['concretePrice'], $mat['steelPrice'], $resetEval['steel']
            );
            $resetCost = $resetCostResult['cost'];
            $resetValidity = Shared::checkDesignValid(
                $resetEval['design'], $params['H'], $params['H1'],
                $params['gamma_soil'], $params['gamma_concrete'],
                $params['phi'], $params['mu'], $params['qa'], $params['cover'],
                $state['wsd'], self::steelTo0Based($resetEval['steel']), $state['arrays']
            );
            $currentCost = $resetValidity['valid'] ? $resetCost : INF;

            // Inner loop (HCA-style accept/reject)
            for ($i = 1; $i <= $innerIterations; $i++) {
                $state['counters']['totalCount']++;
                if ($state['counters']['totalCount'] > $maxIterations) break;

                $backup     = self::copyIndices($state['indices']);
                $newIndices = self::generateNeighborBA($state);
                $state['indices'] = $newIndices;

                $neighbor = self::getDesignFromCurrentBA($state);
                $neighborCostResult = Shared::calculateCost(
                    $neighbor['design'], $params['H'], $params['gamma_concrete'],
                    $mat['concretePrice'], $mat['steelPrice'], $neighbor['steel']
                );
                $neighborCost = $neighborCostResult['cost'];
                $validity = Shared::checkDesignValid(
                    $neighbor['design'], $params['H'], $params['H1'],
                    $params['gamma_soil'], $params['gamma_concrete'],
                    $params['phi'], $params['mu'], $params['qa'], $params['cover'],
                    $state['wsd'], self::steelTo0Based($neighbor['steel']), $state['arrays']
                );

                $accepted = false;
                $isBetter = false;
                $reason   = '';

                if ($validity['valid']) {
                    if ($neighborCost < $currentCost) {
                        // valid AND cheaper -- accept
                        $currentCost = $neighborCost;
                        $accepted    = true;
                        if ($neighborCost < $bestCost) {
                            $best          = $neighbor['design'];
                            $bestSteel     = $neighbor['steel'];
                            $bestCost      = $neighborCost;
                            $bestIteration = $state['counters']['totalCount'];
                            $isBetter      = true;
                        }
                    } else {
                        // valid but not cheaper -- reject
                        $state['indices'] = $backup;
                    }
                } else {
                    // invalid -- reject
                    $state['indices'] = $backup;
                    $reason = $validity['reason'] ?? '';
                }

                // Update cost history (VB6 lines 663-668)
                if ($bestIteration > 0) {
                    $costHistory[$state['counters']['totalCount']] = $bestCost;
                } else {
                    $costHistory[$state['counters']['totalCount']] = self::COST_HISTORY_SENTINEL;
                }

                self::pushLogBA(
                    $logArr,
                    $state['counters']['totalCount'],
                    $neighborCost,
                    (bool) $validity['valid'],
                    $isBetter,
                    $accepted,
                    $reason,
                    $bestCost,
                    $bestIteration,
                    $onIteration
                );
            }

            // Triple bisection step
            self::doBisectionStep($state, $currentCost);
        }

        return [
            'bestDesign'    => $best,
            'bestSteel'     => $bestSteel,
            'bestCost'      => $bestCost,
            'bestIteration' => $bestIteration,
            'costHistory'   => $costHistory,
            'log'           => $logArr,
            'finalState'    => $state,
        ];
    }

    // ============================================================
    // Private helpers -- mirror ba.js internal helpers
    // ============================================================

    /** Convert VB6-style steel indices to 0-based for Shared::checkDesignValid. */
    private static function steelTo0Based(array $steel): array
    {
        return [
            'stemDB_idx' => $steel['stemDB_idx'] - self::DB_MIN,
            'stemSP_idx' => $steel['stemSP_idx'] - self::SP_MIN,
            'toeDB_idx'  => $steel['toeDB_idx']  - self::DB_MIN,
            'toeSP_idx'  => $steel['toeSP_idx']  - self::SP_MIN,
            'heelDB_idx' => $steel['heelDB_idx'] - self::DB_MIN,
            'heelSP_idx' => $steel['heelSP_idx'] - self::SP_MIN,
        ];
    }

    /**
     * Shallow copy of indices array for backup/restore in inner loop.
     * PHP arrays are copy-on-write, so plain return is sufficient.
     */
    private static function copyIndices(array $idx): array
    {
        return $idx;
    }

    /** Push log entry + optional onIteration callback. */
    private static function pushLogBA(
        array &$logArr,
        int $iter,
        float $cost,
        bool $valid,
        bool $isBetter,
        bool $accepted,
        string $reason,
        float $bestSoFar,
        int $bestIter,
        ?callable $onIteration
    ): void {
        $entry = [
            'iter'      => $iter,
            'cost'      => $cost,
            'valid'     => $valid,
            'isBetter'  => $isBetter,
            'accepted'  => $accepted,
            'reason'    => $reason,
            'bestSoFar' => $bestSoFar,
            'bestIter'  => $bestIter,
        ];
        $logArr[] = $entry;
        if ($onIteration !== null) {
            $onIteration($entry);
        }
    }
}
