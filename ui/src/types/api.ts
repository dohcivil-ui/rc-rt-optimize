// src/types/api.ts
// Types for POST /api/optimize
// Source of truth: rcopt handoff v5.1 API contract

export type Material = {
  fy: number;
  fc: number;
  concretePrice: number;
  steelPrice: number;
};

export type OptimizeOptions = {
  seed?: number;
  maxIterations?: number;
};

export type OptimizeRequest = {
  H: number;
  H1: number;
  gamma_soil: number;
  gamma_concrete: number;
  phi: number;
  mu: number;
  qa: number;
  cover: number;
  material: Material;
  options?: OptimizeOptions;
};

export type Design = {
  tt: number;
  tb: number;
  TBase: number;
  Base: number;
  LToe: number;
  LHeel: number;
};

export type Steel = {
  stemDB_idx: number;
  stemSP_idx: number;
  toeDB_idx: number;
  toeSP_idx: number;
  heelDB_idx: number;
  heelSP_idx: number;
};

export type OptimizeSuccess = {
  bestCost: number;
  bestIteration: number;
  bestDesign: Design;
  bestSteel: Steel;
  runtime_ms: number;
  algorithm: 'ba' | 'hca';
};

export type ValidationError = {
  error: 'validation_failed';
  details: string[];
};

export type InternalError = {
  error: 'internal_error';
  message: string;
};

export type OptimizeError = ValidationError | InternalError;

export type OptimizeResponse = OptimizeSuccess | OptimizeError;

// Type guard -- narrows OptimizeResponse to OptimizeError when true
export const isOptimizeError = (r: OptimizeResponse): r is OptimizeError => {
  return 'error' in r;
};
