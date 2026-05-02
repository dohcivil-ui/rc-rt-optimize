<?php
/**
 * Shared.php -- ported from backend/src/shared.js (modShared.bas RC_RT_HCA v2.8)
 * RC Retaining Wall Optimization -- all engineering calculations
 */

class Shared
{
    // Pricing (Nov 2568 -- Maha Sarakham)
    const CONCRETE_PRICES = [
        180 => 2337, 210 => 2384, 240 => 2430, 280 => 2524,
        300 => 2570, 320 => 2617, 350 => 2783, 400 => 2850
    ];
    const STEEL_PRICES = [
        4000 => 24,  // SD40 baht/kg
        3000 => 28   // SD30 baht/kg
    ];

    // Safety Factor Limits (VB6 constants)
    const FS_OT_MIN = 2.0;
    const FS_SL_MIN = 1.5;
    const FS_BC_MIN = 2.0;

    public static function initArrays(): array
    {
        $DB = [12, 16, 20, 25, 28];
        $SP = [0.10, 0.15, 0.20, 0.25];

        $tt = [];
        for ($i = 0; $i <= 16; $i++) {
            $tt[] = self::roundTo(0.200 + $i * 0.025, 3);
        }
        $tb = [];
        for ($i = 0; $i <= 16; $i++) {
            $tb[] = self::roundTo(0.200 + $i * 0.050, 3);
        }
        $TBase = [];
        for ($i = 0; $i <= 14; $i++) {
            $TBase[] = self::roundTo(0.300 + $i * 0.050, 3);
        }
        $Base = [];
        for ($i = 0; $i <= 11; $i++) {
            $Base[] = self::roundTo(1.500 + $i * 0.500, 3);
        }
        $LToe = [];
        for ($i = 0; $i <= 9; $i++) {
            $LToe[] = self::roundTo(0.300 + $i * 0.100, 3);
        }

        return [
            'DB' => $DB, 'SP' => $SP, 'tt' => $tt, 'tb' => $tb,
            'TBase' => $TBase, 'Base' => $Base, 'LToe' => $LToe
        ];
    }

    public static function roundTo(float $value, int $decimals): float
    {
        $factor = pow(10, $decimals);
        return round($value * $factor) / $factor;
    }

    public static function calculateKa(float $phi_deg): float
    {
        $phi_rad = $phi_deg * M_PI / 180;
        return (1 - sin($phi_rad)) / (1 + sin($phi_rad));
    }

    public static function calculateKp(float $phi_deg): float
    {
        $phi_rad = $phi_deg * M_PI / 180;
        return (1 + sin($phi_rad)) / (1 - sin($phi_rad));
    }

    public static function calculatePa(float $gamma_soil, float $Ka, float $H): float
    {
        return 0.5 * $gamma_soil * $Ka * $H * $H;
    }

    public static function calculatePp(float $gamma_soil, float $Kp, float $H1): float
    {
        return 0.5 * $gamma_soil * $Kp * $H1 * $H1;
    }

    public static function calculateLHeel(float $Base, float $LToe, float $tb): float
    {
        return $Base - $LToe - $tb;
    }

    // W1: Soil on Toe
    public static function calculateW1(array $d, float $H, float $H1, float $gamma_soil): array
    {
        $H_stem = $H - $d['TBase'];
        $H1_toe = $H1 - $d['TBase'];
        if ($H1_toe < 0) $H1_toe = 0;

        if ($H1_toe < 0.001) {
            return ['W' => 0, 'x' => $d['LToe'] / 2];
        }

        $base_triangle = 0;
        if ($H_stem > 0.001) {
            $base_triangle = ($d['tb'] - $d['tt']) * $H1_toe / $H_stem;
        }

        $A_rect = $d['LToe'] * $H1_toe;
        $A_tri = 0.5 * $base_triangle * $H1_toe;

        return [
            'W' => ($A_rect + $A_tri) * $gamma_soil,
            'x' => $d['LToe'] / 2
        ];
    }

    // W2: Soil on Heel
    public static function calculateW2(array $d, float $H, float $gamma_soil): array
    {
        $H_wall = $H - $d['TBase'];
        return [
            'W' => $d['LHeel'] * $H_wall * $gamma_soil,
            'x' => $d['LToe'] + $d['tb'] + $d['LHeel'] / 2
        ];
    }

    // W3: Stem (Concrete) -- trapezoid
    public static function calculateW3(array $d, float $H, float $gamma_concrete): array
    {
        $H_stem = $H - $d['TBase'];
        $W = 0.5 * ($d['tt'] + $d['tb']) * $H_stem * $gamma_concrete;

        $A_rect = $d['tt'] * $H_stem;
        $x_rect = $d['tt'] / 2;
        $A_tri = 0.5 * ($d['tb'] - $d['tt']) * $H_stem;
        $x_tri = $d['tt'] + ($d['tb'] - $d['tt']) / 3;
        $A_total = $A_rect + $A_tri;

        if ($A_total > 0.001) {
            $centroid = ($A_rect * $x_rect + $A_tri * $x_tri) / $A_total;
        } else {
            $centroid = $d['tb'] / 2;
        }

        return [
            'W' => $W,
            'x' => ($d['LToe'] + $d['tb']) - $centroid
        ];
    }

    // W4: Base Slab (Concrete)
    public static function calculateW4(array $d, float $gamma_concrete): array
    {
        return [
            'W' => $d['Base'] * $d['TBase'] * $gamma_concrete,
            'x' => $d['Base'] / 2
        ];
    }

    public static function calculateWTotal(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete): array
    {
        $w1 = self::calculateW1($d, $H, $H1, $gamma_soil);
        $w2 = self::calculateW2($d, $H, $gamma_soil);
        $w3 = self::calculateW3($d, $H, $gamma_concrete);
        $w4 = self::calculateW4($d, $gamma_concrete);

        return [
            'W1' => $w1['W'], 'x1' => $w1['x'],
            'W2' => $w2['W'], 'x2' => $w2['x'],
            'W3' => $w3['W'], 'x3' => $w3['x'],
            'W4' => $w4['W'], 'x4' => $w4['x'],
            'WTotal' => $w1['W'] + $w2['W'] + $w3['W'] + $w4['W']
        ];
    }

    public static function steelUnitWeight(float $db_mm): float
    {
        return 0.00617 * $db_mm * $db_mm;
    }

    // MR: Resisting Moment about toe
    public static function calculateMR(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete): float
    {
        $r = self::calculateWTotal($d, $H, $H1, $gamma_soil, $gamma_concrete);
        return $r['W1'] * $r['x1'] + $r['W2'] * $r['x2'] + $r['W3'] * $r['x3'] + $r['W4'] * $r['x4'];
    }

    // MO: Overturning Moment about toe
    public static function calculateMO(float $Pa, float $H, float $Pp, float $H1): float
    {
        return $Pa * ($H / 3) - $Pp * ($H1 / 3);
    }

    public static function calculateMomentStem(float $H1, float $gamma_soil, float $phi): float
    {
        $Ka = self::calculateKa($phi);
        return 0.5 * $gamma_soil * $Ka * $H1 * $H1 * $H1 / 3;
    }

    // Moment at Toe -- 1:1 VB6 port (triangle term uses LToe/2 * 2*LToe/3)
    public static function calculateMomentToe(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete, float $phi): float
    {
        $Ka = self::calculateKa($phi);
        $Kp = self::calculateKp($phi);
        $Pa = self::calculatePa($gamma_soil, $Ka, $H);
        $Pp = self::calculatePp($gamma_soil, $Kp, $H1);

        $r = self::calculateWTotal($d, $H, $H1, $gamma_soil, $gamma_concrete);
        $W_total = $r['WTotal'];
        $MR = $r['W1'] * $r['x1'] + $r['W2'] * $r['x2'] + $r['W3'] * $r['x3'] + $r['W4'] * $r['x4'];
        $MO = self::calculateMO($Pa, $H, $Pp, $H1);

        if ($W_total > 0.1 && $d['Base'] > 0.1) {
            $e = abs(($d['Base'] / 2) - (($MR - $MO) / $W_total));
            if ($e <= $d['Base'] / 6) {
                $q_max = ($W_total / $d['Base']) * (1 + (6 * $e / $d['Base']));
                $q_min = ($W_total / $d['Base']) * (1 - (6 * $e / $d['Base']));
            } else {
                $L_eff = 3 * ($d['Base'] / 2 - $e);
                if ($L_eff > 0.1) {
                    $q_max = 2 * $W_total / $L_eff;
                } else {
                    $q_max = $W_total / $d['Base'] * 2;
                }
                $q_min = 0;
            }
        } else {
            $q_max = 1;
            $q_min = 1;
        }

        $q_toe = $q_max;
        if ($d['Base'] > 0.01) {
            $q_junction = $q_max - ($q_max - $q_min) * ($d['LToe'] / $d['Base']);
        } else {
            $q_junction = $q_max;
        }

        $M_bearing = $q_junction * $d['LToe'] * ($d['LToe'] / 2) +
                     ($q_toe - $q_junction) * ($d['LToe'] / 2) * (2 * $d['LToe'] / 3);
        $w_self = $gamma_concrete * $d['TBase'];
        $M_self = $w_self * $d['LToe'] * $d['LToe'] / 2;

        return abs($M_bearing - $M_self);
    }

    // Moment at Heel -- 1:1 VB6 port (triangle term uses LHeel/2 * LHeel/3)
    public static function calculateMomentHeel(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete, float $phi): float
    {
        $Ka = self::calculateKa($phi);
        $Kp = self::calculateKp($phi);
        $Pa = self::calculatePa($gamma_soil, $Ka, $H);
        $Pp = self::calculatePp($gamma_soil, $Kp, $H1);

        $r = self::calculateWTotal($d, $H, $H1, $gamma_soil, $gamma_concrete);
        $W_total = $r['WTotal'];
        $MR = $r['W1'] * $r['x1'] + $r['W2'] * $r['x2'] + $r['W3'] * $r['x3'] + $r['W4'] * $r['x4'];
        $MO = self::calculateMO($Pa, $H, $Pp, $H1);

        if ($W_total > 0.1 && $d['Base'] > 0.1) {
            $e = abs(($d['Base'] / 2) - (($MR - $MO) / $W_total));
            if ($e <= $d['Base'] / 6) {
                $q_max = ($W_total / $d['Base']) * (1 + (6 * $e / $d['Base']));
                $q_min = ($W_total / $d['Base']) * (1 - (6 * $e / $d['Base']));
            } else {
                $L_eff = 3 * ($d['Base'] / 2 - $e);
                if ($L_eff > 0.1) {
                    $q_max = 2 * $W_total / $L_eff;
                } else {
                    $q_max = $W_total / $d['Base'] * 2;
                }
                $q_min = 0;
            }
        } else {
            $q_max = 1;
            $q_min = 1;
        }

        if ($d['Base'] > 0.01) {
            $q_junction = $q_max - ($q_max - $q_min) * (($d['LToe'] + $d['tb']) / $d['Base']);
        } else {
            $q_junction = $q_max;
        }
        $q_heel = $q_min;
        $H_soil = $H - $d['TBase'];
        $w_down = ($d['TBase'] * $gamma_concrete) + ($H_soil * $gamma_soil);
        $M_downward = $w_down * $d['LHeel'] * $d['LHeel'] / 2;
        $M_bearing = $q_heel * $d['LHeel'] * ($d['LHeel'] / 2) +
                     ($q_junction - $q_heel) * ($d['LHeel'] / 2) * ($d['LHeel'] / 3);

        return abs($M_downward - $M_bearing);
    }
    // Safety Factor Checks
    public static function checkFS_OT(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete, float $phi): array
    {
        $Ka = self::calculateKa($phi);
        $Kp = self::calculateKp($phi);
        $Pa = self::calculatePa($gamma_soil, $Ka, $H);
        $Pp = self::calculatePp($gamma_soil, $Kp, $H1);
        $MR = self::calculateMR($d, $H, $H1, $gamma_soil, $gamma_concrete);
        $MO = self::calculateMO($Pa, $H, $Pp, $H1);

        if ($MO <= 0.001) {
            return ['FS_OT' => 999, 'pass' => true];
        }
        $FS_OT = $MR / $MO;
        return ['FS_OT' => $FS_OT, 'pass' => $FS_OT >= self::FS_OT_MIN];
    }

    public static function checkFS_SL(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete, float $phi, float $mu): array
    {
        $Ka = self::calculateKa($phi);
        $Kp = self::calculateKp($phi);
        $Pa = self::calculatePa($gamma_soil, $Ka, $H);
        $Pp = self::calculatePp($gamma_soil, $Kp, $H1);
        $W_total = self::calculateWTotal($d, $H, $H1, $gamma_soil, $gamma_concrete)['WTotal'];
        $Resistance = $Pp + $mu * $W_total;

        if ($Pa <= 0.001) {
            return ['FS_SL' => 999, 'pass' => true];
        }
        $FS_SL = $Resistance / $Pa;
        return ['FS_SL' => $FS_SL, 'pass' => $FS_SL >= self::FS_SL_MIN];
    }

    public static function checkFS_BC(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete, float $phi, float $qa): array
    {
        $Ka = self::calculateKa($phi);
        $Kp = self::calculateKp($phi);
        $Pa = self::calculatePa($gamma_soil, $Ka, $H);
        $Pp = self::calculatePp($gamma_soil, $Kp, $H1);
        $r = self::calculateWTotal($d, $H, $H1, $gamma_soil, $gamma_concrete);
        $W_total = $r['WTotal'];

        if ($W_total < 0.1) {
            return ['FS_BC' => 0, 'e' => 0, 'q_max' => 0, 'q_min' => 0, 'pass' => false];
        }
        if ($d['Base'] < 0.1) {
            return ['FS_BC' => 0, 'e' => 0, 'q_max' => 0, 'q_min' => 0, 'pass' => false];
        }

        $MR = $r['W1'] * $r['x1'] + $r['W2'] * $r['x2'] + $r['W3'] * $r['x3'] + $r['W4'] * $r['x4'];
        $MO = self::calculateMO($Pa, $H, $Pp, $H1);
        $e = abs(($d['Base'] / 2) - (($MR - $MO) / $W_total));

        if ($e > $d['Base'] / 3) {
            return ['FS_BC' => 0, 'e' => $e, 'q_max' => 0, 'q_min' => 0, 'pass' => false];
        }

        if ($e <= $d['Base'] / 6) {
            $q_max = ($W_total / $d['Base']) * (1 + (6 * $e / $d['Base']));
            $q_min = ($W_total / $d['Base']) * (1 - (6 * $e / $d['Base']));
        } else {
            $L_eff = 3 * ($d['Base'] / 2 - $e);
            if ($L_eff > 0.01) {
                $q_max = 2 * $W_total / $L_eff;
            } else {
                $q_max = $W_total / $d['Base'] * 2;
            }
            $q_min = 0;
        }

        if ($q_min < 0 || $q_max <= 0.001) {
            return ['FS_BC' => 0, 'e' => $e, 'q_max' => $q_max, 'q_min' => $q_min, 'pass' => false];
        }

        $FS_BC = $qa / $q_max;
        return ['FS_BC' => $FS_BC, 'e' => $e, 'q_max' => $q_max, 'q_min' => $q_min, 'pass' => $FS_BC >= self::FS_BC_MIN];
    }

    // WSD Functions (modWSD.bas)
    public static function calculateWSDParams(float $fy, float $fc_prime): array
    {
        $n = 9;
        $fs = $fy <= 3000 ? 1500 : 1700;
        $fc = 0.45 * $fc_prime;
        $k = 1 / (1 + $fs / ($n * $fc));
        $j = 1 - $k / 3;
        $R = 0.5 * $fc * $k * $j;
        return ['n' => $n, 'fs' => $fs, 'fc' => $fc, 'k' => $k, 'j' => $j, 'R' => $R];
    }

    public static function calculateAsRequired(float $M, float $fs, float $j, float $d): float
    {
        $M_kg_cm = $M * 1000 * 100;
        $d_cm = $d * 100;
        if ($M_kg_cm <= 0 || $d_cm <= 0 || $fs <= 0 || $j <= 0) return 0.0;
        return $M_kg_cm / ($fs * $j * $d_cm);
    }

    public static function calculateAsProvided(int $DB_idx, int $SP_idx, array $arrays): float
    {
        if ($DB_idx < 0 || $DB_idx >= count($arrays['DB'])) return 0.0;
        if ($SP_idx < 0 || $SP_idx >= count($arrays['SP'])) return 0.0;

        $db_mm = $arrays['DB'][$DB_idx];
        $spacing_m = $arrays['SP'][$SP_idx];
        $db_cm = $db_mm / 10;
        $area_per_bar = M_PI * ($db_cm / 2) * ($db_cm / 2);
        $n_bars = $spacing_m > 0 ? 1 / $spacing_m : 0;
        return $area_per_bar * $n_bars;
    }

    public static function checkSteelOK(float $M, float $d_eff, int $DB_idx, int $SP_idx, array $wsd, array $arrays): bool
    {
        $As_req = self::calculateAsRequired($M, $wsd['fs'], $wsd['j'], $d_eff);
        $As_prov = self::calculateAsProvided($DB_idx, $SP_idx, $arrays);
        return $As_prov >= $As_req;
    }

    // Steel Weight (VB6 CalculateSteelWeight)
    public static function calculateSteelWeight(int $DB_idx, int $SP_idx, float $length, array $arrays): float
    {
        if ($DB_idx < 100 || $DB_idx > 104) return 0.0;
        if ($SP_idx < 110 || $SP_idx > 113) return 0.0;

        $db_mm = $arrays['DB'][$DB_idx - 100];
        $spacing_m = $arrays['SP'][$SP_idx - 110];
        $n_bars = 1 / $spacing_m;
        $weight_per_m = 0.00617 * $db_mm * $db_mm;
        return $n_bars * $weight_per_m * $length;
    }

    // Cost Calculation (VB6 CalculateCostFull)
    public static function calculateCost(array $d, float $H, float $gamma_concrete, float $concretePrice, float $steelPrice, array $steel): array
    {
        $arrays = self::initArrays();
        $H_stem = $H - $d['TBase'];

        $V_stem = 0.5 * ($d['tt'] + $d['tb']) * $H_stem;
        $V_base = $d['Base'] * $d['TBase'];
        $V_total = $V_stem + $V_base;

        $L_stem = $H_stem + 0.4;
        $L_toe = $d['LToe'] + 0.4;
        $L_heel = $d['LHeel'] + 0.4;

        $W_stem = self::calculateSteelWeight($steel['stemDB_idx'], $steel['stemSP_idx'], $L_stem, $arrays);
        $W_toe = self::calculateSteelWeight($steel['toeDB_idx'], $steel['toeSP_idx'], $L_toe, $arrays);
        $W_heel = self::calculateSteelWeight($steel['heelDB_idx'], $steel['heelSP_idx'], $L_heel, $arrays);
        $W_total_steel = $W_stem + $W_toe + $W_heel;

        $cost = $V_total * $concretePrice + $W_total_steel * $steelPrice;

        return ['V_total' => $V_total, 'W_total_steel' => $W_total_steel, 'cost' => $cost];
    }

    // Design Validity Check (modShared line 710-762)
    public static function checkDesignValid(array $d, float $H, float $H1, float $gamma_soil, float $gamma_concrete, float $phi, float $mu, float $qa, float $cover, array $wsd, array $steel, array $arrays): array
    {
        $result = ['valid' => false, 'FS_OT' => 0, 'FS_SL' => 0, 'FS_BC' => 0, 'reason' => ''];

        if ($d['tb'] < $d['tt']) { $result['reason'] = 'tb < tt'; return $result; }
        if ($d['LHeel'] < 0.3) { $result['reason'] = 'LHeel < 0.3'; return $result; }
        if ($d['LHeel'] <= $d['LToe']) { $result['reason'] = 'LHeel <= LToe'; return $result; }

        $fsOT = self::checkFS_OT($d, $H, $H1, $gamma_soil, $gamma_concrete, $phi);
        $result['FS_OT'] = $fsOT['FS_OT'];
        if (!$fsOT['pass']) { $result['reason'] = 'FS_OT < 2.0'; return $result; }

        $fsSL = self::checkFS_SL($d, $H, $H1, $gamma_soil, $gamma_concrete, $phi, $mu);
        $result['FS_SL'] = $fsSL['FS_SL'];
        if (!$fsSL['pass']) { $result['reason'] = 'FS_SL < 1.5'; return $result; }

        $fsBC = self::checkFS_BC($d, $H, $H1, $gamma_soil, $gamma_concrete, $phi, $qa);
        $result['FS_BC'] = $fsBC['FS_BC'];
        if (!$fsBC['pass']) { $result['reason'] = 'FS_BC < 2.0'; return $result; }

        $M_stem = self::calculateMomentStem($H1, $gamma_soil, $phi);
        $M_toe = self::calculateMomentToe($d, $H, $H1, $gamma_soil, $gamma_concrete, $phi);
        $M_heel = self::calculateMomentHeel($d, $H, $H1, $gamma_soil, $gamma_concrete, $phi);

        $d_stem = $d['tb'] - $cover;
        $d_toe = $d['TBase'] - $cover;
        $d_heel = $d['TBase'] - $cover;
        if ($d_stem <= 0.05) $d_stem = 0.05;
        if ($d_toe <= 0.05) $d_toe = 0.05;
        if ($d_heel <= 0.05) $d_heel = 0.05;

        if (!self::checkSteelOK($M_stem, $d_stem, $steel['stemDB_idx'], $steel['stemSP_idx'], $wsd, $arrays)) {
            $result['reason'] = 'steel stem insufficient'; return $result;
        }
        if (!self::checkSteelOK($M_toe, $d_toe, $steel['toeDB_idx'], $steel['toeSP_idx'], $wsd, $arrays)) {
            $result['reason'] = 'steel toe insufficient'; return $result;
        }
        if (!self::checkSteelOK($M_heel, $d_heel, $steel['heelDB_idx'], $steel['heelSP_idx'], $wsd, $arrays)) {
            $result['reason'] = 'steel heel insufficient'; return $result;
        }

        $result['valid'] = true;
        return $result;
    }
}