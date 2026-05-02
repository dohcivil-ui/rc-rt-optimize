<?php
/**
 * Rng.php -- VB6-compatible RNG for HCA/BA
 * Ported from backend/src/rng.js (VB6 modShared.bas line 175)
 */

class Rng
{
    /**
     * VB6-compatible LCG (24-bit, Microsoft documented)
     * Returns callable: fn() => float [0, 1)
     *
     * @param int $seed  Initial state (default 0x50000)
     * @return callable
     */
    public static function createVB6Rng(int $seed = 0x50000): callable
    {
        $state = $seed;
        return function () use (&$state): float {
            $state = ($state * 1140671485 + 12820163) & 0xFFFFFF;
            return $state / 0x1000000;
        };
    }

    /**
     * Integer in [low, high] inclusive -- VB6 formula
     * Rand = Int((High - Low + 1) * Rnd) + Low
     *
     * @param int      $low
     * @param int      $high
     * @param callable $rng
     * @return int
     */
    public static function rand(int $low, int $high, callable $rng): int
    {
        return (int) floor(($high - $low + 1) * $rng()) + $low;
    }
}