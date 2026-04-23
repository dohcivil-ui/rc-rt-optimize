// validator.js -- manual schema validator for POST /api/optimize bodies.
// Zero dependencies (no Joi, no ajv). Collects ALL errors before returning
// rather than short-circuiting on the first failure, so clients see every
// problem in a single response.
//
// Never throws. Returns either:
//   { valid: true,  params: <normalized object> }
//   { valid: false, errors: [<string>, ...] }

// Top-level required fields with inclusive [min, max] ranges.
var REQUIRED_TOP = [
  { key: 'H',              min: 2,    max: 6    },
  { key: 'H1',             min: 0,    max: 2    },
  { key: 'gamma_soil',     min: 1.4,  max: 2.2  },
  { key: 'gamma_concrete', min: 2.0,  max: 2.8  },
  { key: 'phi',            min: 20,   max: 45   },
  { key: 'mu',             min: 0.3,  max: 0.7  },
  { key: 'qa',             min: 10,   max: 50   },
  { key: 'cover',          min: 0.04, max: 0.15 }
];

// Nested material fields -- all required, all numeric, all range-checked.
var MATERIAL_FIELDS = [
  { key: 'fy',             min: 2400, max: 6000 },
  { key: 'fc',             min: 180,  max: 400  },
  { key: 'concretePrice',  min: 1500, max: 5000 },
  { key: 'steelPrice',     min: 15,   max: 60   }
];

// maxIterations bounds (spec Day 4-7).
var MAX_ITER_MIN = 100;
var MAX_ITER_MAX = 100000;
var MAX_ITER_DEFAULT = 10000;

function isPlainObject(x) {
  return x !== null && typeof x === 'object' && !Array.isArray(x);
}

function isFiniteNumber(x) {
  return typeof x === 'number' && !isNaN(x) && isFinite(x);
}

function isInteger(x) {
  return isFiniteNumber(x) && Math.floor(x) === x;
}

// Validate a single numeric field against a spec and push any errors.
// pathLabel is the user-facing dotted path (e.g. "material.fc").
function checkNumericField(obj, spec, pathLabel, errors) {
  if (!(spec.key in obj)) {
    errors.push(pathLabel + ' is required');
    return;
  }
  var v = obj[spec.key];
  if (typeof v !== 'number' || isNaN(v)) {
    errors.push(pathLabel + ' must be a number');
    return;
  }
  if (v < spec.min || v > spec.max) {
    errors.push(pathLabel + ' must be in range [' + spec.min + ', ' + spec.max + ']');
  }
}

function validateOptimizeParams(body) {
  // Body must be a plain JSON object (reject arrays, null, primitives).
  if (!isPlainObject(body)) {
    return { valid: false, errors: ['request body must be a JSON object'] };
  }

  var errors = [];
  var i;

  // Required top-level fields.
  for (i = 0; i < REQUIRED_TOP.length; i++) {
    checkNumericField(body, REQUIRED_TOP[i], REQUIRED_TOP[i].key, errors);
  }

  // Required nested material object.
  if (!('material' in body)) {
    errors.push('material is required');
  } else if (!isPlainObject(body.material)) {
    errors.push('material must be an object');
  } else {
    for (i = 0; i < MATERIAL_FIELDS.length; i++) {
      checkNumericField(
        body.material,
        MATERIAL_FIELDS[i],
        'material.' + MATERIAL_FIELDS[i].key,
        errors
      );
    }
  }

  // Optional options block -- if present, must be an object. Individual
  // option fields are independently validated.
  var normalizedOptions = {};
  if ('options' in body) {
    if (!isPlainObject(body.options)) {
      errors.push('options must be an object');
    } else {
      if ('seed' in body.options) {
        if (!isInteger(body.options.seed)) {
          errors.push('options.seed must be an integer');
        } else {
          normalizedOptions.seed = body.options.seed;
        }
      }
      if ('maxIterations' in body.options) {
        var mi = body.options.maxIterations;
        if (!isInteger(mi)) {
          errors.push('options.maxIterations must be an integer');
        } else if (mi < MAX_ITER_MIN || mi > MAX_ITER_MAX) {
          errors.push('options.maxIterations must be in range [' +
            MAX_ITER_MIN + ', ' + MAX_ITER_MAX + ']');
        } else {
          normalizedOptions.maxIterations = mi;
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors: errors };
  }

  // Apply default for maxIterations if user did not supply one. seed is
  // left undefined when absent so the engine falls back to Math.random.
  if (typeof normalizedOptions.maxIterations !== 'number') {
    normalizedOptions.maxIterations = MAX_ITER_DEFAULT;
  }

  // Build the normalized params object -- only known fields pass through.
  // Unknown top-level fields are silently dropped per spec.
  var params = {};
  for (i = 0; i < REQUIRED_TOP.length; i++) {
    params[REQUIRED_TOP[i].key] = body[REQUIRED_TOP[i].key];
  }
  params.material = {};
  for (i = 0; i < MATERIAL_FIELDS.length; i++) {
    params.material[MATERIAL_FIELDS[i].key] = body.material[MATERIAL_FIELDS[i].key];
  }
  params.options = normalizedOptions;

  return { valid: true, params: params };
}

module.exports = {
  validateOptimizeParams: validateOptimizeParams
};
