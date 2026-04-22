# Step 10.3 -- HCA vs BA Head-to-Head Comparison

**Run date:** 2026-04-22T05:43:13.659Z
**Paired design:** 9 scenarios x 30 trials = 270 paired observations
**Seed strategy:** deterministic (same seed used for both algorithms in each paired trial)
**Iteration budget per trial:** 5000

## 1. Executive Summary

Across the full 9-scenario matrix (H={3,4,5} x fc={240,280,320}), the
Bisection Algorithm (BA) dominates the Hill-Climbing Algorithm (HCA) on
all three performance axes: convergence speed, solution reliability, and
final cost. All three effects are statistically significant at alpha=0.05,
with speed and reliability reaching the numerical precision limit of the
normal-approximation tests.

- **Speed (paired Wilcoxon signed-rank, n=270):** BA converges faster
  than HCA at p <1e-16 (W+=34511.0, W-=2074.0, r=0.769 -- large effect).
- **Reliability (paired McNemar, 2x2 discordant):** BA caught 47 optima that HCA missed, while HCA caught only 6 that BA missed (p 3.93e-8, odds ratio c/b=7.83).
- **Cost (paired mean delta, HCA - BA):** BA designs are on average 10.28 baht cheaper per trial, 95% CI [6.22, 14.34] (CI excludes zero -> BA significantly cheaper).

The headline demonstration is the H=5 fc=240 scenario. At the standard
5000-iteration budget, HCA hits the global optimum in 0/30 trials, while BA hits it in 9/30 trials on the identical
seed matrix. HCA requires a companion 20000-iteration run (Step 9.5) to
reach this optimum; BA reaches it at the standard budget without deferral.

## 2. Methodology

### 2.1 Paired experimental design

Both algorithms ran against identical deterministic seeds (1..30) for each of the 9 scenarios. Within each scenario, trial k of HCA is paired
with trial k of BA: they share the same RNG seed, the same parameter set,
and the same iteration budget. This eliminates between-run variance and
isolates the algorithmic difference as the only variable of interest.

### 2.2 Statistical tests

| Test | Null hypothesis | What it detects |
|---|---|---|
| Wilcoxon signed-rank | median(HCA_iter - BA_iter) = 0 | Convergence speed difference |
| McNemar (2x2 discordant) | b = c (discordant hit/miss pairs equal) | Reliability difference |
| Paired cost-delta 95% CI | mean(HCA_cost - BA_cost) = 0 | Effect size on final cost |

All three tests apply to paired observations; independent-sample versions
(Mann-Whitney U, Fisher exact) would be under-powered on this design.
Wilcoxon and McNemar use normal approximation with continuity correction
(McNemar falls back to exact binomial when b+c < 25). Cost-delta CI uses
the normal approximation with sample standard deviation.

### 2.3 Analysis levels

Results are reported at three levels to expose scaling patterns:

- **Per-scenario** (9 cells, n=30 each): table of individual-cell verdicts.
- **Stratified per-H** (3 strata, n=90 each): tests the hypothesis that BA's
  advantage scales with problem difficulty.
- **Pooled** (n=270): single highest-power summary across all scenarios.

## 3. Pooled Headline Results (n=270)

| Test | Statistic | p-value | Direction | Effect |
|---|---|:---:|:---:|---|
| Wilcoxon (loop count) | W+=34511.0, W-=2074.0 | <1e-16 | BA_FASTER | r=0.769 (large) |
| McNemar (hit/miss) | b=6, c=47 | 3.93e-8 | BA_MORE_RELIABLE | OR=7.83 |
| Cost delta (HCA - BA) | mean=10.28 baht, SD=34.02 | -- | BA CHEAPER | 95% CI=[6.22, 14.34] |

Concordance summary: both algorithms reached the optimum in 166/270 paired trials and both failed in 51/270. Discordant pairs (BA won 47, HCA won 6) drive the McNemar verdict.

## 4. Per-scenario Results

| H | fc | HCA hits | BA hits | HCA iter | BA iter | Speedup | Wilcoxon p | r | McNemar b/c | McNemar p | Cost delta | 95% CI |
|---:|---:|:---:|:---:|---:|---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 3 | 240 | 30/30 | 30/30 | 378 | 84 | 77.7%  | 1.83e-6 | 0.87 | 0/0 | 1.0000 | 0.00 | [0.00, 0.00] |
| 3 | 280 | 30/30 | 30/30 | 368 | 83 | 77.4%  | 1.83e-6 | 0.87 | 0/0 | 1.0000 | 0.00 | [0.00, 0.00] |
| 3 | 320 | 30/30 | 30/30 | 354 | 85 | 76.1%  | 2.02e-6 | 0.87 | 0/0 | 1.0000 | 0.00 | [0.00, 0.00] |
| 4 | 240 | 25/30 | 30/30 | 2186 | 569 | 74.0%  | 6.04e-6 | 0.83 | 0/5 | 0.0625 | 4.77 | [-0.44, 9.99] |
| 4 | 280 | 23/30 | 30/30 | 2346 | 569 | 75.8%  | 6.04e-6 | 0.83 | 0/7 | 0.0156 | 4.52 | [0.74, 8.30] |
| 4 | 320 | 24/30 | 30/30 | 2223 | 574 | 74.2%  | 7.20e-5 | 0.72 | 0/6 | 0.0313 | 3.21 | [0.28, 6.13] |
| 5 | 240 | 0/30 | 9/30 | 2679 | 1167 | 56.4%  | 9.31e-5 | 0.71 | 0/9 | 0.0039 | 48.45 | [28.21, 68.68] |
| 5 | 280 | 6/30 | 12/30 | 2462 | 752 | 69.4%  | 8.89e-6 | 0.81 | 3/9 | 0.1460 | 9.65 | [-12.56, 31.86] |
| 5 | 320 | 4/30 | 12/30 | 2828 | 732 | 74.1%  | 4.08e-6 | 0.84 | 3/11 | 0.0574 | 21.94 | [9.55, 34.32] |

Speedup is signed relative loop-count reduction, (HCA-BA)/HCA; positive
means BA converges in fewer iterations. Cost delta is mean(HCA-BA) in
baht; positive means HCA is more expensive. All p-values are two-sided.

## 5. Stratified Analysis -- Difficulty-Scaling Hypothesis

### 5.1 Per-height breakdown (n=90 per stratum)

| H | Wilcoxon p | Wilcoxon r | McNemar b/c | McNemar p | Cost delta mean | 95% CI |
|---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 3 | 2.22e-16 | 0.868 (large) | 0/0 | 1.0000 | 0.00 | [0.00, 0.00] |
| 4 | 6.79e-14 | 0.790 (large) | 0/18 | 7.63e-6 | 4.16 | [1.83, 6.50] |
| 5 | 8.46e-14 | 0.787 (large) | 6/29 | 0.0002 | 26.68 | [15.45, 37.90] |

### 5.2 Finding

The difficulty-scaling pattern first identified in Step 10.2 (BA vs VB6 BA)
is confirmed in the Node-internal HCA vs BA comparison:

- At H=3, both algorithms routinely find the global optimum, and the cost
  delta is near zero. The Wilcoxon verdict is driven almost entirely by
  iteration-count differences on scenarios where both algorithms converge.
- At H=4, BA begins to outperform HCA on reliability, with McNemar
  discordant counts opening up (b=0 vs c=18).
- At H=5, BA's advantage is most pronounced: the McNemar discordant split
  reaches b=6 vs c=29, and the cost delta CI is furthest from zero.

This supports the paper's central claim that the BA-over-HCA advantage is
not a flat constant but a difficulty-sensitive effect: the harder the
optimization problem, the more BA gains.

## 6. Centrepiece -- H=5 fc=240

### 6.1 Quantitative summary

| Metric | HCA | BA |
|---|---:|---:|
| Trials hitting global optimum | 0/30 | 9/30 |
| Best cost found across 30 trials (baht) | 5500.96 | 5459.80 |
| Mean best cost across trials (baht) | 5552.40 | 5503.95 |
| Mean iterations to best | 2679 | 1167 |

### 6.2 Paired statistical tests

- **Wilcoxon signed-rank:** p=9.31e-5, r=0.713 (large effect), direction BA_FASTER.
- **McNemar:** b=0, c=9, bothMiss=21, p=0.0039 (exact binomial).
- **Cost delta (HCA - BA):** mean=48.45 baht, 95% CI [28.21, 68.68] -- both CI bounds strictly positive.

### 6.3 Interpretation

This scenario is the cleanest demonstration of the BA advantage reported
in this paper. Under identical conditions -- identical parameters,
identical seeds, identical 5000-iteration budget -- HCA fails to hit the
optimum in any of 30 trials, whereas BA hits it in 9.
The McNemar discordant count (b=0, c=9) is entirely one-sided: there is no seed for which HCA found the optimum
while BA did not. Among the 21 trials where both
algorithms failed, BA still tends to land closer to the optimum on average
(mean cost 5503.95 vs 5552.40), confirming that BA's advantage is not only about reaching the optimum
but about the quality of the final design even when it does not.

In the context of the modernisation study, this means a retaining-wall
design generated by BA at the standard 5000-iteration budget is both
more reliable and measurably cheaper than one generated by HCA.

## 7. Discussion

### 7.1 Why BA dominates

HCA is a stochastic hill-climbing search over a three-dimensional design
index space (tb, TBase, Base). Each iteration proposes a neighbour by
random step; acceptance follows a Metropolis-style rule. BA, by contrast,
performs triple bisection: at each outer step it divides each of the three
indices' search ranges in half and inner-loops within the shrunken
subspace. This converts an effectively linear random walk into a
logarithmic bisection, explaining both the speed advantage (BA reaches
a good region in O(log n) outer steps) and the reliability advantage on
difficult scenarios (HCA can get trapped in local basins that BA's
bisection discipline escapes).

### 7.2 Threats to validity

- **Sample size:** 30 trials per cell is modest. The pooled result (n=270)
  is well-powered, and the Wilcoxon verdict remains strong at every
  height. At H=3, McNemar is vacuous (b=c=0 in every cell) because both
  algorithms reliably hit the optimum; per-cell reliability verdicts at
  H=3 rest on concordant success rather than discordant evidence.
- **Platform:** both algorithms run on the same Node.js runtime and RNG
  stream. Results are not directly transferable to alternative platforms
  (e.g., the original VB6 runtime), though Step 9.5 and Step 10.2 have
  separately validated each port against its VB6 counterpart.
- **Parameter space:** the H={3,4,5} x fc={240,280,320} matrix is the
  published research scope. BA's advantage at larger H remains to be
  measured and is left for future work.

### 7.3 Relation to VB6 validation

Step 9.5 validated the Node HCA port against VB6 HCA (9/9 scenarios).
Step 10.2 validated the Node BA port against VB6 BA (9/9 effective pass).
The present head-to-head comparison therefore inherits full port fidelity
from both sides: every HCA vs BA conclusion reported here is algorithmic,
not an artifact of porting.

## 8. Conclusions for Paper

1. The Bisection Algorithm dominates the Hill-Climbing Algorithm across
   the full 9-scenario matrix on every measured axis: convergence speed,
   reliability of reaching the global optimum, and cost-quality of the
   final design. All three effects are statistically significant at
   alpha=0.05 on paired tests.
2. The BA-over-HCA advantage is not constant across problem difficulty
   but scales with it. At H=3, both algorithms converge reliably and
   differ mainly in iteration count. At H=5, BA catches optima that HCA
   misses entirely.
3. The H=5 fc=240 scenario is the paper's clearest single result:
   HCA 0/30 hits vs BA 9/30 hits
   at the standard 5000-iteration budget, with a paired cost advantage
   of 48.45 baht per trial (95% CI [28.21, 68.68]).
4. Recommendation for the modernised system: use BA as the primary
   optimization engine. HCA remains a useful baseline for academic
   comparison and educational contexts, but is not the preferred
   production algorithm given the evidence reported here.

---

### Data availability

All test data are in `backend/out/comparison/comparison_results.json`,
including raw per-trial records for each of the 270 paired observations. Regenerate by running `node scripts/run_comparison.js`
from the `backend/` directory.

_Generated by backend/scripts/generate_comparison_report.js from comparison_results.json._