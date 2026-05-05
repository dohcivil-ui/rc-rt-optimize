<?php
// Statistics.php -- pure-PHP statistical primitives mirroring Node
// statistics.js (api/src/lib/statistics.js). Day 11.3 PHP-stack port.
// PHP 7.4+ compat. No external dependencies.
//
// Public surface:
//   Statistics::wilcoxonSignedRank($samplesA, $samplesB, $options = null)
//     options['alternative']: 'two-sided' (default) | 'less' | 'greater'
//       'less'    -> H1: median(A - B) < 0   (A tends to be smaller)
//       'greater' -> H1: median(A - B) > 0   (A tends to be larger)
//     returns ['W', 'Wplus', 'Wminus', 'z', 'pValue', 'pTwoSided',
//              'pLess', 'pGreater', 'n', 'alternative', 'conclusion', 'note']
//   Statistics::descriptiveStats($arr)
//     -> ['n', 'mean', 'median', 'std', 'min', 'max', 'q1', 'q3']
//   Statistics::normalCDF($z)              -> approx P(Z <= z)
//   Statistics::buildPairs($a, $b)         -> [['d','absD','sign'], ...]
//                                             (exposed for tests only)
//   Statistics::rankWithTies($values)      -> ['ranks', 'tieSizes']
//                                             (exposed for tests only)

declare(strict_types=1);

class Statistics
{
    // Abramowitz & Stegun 26.2.17 approximation for the standard normal
    // cumulative distribution function. Max error ~7.5e-8 over the range,
    // adequate for 4-decimal p-values.
    public static function normalCDF(float $z): float
    {
        if ($z === 0.0) return 0.5;
        $sign = $z < 0 ? -1 : 1;
        $az = abs($z);

        $a1 =  0.254829592;
        $a2 = -0.284496736;
        $a3 =  1.421413741;
        $a4 = -1.453152027;
        $a5 =  1.061405429;
        $p  =  0.3275911;

        $t = 1.0 / (1.0 + $p * $az / M_SQRT2);
        $erf = 1.0 - (((((($a5 * $t + $a4) * $t) + $a3) * $t + $a2) * $t + $a1) * $t * exp(-($az * $az) / 2));

        return 0.5 * (1.0 + $sign * $erf);
    }

    // Linear-interpolation percentile (matches NumPy 'linear' method).
    // sortedArr must be ascending. p is a float in [0, 1].
    private static function percentile(array $sortedArr, float $p): float
    {
        $n = count($sortedArr);
        if ($n === 0) return NAN;
        if ($n === 1) return (float)$sortedArr[0];
        $idx = $p * ($n - 1);
        $lo = (int)floor($idx);
        $hi = (int)ceil($idx);
        if ($lo === $hi) return (float)$sortedArr[$lo];
        $frac = $idx - $lo;
        return $sortedArr[$lo] * (1 - $frac) + $sortedArr[$hi] * $frac;
    }

    public static function descriptiveStats(array $arr): array
    {
        $n = count($arr);
        if ($n === 0) {
            return [
                'n' => 0,
                'mean' => NAN,
                'median' => NAN,
                'std' => NAN,
                'min' => NAN,
                'max' => NAN,
                'q1' => NAN,
                'q3' => NAN,
            ];
        }

        $sum = 0.0;
        for ($i = 0; $i < $n; $i++) $sum += $arr[$i];
        $mean = $sum / $n;

        $sqSum = 0.0;
        for ($i = 0; $i < $n; $i++) {
            $d = $arr[$i] - $mean;
            $sqSum += $d * $d;
        }
        // Sample standard deviation (n-1) when n > 1; population (n) for n=1.
        $std = $n > 1 ? sqrt($sqSum / ($n - 1)) : 0.0;

        $sorted = $arr;
        sort($sorted, SORT_NUMERIC);
        $min = $sorted[0];
        $max = $sorted[$n - 1];

        return [
            'n' => $n,
            'mean' => $mean,
            'median' => self::percentile($sorted, 0.5),
            'std' => $std,
            'min' => $min,
            'max' => $max,
            'q1' => self::percentile($sorted, 0.25),
            'q3' => self::percentile($sorted, 0.75),
        ];
    }

    // Compute paired differences and discard zeros. Returns the array
    // shape Wilcoxon downstream code expects: [['d', 'absD', 'sign'], ...]
    public static function buildPairs(array $samplesA, array $samplesB): array
    {
        $pairs = [];
        $n = min(count($samplesA), count($samplesB));
        for ($i = 0; $i < $n; $i++) {
            $d = $samplesA[$i] - $samplesB[$i];
            if ($d == 0) continue;
            $pairs[] = [
                'd' => $d,
                'absD' => abs($d),
                'sign' => $d > 0 ? 1 : -1,
            ];
        }
        return $pairs;
    }

    // Average-rank tie handling. Returns ranks parallel to `values` (which
    // must be ascending). Ties get the mean of the rank slots they occupy.
    // Also returns the per-tie-group sizes for the Wilcoxon variance
    // correction.
    public static function rankWithTies(array $values): array
    {
        $n = count($values);
        $ranks = array_fill(0, $n, 0.0);
        $tieSizes = [];
        $i = 0;
        while ($i < $n) {
            $j = $i;
            while ($j + 1 < $n && $values[$j + 1] === $values[$i]) {
                $j++;
            }
            // Slots i..j (1-indexed: i+1..j+1) -> mean rank = ((i+1)+(j+1))/2.
            $groupSize = $j - $i + 1;
            $meanRank = (($i + 1) + ($j + 1)) / 2;
            for ($k = $i; $k <= $j; $k++) {
                $ranks[$k] = (float)$meanRank;
            }
            if ($groupSize > 1) $tieSizes[] = $groupSize;
            $i = $j + 1;
        }
        return ['ranks' => $ranks, 'tieSizes' => $tieSizes];
    }

    // Wilcoxon signed-rank with average-rank tie handling and continuity
    // correction on the normal approximation. Designed for n >= 6; for
    // very small n the p-value is approximate (note returned).
    //
    // Statistic convention (matches R / Hollander-Wolfe):
    //   W = Wplus = sum of ranks of |d_i| over pairs where d_i = a_i - b_i > 0.
    //   E[Wplus] = mu = n(n+1)/4. Var[Wplus] = n(n+1)(2n+1)/24 with tie
    //   correction. The signed z is (Wplus - mu) / sigma so that:
    //     - z << 0  <=>  A tends to be smaller than B
    //     - z >> 0  <=>  A tends to be larger than B
    //
    // One-sided p-values use a half continuity correction biased away from
    // the alternative (matches scipy.stats.wilcoxon mode='approx').
    public static function wilcoxonSignedRank(array $samplesA, array $samplesB, ?array $options = null): array
    {
        if (count($samplesA) !== count($samplesB)) {
            throw new InvalidArgumentException('wilcoxonSignedRank: arrays must have equal length');
        }
        $options = $options ?? [];
        $alternative = $options['alternative'] ?? 'two-sided';
        if ($alternative !== 'two-sided' && $alternative !== 'less' && $alternative !== 'greater') {
            throw new InvalidArgumentException('wilcoxonSignedRank: invalid alternative ' . $alternative);
        }

        $pairs = self::buildPairs($samplesA, $samplesB);
        $n = count($pairs);

        // Edge case: every paired difference is zero -> no signal.
        if ($n === 0) {
            return [
                'W' => 0,
                'Wplus' => 0,
                'Wminus' => 0,
                'z' => 0,
                'pValue' => 1,
                'pTwoSided' => 1,
                'pLess' => 0.5,
                'pGreater' => 0.5,
                'n' => 0,
                'alternative' => $alternative,
                'conclusion' => 'ไม่แตกต่างอย่างมีนัยสำคัญ',
                'note' => 'all paired differences are zero',
            ];
        }

        // Sort by |d| ascending; ties handled by average rank.
        usort($pairs, function ($a, $b) {
            return $a['absD'] <=> $b['absD'];
        });
        $absVals = array_map(function ($p) { return $p['absD']; }, $pairs);
        $ranked = self::rankWithTies($absVals);
        $ranks = $ranked['ranks'];

        $Wplus = 0.0;
        $Wminus = 0.0;
        for ($i = 0; $i < $n; $i++) {
            if ($pairs[$i]['sign'] > 0) $Wplus += $ranks[$i];
            else $Wminus += $ranks[$i];
        }
        $W = $Wplus;

        // Normal approximation with tie correction (cf. Hollander & Wolfe).
        $mu = $n * ($n + 1) / 4;
        $varW = $n * ($n + 1) * (2 * $n + 1) / 24;
        foreach ($ranked['tieSizes'] as $t) {
            $varW -= ($t * $t * $t - $t) / 48;
        }
        $sigma = sqrt($varW);

        $diff = $Wplus - $mu;
        if ($sigma === 0.0) {
            $zReturned = 0.0;
            $pTwoSided = 1.0;
            $pLess = 0.5;
            $pGreater = 0.5;
        } else {
            // Two-sided continuity correction: shrink |diff| by 0.5 toward 0.
            $corrTwo = $diff > 0 ? -0.5 : ($diff < 0 ? 0.5 : 0);
            $zTwo = ($diff + $corrTwo) / $sigma;
            $pTwoSided = 2 * self::normalCDF(-abs($zTwo));
            if ($pTwoSided > 1) $pTwoSided = 1;

            // One-sided 'less' (H1: A < B  =>  Wplus < mu): z = (Wplus - mu + 0.5) / sigma
            $zLess = ($diff + 0.5) / $sigma;
            $pLess = self::normalCDF($zLess);

            // One-sided 'greater' (H1: A > B  =>  Wplus > mu).
            $zGreater = ($diff - 0.5) / $sigma;
            $pGreater = 1 - self::normalCDF($zGreater);

            // The z reported back follows the requested alternative so it can
            // be displayed alongside the p-value without confusion.
            if ($alternative === 'less') $zReturned = $zLess;
            elseif ($alternative === 'greater') $zReturned = $zGreater;
            else $zReturned = ($diff + $corrTwo) / $sigma;
        }

        if ($alternative === 'less') $pValue = $pLess;
        elseif ($alternative === 'greater') $pValue = $pGreater;
        else $pValue = $pTwoSided;

        $note = $n < 6 ? 'n < 6: normal approximation may be inaccurate' : '';

        return [
            'W' => $W,
            'Wplus' => $Wplus,
            'Wminus' => $Wminus,
            'z' => $zReturned,
            'pValue' => $pValue,
            'pTwoSided' => $pTwoSided,
            'pLess' => $pLess,
            'pGreater' => $pGreater,
            'n' => $n,
            'alternative' => $alternative,
            'conclusion' => $pValue < 0.05
                ? 'แตกต่างอย่างมีนัยสำคัญ'
                : 'ไม่แตกต่างอย่างมีนัยสำคัญ',
            'note' => $note,
        ];
    }
}
