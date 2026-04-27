// web/src/data/cases.js
// 9 case studies from VB6 RC_RT_HCA v2.0 (vb6_samples + modShared.bas)
// Maha Sarakham Province prices, พ.ย. 2568
// Used by Day 6.6 URL param ?case=H3-240..H5-320 and Day 6.7 ?demo=1 grid

export var DEFAULT_PARAMS = {
  H1: 1.20,
  mu: 0.60,
  gamma_soil: 1.80,
  phi: 30,
  qa: 30,
  gamma_concrete: 2.40,
  cover: 0.075
};

// Concrete price by f'c (modShared.bas GetConcretePrice, baht/m3)
var CONCRETE_PRICE = { 240: 2430, 280: 2524, 320: 2617 };
var STEEL_PRICE_SD40 = 24; // baht/kg
var FY_SD40 = 4000;        // ksc

function makeCase(H, fc) {
  return {
    ...DEFAULT_PARAMS,
    H: H,
    material: {
      fy: FY_SD40,
      fc: fc,
      concretePrice: CONCRETE_PRICE[fc],
      steelPrice: STEEL_PRICE_SD40
    },
    label: 'H=' + H + 'm, fc=' + fc + ' ksc'
  };
}

export var CASE_STUDIES = {
  'H3-240': makeCase(3, 240),
  'H3-280': makeCase(3, 280),
  'H3-320': makeCase(3, 320),
  'H4-240': makeCase(4, 240),
  'H4-280': makeCase(4, 280),
  'H4-320': makeCase(4, 320),
  'H5-240': makeCase(5, 240),
  'H5-280': makeCase(5, 280),
  'H5-320': makeCase(5, 320)
};
