<?php
declare(strict_types=1);

require_once __DIR__ . '/Rng.php';
require_once __DIR__ . '/Shared.php';

/**
 * Hill Climbing Algorithm (HCA) for RC retaining wall optimization.
 *
 * Ported from backend/src/hca.js (which itself ports modHillClimbing.bas v5.1
 * RC_RT_HCA v2.8). Differs from BA in 4 key ways:
 *   - Variable update order: tt-then-tb (BA does tb-then-tt)
 *   - No outer bisection wrapper -- single flat loop
 *   - Inner iterations fixed (no 20*countLoop growth)
 *   - Initial design uses constrained-Max (largest VB6 idx where WP <= constraint,
 *     then HCA climbs down). FIXED no-shadow-bug version.
 *
 * VB6 quirks preserved:
 *   - bestIteration = 1 when initial design is valid (1-indexed)
 *   - costHistory sentinel = 999000 (when no valid design found yet)
 *   - bestCost field stays PHP INF when no valid found; JSON layer must map
 *     INF -> NO_VALID_SENTINEL before json_encode (json_encode(INF) returns 0)
 */
final class Hca
{
    // ============================================================
    // Constants -- VB6-style index bounds (numerics match Ba.php)
    // ============================================================
    public const IDX_TT_MIN    = 1;   public const IDX_TT_MAX    = 17;
    public const IDX_TB_MIN    = 20;  public const IDX_TB_MAX    = 36;
    public const IDX_TBASE_MIN = 40;  public const IDX_TBASE_MAX = 54;
    public const IDX_BASE_MIN  = 60;  public const IDX_BASE_MAX  = 71;
    public const IDX_LTOE_MIN  = 80;  public const IDX_LTOE_MAX  = 89;
    public const IDX_DB_MIN    = 100; public const IDX_DB_MAX    = 104;
    public const IDX_SP_MIN    = 110; public const IDX_SP_MAX    = 113;

    /** costHistory sentinel before any valid design (mirror hca.js line 378). */
    public const NO_VALID_SENTINEL = 999000;

    /** VB6 idx -> physical-array offset (mirror hca.js OFFSETS). */
    private const OFFSETS = [
        'tt'    => 1,
        'tb'    => 20,
        'TBase' => 40,
        'Base'  => 60,
        'LToe'  => 80,
    ];

    // ============================================================
    // Private helpers -- mirror hca.js internal helpers
    // ============================================================

    /** Lookup VB6 index -> physical value via Shared::initArrays() arrays. */
    private static function wpLookup(array $arrays, string $type, int $vb6Idx): float
    {
        return (float) $arrays[$type][$vb6Idx - self::OFFSETS[$type]];
    }

    /** Convert VB6-style steel indices to 0-based for Shared::checkDesignValid. */
    private static function steelTo0Based(array $steel): array
    {
        return [
            'stemDB_idx' => $steel['stemDB_idx'] - self::IDX_DB_MIN,
            'stemSP_idx' => $steel['stemSP_idx'] - self::IDX_SP_MIN,
            'toeDB_idx'  => $steel['toeDB_idx']  - self::IDX_DB_MIN,
            'toeSP_idx'  => $steel['toeSP_idx']  - self::IDX_SP_MIN,
            'heelDB_idx' => $steel['heelDB_idx'] - self::IDX_DB_MIN,
            'heelSP_idx' => $steel['heelSP_idx'] - self::IDX_SP_MIN,
        ];
    }

    /**
     * Shallow copy of indices array for backup/restore around neighbor proposal.
     * PHP arrays are copy-on-write, so plain return is sufficient.
     */
    private static function copyIndices(array $idx): array
    {
        return $idx;
    }

    // ============================================================
    // Public API -- mirrors module.exports of hca.js
    // ============================================================

    /**
     * Factory -- creates HCA state (no bisection, no countLoop counters).
     *
     * @param array $params  {H, H1, gamma_soil, gamma_concrete, phi, mu, qa, cover,
     *                        material:{fy, fc, concretePrice, steelPrice}}
     * @param array $options {seed?: int, rng?: callable}
     */
    public static function createHCAState(array $params, array $options = []): array
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
            'params'  => $params,
            'arrays'  => Shared::initArrays(),
            'wsd'     => Shared::calculateWSDParams($mat['fy'], $mat['fc']),
            'indices' => [
                'tt' => 0, 'tb' => 0, 'TBase' => 0, 'Base' => 0, 'LToe' => 0,
                'stemDB' => 0, 'stemSP' => 0,
                'toeDB'  => 0, 'toeSP'  => 0,
                'heelDB' => 0, 'heelSP' => 0,
            ],
            'rng'     => $rng,
        ];
    }

    /**
     * Set state.indices using "largest idx where WP <= constraint, walk down"
     * for tb/TBase/Base/LToe; tt clamped <= tb; steel = max DB, min SP.
     *
     * FIXED no-shadow-bug version (hca.js lines 60-66): VB6 had variable
     * shadowing that caused tb/TBase to init at MIN instead of MAX. This
     * implementation matches stated methodology: start from max, HCA climbs down.
     *
     * Mutates $state['indices'] by reference.
     */
    public static function initializeCurrentDesignHCA(array &$state): void
    {
        $H      = $state['params']['H'];
        $arrays = $state['arrays'];

        // Round constraint limits to 3 decimals (match Shared::roundTo precision
        // in initArrays; avoids IEEE 754 mismatch like 0.15*6 = 0.8999...)
        $lim_tb    = Shared::roundTo(0.12 * $H, 3);
        $lim_TBase = Shared::roundTo(0.15 * $H, 3);
        $lim_Base  = Shared::roundTo(0.70 * $H, 3);
        $lim_LToe  = Shared::roundTo(0.20 * $H, 3);

        // tb: largest idx where WP_tb(idx) <= 0.12*H
        $state['indices']['tb'] = self::IDX_TB_MIN;
        for ($i = self::IDX_TB_MAX; $i >= self::IDX_TB_MIN; $i--) {
            if (self::wpLookup($arrays, 'tb', $i) <= $lim_tb) {
                $state['indices']['tb'] = $i;
                break;
            }
        }

        // tt: largest idx where WP_tt(idx) <= WP_tb(tb) (tt <= tb)
        $state['indices']['tt'] = self::IDX_TT_MAX;
        for ($i = self::IDX_TT_MAX; $i >= self::IDX_TT_MIN; $i--) {
            if (self::wpLookup($arrays, 'tt', $i) <= self::wpLookup($arrays, 'tb', $state['indices']['tb'])) {
                $state['indices']['tt'] = $i;
                break;
            }
        }

        // Fixup: ensure tb >= tt after selection (hca.js lines 93-100)
        if (self::wpLookup($arrays, 'tb', $state['indices']['tb']) < self::wpLookup($arrays, 'tt', $state['indices']['tt'])) {
            for ($i = self::IDX_TB_MIN; $i <= self::IDX_TB_MAX; $i++) {
                if (self::wpLookup($arrays, 'tb', $i) >= self::wpLookup($arrays, 'tt', $state['indices']['tt'])) {
                    $state['indices']['tb'] = $i;
                    break;
                }
            }
        }

        // TBase: largest idx where WP_TBase(idx) <= 0.15*H
        $state['indices']['TBase'] = self::IDX_TBASE_MIN;
        for ($i = self::IDX_TBASE_MAX; $i >= self::IDX_TBASE_MIN; $i--) {
            if (self::wpLookup($arrays, 'TBase', $i) <= $lim_TBase) {
                $state['indices']['TBase'] = $i;
                break;
            }
        }

        // Base: largest idx where WP_Base(idx) <= 0.7*H
        $state['indices']['Base'] = self::IDX_BASE_MIN;
        for ($i = self::IDX_BASE_MAX; $i >= self::IDX_BASE_MIN; $i--) {
            if (self::wpLookup($arrays, 'Base', $i) <= $lim_Base) {
                $state['indices']['Base'] = $i;
                break;
            }
        }

        // LToe: largest idx where WP_LToe(idx) <= 0.2*H
        $state['indices']['LToe'] = self::IDX_LTOE_MIN;
        for ($i = self::IDX_LTOE_MAX; $i >= self::IDX_LTOE_MIN; $i--) {
            if (self::wpLookup($arrays, 'LToe', $i) <= $lim_LToe) {
                $state['indices']['LToe'] = $i;
                break;
            }
        }

        // Steel: max DB (DB28=104), min SP (0.10m=110)
        $state['indices']['stemDB'] = self::IDX_DB_MAX; $state['indices']['stemSP'] = self::IDX_SP_MIN;
        $state['indices']['toeDB']  = self::IDX_DB_MAX; $state['indices']['toeSP']  = self::IDX_SP_MIN;
        $state['indices']['heelDB'] = self::IDX_DB_MAX; $state['indices']['heelSP'] = self::IDX_SP_MIN;
    }

    /** Extract design + steel struct from current indices for cost/validity calls. */
    public static function getDesignFromCurrentHCA(array $state): array
    {
        $arrays = $state['arrays'];
        $idx    = $state['indices'];

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
     * HCA-style neighbor generation (no bisection bounds; flat clamp + walks).
     * Mirror hca.js lines 179-287. Update order: tt-then-tb (verified).
     * Returns NEW indices array; does NOT mutate state.
     */
    public static function generateNeighborHCA(array $state): array
    {
        $arrays = $state['arrays'];
        $cur    = $state['indices'];
        $H      = $state['params']['H'];
        $rng    = $state['rng'];

        $lim_tb      = Shared::roundTo(0.12 * $H, 3);
        $lim_TBase   = Shared::roundTo(0.15 * $H, 3);
        $lim_LToe_hi = Shared::roundTo(0.20 * $H, 3);
        $lim_LToe_lo = Shared::roundTo(0.10 * $H, 3);
        $lim_Base_hi = Shared::roundTo(0.70 * $H, 3);
        $lim_Base_lo = Shared::roundTo(0.50 * $H, 3);

        // 1) tt: rand(-2,2), clamp only
        $step  = Rng::rand(-2, 2, $rng);
        $newTt = $cur['tt'] + $step;
        if ($newTt < self::IDX_TT_MIN) $newTt = self::IDX_TT_MIN;
        if ($newTt > self::IDX_TT_MAX) $newTt = self::IDX_TT_MAX;

        // 2) tb: rand(-1,1), clamp; if tb < tt walk UP; then walk DOWN to <=0.12H
        $step  = Rng::rand(-1, 1, $rng);
        $newTb = $cur['tb'] + $step;
        if ($newTb < self::IDX_TB_MIN) $newTb = self::IDX_TB_MIN;
        if ($newTb > self::IDX_TB_MAX) $newTb = self::IDX_TB_MAX;
        if (self::wpLookup($arrays, 'tb', $newTb) < self::wpLookup($arrays, 'tt', $newTt)) {
            $newTb = self::IDX_TB_MIN;
            while ($newTb <= self::IDX_TB_MAX) {
                if (self::wpLookup($arrays, 'tb', $newTb) >= self::wpLookup($arrays, 'tt', $newTt)) break;
                $newTb = $newTb + 1;
            }
            if ($newTb > self::IDX_TB_MAX) $newTb = self::IDX_TB_MAX;
        }
        while ($newTb > self::IDX_TB_MIN && self::wpLookup($arrays, 'tb', $newTb) > $lim_tb) {
            $newTb = $newTb - 1;
        }

        // 3) TBase: rand(-1,1), clamp; walk DOWN to <=0.15H
        $step     = Rng::rand(-1, 1, $rng);
        $newTBase = $cur['TBase'] + $step;
        if ($newTBase < self::IDX_TBASE_MIN) $newTBase = self::IDX_TBASE_MIN;
        if ($newTBase > self::IDX_TBASE_MAX) $newTBase = self::IDX_TBASE_MAX;
        while ($newTBase > self::IDX_TBASE_MIN && self::wpLookup($arrays, 'TBase', $newTBase) > $lim_TBase) {
            $newTBase = $newTBase - 1;
        }

        // 4) LToe: rand(-2,2), clamp; walk DOWN to <=0.2H, walk UP to >=0.1H
        $step    = Rng::rand(-2, 2, $rng);
        $newLToe = $cur['LToe'] + $step;
        if ($newLToe < self::IDX_LTOE_MIN) $newLToe = self::IDX_LTOE_MIN;
        if ($newLToe > self::IDX_LTOE_MAX) $newLToe = self::IDX_LTOE_MAX;
        while ($newLToe > self::IDX_LTOE_MIN && self::wpLookup($arrays, 'LToe', $newLToe) > $lim_LToe_hi) {
            $newLToe = $newLToe - 1;
        }
        while ($newLToe < self::IDX_LTOE_MAX && self::wpLookup($arrays, 'LToe', $newLToe) < $lim_LToe_lo) {
            $newLToe = $newLToe + 1;
        }

        // 5) Base: rand(-1,1), clamp; walk UP to >=0.5H, walk DOWN to <=0.7H
        $step    = Rng::rand(-1, 1, $rng);
        $newBase = $cur['Base'] + $step;
        if ($newBase < self::IDX_BASE_MIN) $newBase = self::IDX_BASE_MIN;
        if ($newBase > self::IDX_BASE_MAX) $newBase = self::IDX_BASE_MAX;
        while ($newBase < self::IDX_BASE_MAX && self::wpLookup($arrays, 'Base', $newBase) < $lim_Base_lo) {
            $newBase = $newBase + 1;
        }
        while ($newBase > self::IDX_BASE_MIN && self::wpLookup($arrays, 'Base', $newBase) > $lim_Base_hi) {
            $newBase = $newBase - 1;
        }

        // 6-11) Steel: rand(-2,2) each, clamp only
        $step      = Rng::rand(-2, 2, $rng);
        $newStemDB = $cur['stemDB'] + $step;
        if ($newStemDB < self::IDX_DB_MIN) $newStemDB = self::IDX_DB_MIN;
        if ($newStemDB > self::IDX_DB_MAX) $newStemDB = self::IDX_DB_MAX;

        $step      = Rng::rand(-2, 2, $rng);
        $newStemSP = $cur['stemSP'] + $step;
        if ($newStemSP < self::IDX_SP_MIN) $newStemSP = self::IDX_SP_MIN;
        if ($newStemSP > self::IDX_SP_MAX) $newStemSP = self::IDX_SP_MAX;

        $step     = Rng::rand(-2, 2, $rng);
        $newToeDB = $cur['toeDB'] + $step;
        if ($newToeDB < self::IDX_DB_MIN) $newToeDB = self::IDX_DB_MIN;
        if ($newToeDB > self::IDX_DB_MAX) $newToeDB = self::IDX_DB_MAX;

        $step     = Rng::rand(-2, 2, $rng);
        $newToeSP = $cur['toeSP'] + $step;
        if ($newToeSP < self::IDX_SP_MIN) $newToeSP = self::IDX_SP_MIN;
        if ($newToeSP > self::IDX_SP_MAX) $newToeSP = self::IDX_SP_MAX;

        $step      = Rng::rand(-2, 2, $rng);
        $newHeelDB = $cur['heelDB'] + $step;
        if ($newHeelDB < self::IDX_DB_MIN) $newHeelDB = self::IDX_DB_MIN;
        if ($newHeelDB > self::IDX_DB_MAX) $newHeelDB = self::IDX_DB_MAX;

        $step      = Rng::rand(-2, 2, $rng);
        $newHeelSP = $cur['heelSP'] + $step;
        if ($newHeelSP < self::IDX_SP_MIN) $newHeelSP = self::IDX_SP_MIN;
        if ($newHeelSP > self::IDX_SP_MAX) $newHeelSP = self::IDX_SP_MAX;

        return [
            'tt' => $newTt, 'tb' => $newTb, 'TBase' => $newTBase, 'Base' => $newBase, 'LToe' => $newLToe,
            'stemDB' => $newStemDB, 'stemSP' => $newStemSP,
            'toeDB'  => $newToeDB,  'toeSP'  => $newToeSP,
            'heelDB' => $newHeelDB, 'heelSP' => $newHeelSP,
        ];
    }

    /**
     * Main HCA optimization loop -- single flat for-loop, no bisection wrapper.
     *
     * Return shape MATCHES Ba::baOptimize for Engine.php parity:
     *   ['bestDesign'=>?array, 'bestSteel'=>?array, 'bestCost'=>float|INF,
     *    'bestIteration'=>int, 'costHistory'=>array, 'log'=>array, 'finalState'=>array]
     *
     * NOTE: bestCost may be PHP INF when no valid design found. Caller (xval/JSON
     * layer) must map INF -> NO_VALID_SENTINEL before json_encode.
     *
     * @param array $params  same shape as createHCAState
     * @param array $options {maxIterations?: int=10000, seed?: int, rng?: callable, onIteration?: callable}
     */
    public static function hcaOptimize(array $params, array $options = []): array
    {
        $maxIterations = (int) ($options['maxIterations'] ?? 10000);
        $onIteration   = $options['onIteration'] ?? null;

        $stateOpts = [];
        if (isset($options['seed'])) $stateOpts['seed'] = $options['seed'];
        if (isset($options['rng']))  $stateOpts['rng']  = $options['rng'];

        $state = self::createHCAState($params, $stateOpts);
        self::initializeCurrentDesignHCA($state);

        $mat         = $params['material'];
        $logArr      = [];
        $costHistory = array_fill(0, $maxIterations + 1, null);

        // === Initial design evaluation (iteration 0) ===
        $initial = self::getDesignFromCurrentHCA($state);
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

        // Default-safe init before if/else (hard constraint #2)
        $best          = null;
        $bestSteel     = null;
        $bestCost      = INF;
        $bestIteration = 0;
        $currentCost   = INF;

        if ($initialValidity['valid']) {
            $best          = $initial['design'];
            $bestSteel     = $initial['steel'];
            $bestCost      = $initialCost;
            $bestIteration = 1;
            $currentCost   = $initialCost;
            self::pushLog($logArr, 0, $initialCost, true, true, true, '', $bestCost, $bestIteration, $onIteration);
        } else {
            self::pushLog($logArr, 0, $initialCost, false, false, false, $initialValidity['reason'] ?? '', $bestCost, $bestIteration, $onIteration);
        }

        // === Single flat HCA loop -- no bisection wrapper, no countLoop multiplier ===
        for ($iter = 1; $iter <= $maxIterations; $iter++) {
            $backup           = self::copyIndices($state['indices']);
            $newIndices       = self::generateNeighborHCA($state);
            $state['indices'] = $newIndices;

            $neighbor = self::getDesignFromCurrentHCA($state);
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
                if ($neighborCost < $bestCost) {
                    $best          = $neighbor['design'];
                    $bestSteel     = $neighbor['steel'];
                    $bestCost      = $neighborCost;
                    $bestIteration = $iter;
                    $currentCost   = $neighborCost;
                    $accepted      = true;
                    $isBetter      = true;
                } elseif ($neighborCost < $currentCost) {
                    $currentCost = $neighborCost;
                    $accepted    = true;
                } else {
                    $state['indices'] = $backup;
                }
            } else {
                $state['indices'] = $backup;
                $reason = $validity['reason'] ?? '';
            }

            if ($bestIteration > 0) {
                $costHistory[$iter] = $bestCost;
            } else {
                $costHistory[$iter] = self::NO_VALID_SENTINEL;
            }

            self::pushLog($logArr, $iter, $neighborCost, (bool) $validity['valid'], $isBetter, $accepted, $reason, $bestCost, $bestIteration, $onIteration);
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

    /** Push log entry + optional onIteration callback. */
    private static function pushLog(array &$logArr, int $iter, float $cost, bool $valid, bool $isBetter, bool $accepted, string $reason, float $bestSoFar, int $bestIter, $onIteration): void
    {
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
        if (is_callable($onIteration)) {
            $onIteration($entry);
        }
    }
}
