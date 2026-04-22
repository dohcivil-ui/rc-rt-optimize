// generate_convergence_figure.js -- 3x3 SVG grid of HCA vs BA convergence
// trajectories. Reads out/step_11/figure_data.json and emits a self-contained
// SVG at out/step_11/figures/convergence_grid.svg.
//
// Pure Node built-ins + string concatenation. No external SVG library.

var fs = require('fs');
var path = require('path');

var IN_FILE  = path.join(__dirname, '..', 'out', 'step_11', 'figure_data.json');
var OUT_DIR  = path.join(__dirname, '..', 'out', 'step_11', 'figures');
var OUT_FILE = path.join(OUT_DIR, 'convergence_grid.svg');

// --- Layout constants ----------------------------------------------------
var FIG_W = 900;
var FIG_H = 700;
var MARGIN_TOP    = 40;
var MARGIN_BOTTOM = 60;
var MARGIN_LEFT   = 70;
var MARGIN_RIGHT  = 20;
var LEGEND_H = 30;

var GRID_ROWS = 3;
var GRID_COLS = 3;
var PANEL_GAP_X = 45;
var PANEL_GAP_Y = 55;

var PLOT_AREA_W = FIG_W - MARGIN_LEFT - MARGIN_RIGHT;
var PLOT_AREA_H = FIG_H - MARGIN_TOP - MARGIN_BOTTOM - LEGEND_H;

var PANEL_W = (PLOT_AREA_W - (GRID_COLS - 1) * PANEL_GAP_X) / GRID_COLS;
var PANEL_H = (PLOT_AREA_H - (GRID_ROWS - 1) * PANEL_GAP_Y) / GRID_ROWS;

// --- Colors --------------------------------------------------------------
var HCA_COLOR = '#c0392b';
var BA_COLOR  = '#2874a6';
var HCA_BAND  = '#c0392b';
var BA_BAND   = '#2874a6';
var AXIS_COLOR = '#333333';
var GRID_COLOR = '#dddddd';

// --- Grid position -------------------------------------------------------
var HEIGHTS = [3, 4, 5];
var FCS = [240, 280, 320];

function panelPosition(H, fc) {
  var row = HEIGHTS.indexOf(H);
  var col = FCS.indexOf(fc);
  var x = MARGIN_LEFT + col * (PANEL_W + PANEL_GAP_X);
  var y = MARGIN_TOP + row * (PANEL_H + PANEL_GAP_Y);
  return { x: x, y: y, row: row, col: col };
}

// --- Scales --------------------------------------------------------------
// Log x: iter 1..5000 (iter 0 snapped to iter 1 for log display).
function xScale(iter, panelX) {
  var clamped = (iter < 1) ? 1 : iter;
  var logMin = Math.log10(1);
  var logMax = Math.log10(5000);
  var frac = (Math.log10(clamped) - logMin) / (logMax - logMin);
  return panelX + frac * PANEL_W;
}

// Linear y, per-panel range, standard convention: high cost at top, low
// cost at bottom. cost = yMin -> bottom pixel; cost = yMax -> top pixel.
function yScaleV2(cost, panelY, yMin, yMax) {
  if (yMax === yMin) return panelY + PANEL_H / 2;
  var frac = (cost - yMin) / (yMax - yMin);
  return panelY + PANEL_H - frac * PANEL_H;
}

// --- Path builders -------------------------------------------------------
function buildPolyline(iterations, costs, panelX, panelY, yMin, yMax) {
  var pts = [];
  var i;
  for (i = 0; i < iterations.length; i++) {
    var px = xScale(iterations[i], panelX);
    var py = yScaleV2(costs[i], panelY, yMin, yMax);
    pts.push(px.toFixed(2) + ',' + py.toFixed(2));
  }
  return pts.join(' ');
}

function buildBand(iterations, upper, lower, panelX, panelY, yMin, yMax) {
  var pts = [];
  var i;
  for (i = 0; i < iterations.length; i++) {
    var px = xScale(iterations[i], panelX);
    var py = yScaleV2(upper[i], panelY, yMin, yMax);
    pts.push(px.toFixed(2) + ',' + py.toFixed(2));
  }
  for (i = iterations.length - 1; i >= 0; i--) {
    var px2 = xScale(iterations[i], panelX);
    var py2 = yScaleV2(lower[i], panelY, yMin, yMax);
    pts.push(px2.toFixed(2) + ',' + py2.toFixed(2));
  }
  return pts.join(' ');
}

// --- Axes ----------------------------------------------------------------
function buildXAxis(panelX, panelY) {
  var ticks = [1, 10, 100, 1000, 5000];
  var out = '';
  var y0 = panelY + PANEL_H;
  var i;
  out = out + '<line x1="' + panelX.toFixed(2) + '" y1="' + y0.toFixed(2) +
    '" x2="' + (panelX + PANEL_W).toFixed(2) + '" y2="' + y0.toFixed(2) +
    '" stroke="' + AXIS_COLOR + '" stroke-width="1"/>';
  for (i = 0; i < ticks.length; i++) {
    var tx = xScale(ticks[i], panelX);
    out = out + '<line x1="' + tx.toFixed(2) + '" y1="' + y0.toFixed(2) +
      '" x2="' + tx.toFixed(2) + '" y2="' + (y0 + 4).toFixed(2) +
      '" stroke="' + AXIS_COLOR + '" stroke-width="1"/>';
    out = out + '<text x="' + tx.toFixed(2) + '" y="' + (y0 + 16).toFixed(2) +
      '" font-family="Arial,sans-serif" font-size="10" text-anchor="middle" fill="' +
      AXIS_COLOR + '">' + ticks[i] + '</text>';
  }
  return out;
}

function buildYAxis(panelX, panelY, yMin, yMax) {
  var out = '';
  out = out + '<line x1="' + panelX.toFixed(2) + '" y1="' + panelY.toFixed(2) +
    '" x2="' + panelX.toFixed(2) + '" y2="' + (panelY + PANEL_H).toFixed(2) +
    '" stroke="' + AXIS_COLOR + '" stroke-width="1"/>';
  var numTicks = 4;
  var i;
  for (i = 0; i <= numTicks; i++) {
    var frac = i / numTicks;
    var val = yMin + frac * (yMax - yMin);
    var py = yScaleV2(val, panelY, yMin, yMax);
    out = out + '<line x1="' + (panelX - 4).toFixed(2) + '" y1="' + py.toFixed(2) +
      '" x2="' + panelX.toFixed(2) + '" y2="' + py.toFixed(2) +
      '" stroke="' + AXIS_COLOR + '" stroke-width="1"/>';
    out = out + '<text x="' + (panelX - 6).toFixed(2) + '" y="' + (py + 3).toFixed(2) +
      '" font-family="Arial,sans-serif" font-size="9" text-anchor="end" fill="' +
      AXIS_COLOR + '">' + Math.round(val) + '</text>';
    out = out + '<line x1="' + panelX.toFixed(2) + '" y1="' + py.toFixed(2) +
      '" x2="' + (panelX + PANEL_W).toFixed(2) + '" y2="' + py.toFixed(2) +
      '" stroke="' + GRID_COLOR + '" stroke-width="0.5"/>';
  }
  return out;
}

function buildPanelTitle(panelX, panelY, H, fc) {
  var cx = panelX + PANEL_W / 2;
  var cy = panelY - 8;
  return '<text x="' + cx.toFixed(2) + '" y="' + cy.toFixed(2) +
    '" font-family="Arial,sans-serif" font-size="12" font-weight="bold" ' +
    'text-anchor="middle" fill="#222222">H=' + H + ', fc=' + fc + '</text>';
}

// --- Panel render --------------------------------------------------------
function renderPanel(scenario) {
  var pos = panelPosition(scenario.H, scenario.fc);
  var panelX = pos.x;
  var panelY = pos.y;

  var yMin = Infinity;
  var yMax = -Infinity;
  var arrs = [
    scenario.hca.p10, scenario.hca.p90,
    scenario.ba.p10,  scenario.ba.p90
  ];
  var a, v;
  for (a = 0; a < arrs.length; a++) {
    for (v = 0; v < arrs[a].length; v++) {
      if (arrs[a][v] < yMin) yMin = arrs[a][v];
      if (arrs[a][v] > yMax) yMax = arrs[a][v];
    }
  }
  var pad = (yMax - yMin) * 0.05;
  if (pad === 0) pad = 1;
  yMin = yMin - pad;
  yMax = yMax + pad;

  var out = '';
  out = out + '<g>';

  out = out + '<rect x="' + panelX.toFixed(2) + '" y="' + panelY.toFixed(2) +
    '" width="' + PANEL_W.toFixed(2) + '" height="' + PANEL_H.toFixed(2) +
    '" fill="white" stroke="none"/>';

  out = out + buildYAxis(panelX, panelY, yMin, yMax);

  var hcaBand = buildBand(scenario.hca.iterations, scenario.hca.p90, scenario.hca.p10,
    panelX, panelY, yMin, yMax);
  out = out + '<polygon points="' + hcaBand + '" fill="' + HCA_BAND +
    '" fill-opacity="0.18" stroke="none"/>';
  var baBand = buildBand(scenario.ba.iterations, scenario.ba.p90, scenario.ba.p10,
    panelX, panelY, yMin, yMax);
  out = out + '<polygon points="' + baBand + '" fill="' + BA_BAND +
    '" fill-opacity="0.18" stroke="none"/>';

  var hcaLine = buildPolyline(scenario.hca.iterations, scenario.hca.p50,
    panelX, panelY, yMin, yMax);
  out = out + '<polyline points="' + hcaLine + '" fill="none" stroke="' +
    HCA_COLOR + '" stroke-width="1.8"/>';
  var baLine = buildPolyline(scenario.ba.iterations, scenario.ba.p50,
    panelX, panelY, yMin, yMax);
  out = out + '<polyline points="' + baLine + '" fill="none" stroke="' +
    BA_COLOR + '" stroke-width="1.8"/>';

  out = out + buildXAxis(panelX, panelY);

  out = out + buildPanelTitle(panelX, panelY, scenario.H, scenario.fc);

  out = out + '</g>';
  return out;
}

// --- Legend + global labels ---------------------------------------------
function buildLegend() {
  var cx = FIG_W / 2;
  var cy = FIG_H - 25;
  var out = '';
  out = out + '<rect x="' + (cx - 140).toFixed(2) + '" y="' + (cy - 8).toFixed(2) +
    '" width="22" height="10" fill="' + HCA_COLOR + '" fill-opacity="0.35" stroke="' +
    HCA_COLOR + '" stroke-width="1.8"/>';
  out = out + '<text x="' + (cx - 112).toFixed(2) + '" y="' + (cy + 1).toFixed(2) +
    '" font-family="Arial,sans-serif" font-size="12" fill="#222222">HCA (median +/- p10-p90)</text>';
  out = out + '<rect x="' + (cx + 30).toFixed(2) + '" y="' + (cy - 8).toFixed(2) +
    '" width="22" height="10" fill="' + BA_COLOR + '" fill-opacity="0.35" stroke="' +
    BA_COLOR + '" stroke-width="1.8"/>';
  out = out + '<text x="' + (cx + 58).toFixed(2) + '" y="' + (cy + 1).toFixed(2) +
    '" font-family="Arial,sans-serif" font-size="12" fill="#222222">BA (median +/- p10-p90)</text>';
  return out;
}

function buildGlobalLabels() {
  var out = '';
  out = out + '<text x="' + (FIG_W / 2).toFixed(2) + '" y="20" ' +
    'font-family="Arial,sans-serif" font-size="15" font-weight="bold" ' +
    'text-anchor="middle" fill="#111111">Convergence Trajectories: HCA vs BA ' +
    '(30 trials, 5000 iterations, deterministic seeds)</text>';
  var xTitleY = FIG_H - MARGIN_BOTTOM - LEGEND_H + 25;
  out = out + '<text x="' + (FIG_W / 2).toFixed(2) + '" y="' + xTitleY.toFixed(2) +
    '" font-family="Arial,sans-serif" font-size="12" text-anchor="middle" ' +
    'fill="#222222">Iteration (log scale)</text>';
  out = out + '<text x="15" y="' + (MARGIN_TOP + PLOT_AREA_H / 2).toFixed(2) + '" ' +
    'font-family="Arial,sans-serif" font-size="12" text-anchor="middle" ' +
    'fill="#222222" transform="rotate(-90 15 ' +
    (MARGIN_TOP + PLOT_AREA_H / 2).toFixed(2) + ')">Best cost found (baht)</text>';
  return out;
}

// --- Main ----------------------------------------------------------------
function main() {
  var data = JSON.parse(fs.readFileSync(IN_FILE, 'utf8'));

  var svg = '';
  svg = svg + '<?xml version="1.0" encoding="UTF-8"?>';
  svg = svg + '<svg xmlns="http://www.w3.org/2000/svg" ';
  svg = svg + 'width="' + FIG_W + '" height="' + FIG_H + '" ';
  svg = svg + 'viewBox="0 0 ' + FIG_W + ' ' + FIG_H + '">';

  svg = svg + '<rect width="' + FIG_W + '" height="' + FIG_H + '" fill="white"/>';

  svg = svg + buildGlobalLabels();

  var i;
  for (i = 0; i < data.scenarios.length; i++) {
    svg = svg + renderPanel(data.scenarios[i]);
  }

  svg = svg + buildLegend();

  svg = svg + '</svg>';

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(OUT_FILE, svg);
  var stats = fs.statSync(OUT_FILE);
  console.log('Wrote ' + OUT_FILE);
  console.log('  Size: ' + (stats.size / 1024).toFixed(1) + ' KB');
  console.log('  Panels: ' + data.scenarios.length);
}

main();
