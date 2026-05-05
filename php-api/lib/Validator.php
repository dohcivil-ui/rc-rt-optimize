<?php
declare(strict_types=1);

/**
 * Validator.php -- manual schema validator for POST /api/optimize bodies.
 *
 * True PHP mirror of api/src/lib/validator.js (Node).
 * Zero dependencies. Collects ALL errors before returning rather than
 * short-circuiting on the first failure, so clients see every problem
 * in a single response.
 *
 * Never throws. Returns either:
 *   ['valid' => true,  'params' => <normalized array>]
 *   ['valid' => false, 'errors' => [<string>, ...]]
 *
 * PHP 7.4+ compat (uses array_is_list polyfill for < 8.1).
 *
 * Known edge case (PHP-Node parity gap): JSON object with purely
 * numeric-string keys like {"0":1,"1":2} parses in PHP as a list-shaped
 * array and is rejected as non-object, whereas Node accepts it. This
 * is acceptable for thesis defense scope.
 */
class Validator
{
    /** Top-level required fields with inclusive [min, max] ranges. */
    const REQUIRED_TOP = [
        ['key' => 'H',              'min' => 2,    'max' => 6   ],
        ['key' => 'H1',             'min' => 0,    'max' => 2   ],
        ['key' => 'gamma_soil',     'min' => 1.4,  'max' => 2.2 ],
        ['key' => 'gamma_concrete', 'min' => 2.0,  'max' => 2.8 ],
        ['key' => 'phi',            'min' => 20,   'max' => 45  ],
        ['key' => 'mu',             'min' => 0.3,  'max' => 0.7 ],
        ['key' => 'qa',             'min' => 10,   'max' => 50  ],
        ['key' => 'cover',          'min' => 0.04, 'max' => 0.15],
    ];

    /** Nested material fields -- all required, all numeric, range-checked. */
    const MATERIAL_FIELDS = [
        ['key' => 'fy',            'min' => 2400, 'max' => 6000],
        ['key' => 'fc',            'min' => 180,  'max' => 400 ],
        ['key' => 'concretePrice', 'min' => 1500, 'max' => 5000],
        ['key' => 'steelPrice',    'min' => 15,   'max' => 60  ],
    ];

    /** maxIterations bounds (spec Day 4-7). */
    const MAX_ITER_MIN = 100;
    const MAX_ITER_MAX = 100000;
    const MAX_ITER_DEFAULT = 5000;

    /**
     * Validate a request body for POST /api/optimize.
     *
     * @param mixed $body Decoded JSON (typically json_decode($s, true)).
     * @return array Either ['valid' => true, 'params' => ...]
     *               or ['valid' => false, 'errors' => [...]]
     */
    public static function validateOptimizeParams($body): array
    {
        // Body must be a plain JSON object (reject arrays, null, primitives).
        if (!self::isPlainObject($body)) {
            return [
                'valid' => false,
                'errors' => ['request body must be a JSON object'],
            ];
        }

        $errors = [];

        // Required top-level fields.
        foreach (self::REQUIRED_TOP as $spec) {
            self::checkNumericField($body, $spec, $spec['key'], $errors);
        }

        // Required nested material object.
        if (!array_key_exists('material', $body)) {
            $errors[] = 'material is required';
        } elseif (!self::isPlainObject($body['material'])) {
            $errors[] = 'material must be an object';
        } else {
            foreach (self::MATERIAL_FIELDS as $spec) {
                self::checkNumericField(
                    $body['material'],
                    $spec,
                    'material.' . $spec['key'],
                    $errors
                );
            }
        }

        // Optional options block -- if present, must be an object. Individual
        // option fields are independently validated.
        $normalizedOptions = [];
        if (array_key_exists('options', $body)) {
            if (!self::isPlainObject($body['options'])) {
                $errors[] = 'options must be an object';
            } else {
                if (array_key_exists('seed', $body['options'])) {
                    if (!self::isInteger($body['options']['seed'])) {
                        $errors[] = 'options.seed must be an integer';
                    } else {
                        $normalizedOptions['seed'] = $body['options']['seed'];
                    }
                }
                if (array_key_exists('maxIterations', $body['options'])) {
                    $mi = $body['options']['maxIterations'];
                    if (!self::isInteger($mi)) {
                        $errors[] = 'options.maxIterations must be an integer';
                    } elseif ($mi < self::MAX_ITER_MIN || $mi > self::MAX_ITER_MAX) {
                        $errors[] = 'options.maxIterations must be in range ['
                            . self::MAX_ITER_MIN . ', ' . self::MAX_ITER_MAX . ']';
                    } else {
                        $normalizedOptions['maxIterations'] = $mi;
                    }
                }
            }
        }

        if (count($errors) > 0) {
            return ['valid' => false, 'errors' => $errors];
        }

        // Apply default for maxIterations if user did not supply one. seed is
        // left absent when not provided so the engine falls back to its own RNG.
        if (!array_key_exists('maxIterations', $normalizedOptions)) {
            $normalizedOptions['maxIterations'] = self::MAX_ITER_DEFAULT;
        }

        // Build the normalized params object -- only known fields pass through.
        // Unknown top-level fields are silently dropped per spec.
        $params = [];
        foreach (self::REQUIRED_TOP as $spec) {
            $params[$spec['key']] = $body[$spec['key']];
        }
        $params['material'] = [];
        foreach (self::MATERIAL_FIELDS as $spec) {
            $params['material'][$spec['key']] = $body['material'][$spec['key']];
        }
        $params['options'] = $normalizedOptions;

        return ['valid' => true, 'params' => $params];
    }

    /**
     * True for associative arrays (or empty array, treated as empty object
     * since PHP cannot distinguish JSON {} from [] after decode).
     * Rejects null, scalars, and list-shaped arrays.
     */
    private static function isPlainObject($x): bool
    {
        if (!is_array($x)) {
            return false;
        }
        if (empty($x)) {
            return true; // empty {} treated as plain object
        }
        return !self::arrayIsList($x);
    }

    /**
     * Polyfill for array_is_list (native in PHP 8.1+).
     * Returns true if array keys are sequential integers starting from 0.
     */
    private static function arrayIsList(array $arr): bool
    {
        if (function_exists('array_is_list')) {
            return array_is_list($arr);
        }
        $i = 0;
        foreach ($arr as $k => $_v) {
            if ($k !== $i) {
                return false;
            }
            $i++;
        }
        return true;
    }

    /**
     * Mirror of Node isFiniteNumber: typeof === 'number' && !isNaN && isFinite.
     * Strict: rejects strings even if numeric (e.g., "5" rejected).
     */
    private static function isFiniteNumber($x): bool
    {
        if (!is_int($x) && !is_float($x)) {
            return false;
        }
        if (is_float($x) && (is_nan($x) || !is_finite($x))) {
            return false;
        }
        return true;
    }

    /**
     * Mirror of Node isInteger: isFiniteNumber && Math.floor(x) === x.
     * Accepts both PHP int and float-with-zero-fractional (e.g. 5.0).
     */
    private static function isInteger($x): bool
    {
        if (is_int($x)) {
            return true;
        }
        if (is_float($x) && !is_nan($x) && is_finite($x) && floor($x) == $x) {
            return true;
        }
        return false;
    }

    /**
     * Validate a single numeric field against a spec and push any errors.
     * pathLabel is the user-facing dotted path (e.g. "material.fc").
     */
    private static function checkNumericField(
        array $obj,
        array $spec,
        string $pathLabel,
        array &$errors
    ): void {
        if (!array_key_exists($spec['key'], $obj)) {
            $errors[] = $pathLabel . ' is required';
            return;
        }
        $v = $obj[$spec['key']];
        if (!is_int($v) && !is_float($v)) {
            $errors[] = $pathLabel . ' must be a number';
            return;
        }
        if (is_float($v) && is_nan($v)) {
            $errors[] = $pathLabel . ' must be a number';
            return;
        }
        if ($v < $spec['min'] || $v > $spec['max']) {
            $errors[] = $pathLabel . ' must be in range ['
                . $spec['min'] . ', ' . $spec['max'] . ']';
        }
    }
}
