const state = {
  data: null,
  metric: "revenue",
  grain: "day",
  planScenario: "AOP",
  selectedProjects: new Set(),
  theme: "sbe",
  start: null,
  end: null,
  primaryHits: [],
  varianceHits: [],
  revenueTrendHits: [],
  generationTrendHits: [],
};

const els = {
  actualThrough: document.getElementById("actualThrough"),
  aopYears: document.getElementById("aopYears"),
  heroSub: document.getElementById("heroSub"),
  startDate: document.getElementById("startDate"),
  endDate: document.getElementById("endDate"),
  projectButtons: document.getElementById("projectButtons"),
  grainButtons: [...document.querySelectorAll("[data-grain]")],
  metricButtons: [...document.querySelectorAll("[data-metric]")],
  planButtons: [...document.querySelectorAll("[data-plan]")],
  rangeButtons: [...document.querySelectorAll("[data-range]")],
  themeButtons: [...document.querySelectorAll("button[data-theme]")],
  clearProject: document.getElementById("clearProject"),
  notice: document.getElementById("coverageNotice"),
  actualGeneration: document.getElementById("actualGeneration"),
  actualGenerationSub: document.getElementById("actualGenerationSub"),
  aopGeneration: document.getElementById("aopGeneration"),
  aopGenerationSub: document.getElementById("aopGenerationSub"),
  generationVariance: document.getElementById("generationVariance"),
  generationVarianceSub: document.getElementById("generationVarianceSub"),
  actualRevenue: document.getElementById("actualRevenue"),
  actualRevenueSub: document.getElementById("actualRevenueSub"),
  aopRevenue: document.getElementById("aopRevenue"),
  aopRevenueSub: document.getElementById("aopRevenueSub"),
  revenueVariance: document.getElementById("revenueVariance"),
  revenueVarianceSub: document.getElementById("revenueVarianceSub"),
  primaryTrendTitle: document.getElementById("primaryTrendTitle"),
  primaryTrendSub: document.getElementById("primaryTrendSub"),
  varianceTitle: document.getElementById("varianceTitle"),
  varianceSub: document.getElementById("varianceSub"),
  leaderSub: document.getElementById("leaderSub"),
  leaderList: document.getElementById("leaderList"),
  revenueTrendSub: document.getElementById("revenueTrendSub"),
  generationTrendSub: document.getElementById("generationTrendSub"),
  tableTitle: document.getElementById("tableTitle"),
  tableSub: document.getElementById("tableSub"),
  tableHeader: document.getElementById("tableHeader"),
  tableBody: document.getElementById("tableBody"),
  primaryTrend: document.getElementById("primaryTrend"),
  varianceChart: document.getElementById("varianceChart"),
  revenueTrend: document.getElementById("revenueTrend"),
  generationTrend: document.getElementById("generationTrend"),
  tooltip: document.getElementById("chartTooltip"),
};

let colors = readThemeColors();

const metricConfig = {
  generation: {
    label: "Generation",
    unit: "MWh",
    actual: "actual_generation",
    planKey: "generation",
    format: (value) => number(value, 0),
  },
  revenue: {
    label: "Revenue",
    unit: "USD",
    actual: "actual_revenue",
    planKey: "revenue",
    format: (value) => currency(value),
  },
};

const projectGroups = [
  { label: "Orion 1-3", projects: ["Orion 1", "Orion 2", "Orion 3"] },
  { label: "Athos 1-2", projects: ["Athos 1", "Athos 2"] },
  { label: "Juno A-B", projects: ["Juno A", "Juno B"] },
];

fetch(`data/dashboard-data.json?ts=${Date.now()}`, { cache: "no-store" })
  .then((response) => {
    if (!response.ok) throw new Error(`Data load failed: ${response.status}`);
    return response.json();
  })
  .then((payload) => {
    state.data = payload;
    initialize();
    render();
  })
  .catch((error) => {
    document.body.innerHTML = `<main class="dashboard"><section class="panel"><h1>Dashboard data could not load</h1><p>${escapeHtml(error.message)}</p></section></main>`;
  });

function initialize() {
  const savedTheme = localStorage.getItem("moleculeDashboardTheme");
  if (savedTheme === "sbe" || savedTheme === "current") state.theme = savedTheme;
  const scenarios = planScenarios();
  const savedPlan = localStorage.getItem("moleculeDashboardPlanScenario");
  state.planScenario = scenarios.includes(savedPlan) ? savedPlan : scenarios.includes("AOP") ? "AOP" : scenarios[0];
  applyTheme();

  state.start = state.data.actual_date_max;
  state.end = state.data.actual_date_max;

  els.actualThrough.textContent = state.data.actual_date_max;
  updatePlanStatus();
  els.startDate.min = state.data.actual_date_min;
  els.startDate.max = state.data.actual_date_max;
  els.endDate.min = state.data.actual_date_min;
  els.endDate.max = state.data.actual_date_max;
  els.startDate.value = state.start;
  els.endDate.value = state.end;

  renderProjectButtons();

  els.startDate.addEventListener("change", () => setDateRange(els.startDate.value, state.end));
  els.endDate.addEventListener("change", () => setDateRange(state.start, els.endDate.value));
  els.grainButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.grain = button.dataset.grain;
      render();
    });
  });
  els.metricButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.metric = button.dataset.metric;
      render();
    });
  });
  els.planButtons.forEach((button) => {
    const available = scenarios.includes(button.dataset.plan);
    button.disabled = !available;
    button.addEventListener("click", () => {
      if (!available) return;
      state.planScenario = button.dataset.plan;
      localStorage.setItem("moleculeDashboardPlanScenario", state.planScenario);
      render();
    });
  });
  els.rangeButtons.forEach((button) => {
    button.addEventListener("click", () => applyQuickRange(button.dataset.range));
  });
  els.themeButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.theme = button.dataset.theme;
      localStorage.setItem("moleculeDashboardTheme", state.theme);
      applyTheme();
      render();
    });
  });
  els.clearProject.addEventListener("click", () => {
    state.selectedProjects.clear();
    render();
  });
  addCanvasClick(els.primaryTrend, () => state.primaryHits, (hit) => setDateRange(hit.start, hit.end), trendTooltip);
  addCanvasClick(els.varianceChart, () => state.varianceHits, (hit) => toggleProject(hit.project), varianceTooltip);
  addCanvasClick(els.revenueTrend, () => state.revenueTrendHits, (hit) => setDateRange(hit.start, hit.end), trendTooltip);
  addCanvasClick(els.generationTrend, () => state.generationTrendHits, (hit) => setDateRange(hit.start, hit.end), trendTooltip);
  window.addEventListener("resize", () => {
    if (state.data) render();
  });
}

function render() {
  refreshThemeColors();
  normalizeRange();
  setActiveControls();
  const rows = filteredRows();
  const totals = sumRows(rows);
  renderHeader(rows);
  renderNotice(rows);
  renderKpis(totals);
  renderPrimaryTrend(rows);
  renderVarianceByProject(rows);
  renderLeaders(rows);
  renderSmallTrends(rows);
  renderTable(rows);
}

function filteredRows() {
  return state.data.rows.filter((row) => {
    return row.date >= state.start && row.date <= state.end && (state.selectedProjects.size === 0 || state.selectedProjects.has(row.project));
  });
}

function renderHeader(rows) {
  const projectCount = new Set(rows.map((row) => row.project)).size;
  const dayCount = new Set(rows.map((row) => row.date)).size;
  updatePlanStatus();
  els.heroSub.textContent = `${selectionLabel()} | ${projectCount} projects | ${dayCount} actual days | ${state.start} to ${state.end} | ${state.planScenario} Plan`;
}

function renderNotice(rows) {
  const years = [...new Set(rows.map((row) => Number(row.date.slice(0, 4))))].sort();
  const planYears = activePlanYears();
  const missing = years.filter((year) => !planYears.includes(year));
  const hasRows = rows.length > 0;
  const missingBaseline = hasRows && rows.some((row) => rowPlanValue(row, "generation") === null || rowPlanValue(row, "revenue") === null);
  let text = "";
  if (missing.length) {
    text = `${state.planScenario} Plan baselines are not loaded for ${missing.join(", ")}. Those actuals remain visible, and Plan variance excludes missing-baseline days.`;
  } else if (missingBaseline) {
    text = `Some selected actual days do not have complete generation and revenue ${state.planScenario} Plan baselines.`;
  }
  els.notice.textContent = text;
  els.notice.classList.toggle("visible", Boolean(text));
}

function renderKpis(totals) {
  const generationVariance = totals.generation.aopCount ? totals.generation.actualCovered - totals.generation.aop : null;
  const generationPct = totals.generation.aop ? generationVariance / totals.generation.aop : null;
  const generationPerformance = metricPerformancePct(generationPct);
  const revenueVariance = totals.revenue.aopCount ? totals.revenue.actualCovered - totals.revenue.aop : null;
  const revenuePct = totals.revenue.aop ? revenueVariance / totals.revenue.aop : null;
  const revenuePerformance = metricPerformancePct(revenuePct);

  els.actualGeneration.textContent = number(totals.generation.actual, 0);
  els.actualGenerationSub.textContent = "Actual MWh";
  els.aopGeneration.textContent = totals.generation.aopCount ? number(totals.generation.aop, 0) : "Not loaded";
  els.aopGenerationSub.textContent = `${state.planScenario} Plan | ${percent(totals.generation.coverage)} coverage`;
  els.generationVariance.textContent = generationPerformance === null ? "n/a" : percent(generationPerformance);
  els.generationVarianceSub.textContent = generationVariance === null ? "No baseline" : `Variance ${percent(generationPct)} | ${signedNumber(generationVariance, 0)} MWh`;
  tone(els.generationVariance, generationVariance);

  els.actualRevenue.textContent = currency(totals.revenue.actual);
  els.actualRevenueSub.textContent = "Actual revenue";
  els.aopRevenue.textContent = totals.revenue.aopCount ? currency(totals.revenue.aop) : "Not loaded";
  els.aopRevenueSub.textContent = `${state.planScenario} Plan | ${percent(totals.revenue.coverage)} coverage`;
  els.revenueVariance.textContent = revenuePerformance === null ? "n/a" : percent(revenuePerformance);
  els.revenueVarianceSub.textContent = revenueVariance === null ? "No baseline" : `Variance ${percent(revenuePct)} | ${currencySigned(revenueVariance)}`;
  tone(els.revenueVariance, revenueVariance);
}

function renderPrimaryTrend(rows) {
  const metric = metricConfig[state.metric];
  const groups = aggregate(rows, state.grain);
  els.primaryTrendTitle.textContent = `${metric.label} ${grainLabel(state.grain)} Performance`;
  els.primaryTrendSub.textContent = `${selectionLabel()} | Actual vs ${state.planScenario} Plan`;
  drawComboChart(els.primaryTrend, groups, metric, true);
}

function renderVarianceByProject(rows) {
  const metric = metricConfig[state.metric];
  const groups = aggregate(rows, "project").sort((a, b) => Math.abs(metricVariance(b, metric)) - Math.abs(metricVariance(a, metric)));
  els.varianceTitle.textContent = `${metric.label} Variance by Project`;
  els.varianceSub.textContent = `Sorted by absolute variance to ${state.planScenario} Plan`;
  drawVarianceChart(els.varianceChart, groups.slice(0, 10), metric);
}

function renderLeaders(rows) {
  const metric = metricConfig[state.metric];
  const groups = aggregate(rows, "project").sort((a, b) => metricActual(b, metric) - metricActual(a, metric)).slice(0, 5);
  const max = Math.max(...groups.map((group) => metricActual(group, metric)), 1);
  els.leaderSub.textContent = `Top 5 by actual ${metric.label.toLowerCase()}`;
  els.leaderList.innerHTML = groups
    .map((group) => {
      const width = (metricActual(group, metric) / max) * 100;
      return `<div class="leader-row" data-project="${escapeHtml(group.label)}">
        <span class="leader-name">${escapeHtml(group.label)}</span>
        <span class="leader-track"><i class="leader-fill" style="width:${width}%"></i></span>
        <span class="leader-value">${metric.format(metricActual(group, metric))}</span>
      </div>`;
    })
    .join("");
  [...els.leaderList.querySelectorAll("[data-project]")].forEach((row) => {
    row.addEventListener("click", () => toggleProject(row.dataset.project));
  });
}

function renderSmallTrends(rows) {
  const groups = aggregate(rows, state.grain);
  els.revenueTrendSub.textContent = `${grainLabel(state.grain)} actual vs ${state.planScenario} Plan`;
  els.generationTrendSub.textContent = `${grainLabel(state.grain)} actual vs ${state.planScenario} Plan`;
  drawMiniChart(els.revenueTrend, groups, metricConfig.revenue, state.revenueTrendHits);
  drawMiniChart(els.generationTrend, groups, metricConfig.generation, state.generationTrendHits);
}

function renderTable(rows) {
  const isProjectDetail = state.selectedProjects.size === 1;
  const activeMetric = metricConfig[state.metric];
  const groups = aggregate(rows, isProjectDetail ? state.grain : "project");
  const sorted = isProjectDetail ? groups.sort((a, b) => b.key.localeCompare(a.key)) : groups.sort((a, b) => metricActual(b, activeMetric) - metricActual(a, activeMetric));
  els.tableTitle.textContent = isProjectDetail ? `${selectionLabel()} ${grainLabel(state.grain)} View` : `${selectionLabel()} Performance`;
  els.tableSub.textContent = `${sorted.length} rows | ${state.start} to ${state.end}`;
  els.tableHeader.innerHTML = [
    isProjectDetail ? "Period" : "Project",
    "Actual Gen",
    `${state.planScenario} Gen`,
    "Gen Var",
    "Gen Var / Perf",
    "Actual Rev",
    `${state.planScenario} Rev`,
    "Rev Var",
    "Rev Var / Perf",
    "Days",
  ]
    .map((label) => `<th>${label}</th>`)
    .join("");
  els.tableBody.innerHTML = sorted
    .map((group) => {
      const genVar = metricVariance(group, metricConfig.generation);
      const genVarPct = groupMetricVariancePct(group, metricConfig.generation);
      const revVar = metricVariance(group, metricConfig.revenue);
      const revVarPct = groupMetricVariancePct(group, metricConfig.revenue);
      return `<tr data-project="${isProjectDetail ? "" : escapeHtml(group.label)}" data-start="${group.start}" data-end="${group.end}">
        <td>${escapeHtml(group.label)}</td>
        <td>${number(group.actual_generation, 0)}</td>
        <td>${group.generationAopCount ? number(group.aop_generation, 0) : "n/a"}</td>
        <td class="${varianceClass(genVar)}">${genVar === null ? "n/a" : signedNumber(genVar, 0)}</td>
        <td class="${varianceClass(genVarPct)}">${variancePerformanceText(genVarPct)}</td>
        <td>${currency(group.actual_revenue)}</td>
        <td>${group.revenueAopCount ? currency(group.aop_revenue) : "n/a"}</td>
        <td class="${varianceClass(revVar)}">${revVar === null ? "n/a" : currencySigned(revVar)}</td>
        <td class="${varianceClass(revVarPct)}">${variancePerformanceText(revVarPct)}</td>
        <td>${group.days}</td>
      </tr>`;
    })
    .join("");
  [...els.tableBody.querySelectorAll("tr")].forEach((row) => {
    row.addEventListener("click", () => {
      if (row.dataset.project) toggleProject(row.dataset.project);
      else if (row.dataset.start) setDateRange(row.dataset.start, row.dataset.end);
    });
  });
}

function aggregate(rows, grain) {
  const map = new Map();
  rows.forEach((row) => {
    const period = grain === "project" ? projectPeriod(row.project) : periodFor(row.date, grain);
    if (!map.has(period.key)) {
      map.set(period.key, {
        ...period,
        actual_generation: 0,
        actual_generation_covered: 0,
        aop_generation: 0,
        generationAopCount: 0,
        actual_revenue: 0,
        actual_revenue_covered: 0,
        aop_revenue: 0,
        revenueAopCount: 0,
        rowCount: 0,
        dates: new Set(),
      });
    }
    const group = map.get(period.key);
    group.actual_generation += row.actual_generation || 0;
    group.actual_revenue += row.actual_revenue || 0;
    group.rowCount += 1;
    group.dates.add(row.date);
    const planGeneration = rowPlanValue(row, "generation");
    const planRevenue = rowPlanValue(row, "revenue");
    if (planGeneration !== null) {
      group.aop_generation += planGeneration;
      group.actual_generation_covered += row.actual_generation || 0;
      group.generationAopCount += 1;
    }
    if (planRevenue !== null) {
      group.aop_revenue += planRevenue;
      group.actual_revenue_covered += row.actual_revenue || 0;
      group.revenueAopCount += 1;
    }
  });
  return [...map.values()].map((group) => {
    group.days = group.dates.size;
    return group;
  });
}

function sumRows(rows) {
  const grouped = aggregate(rows, "all")[0] || {
    actual_generation: 0,
    actual_generation_covered: 0,
    aop_generation: 0,
    generationAopCount: 0,
    actual_revenue: 0,
    actual_revenue_covered: 0,
    aop_revenue: 0,
    revenueAopCount: 0,
    rowCount: 0,
  };
  return {
    generation: {
      actual: grouped.actual_generation,
      actualCovered: grouped.actual_generation_covered,
      aop: grouped.aop_generation,
      aopCount: grouped.generationAopCount,
      coverage: grouped.rowCount ? grouped.generationAopCount / grouped.rowCount : 0,
    },
    revenue: {
      actual: grouped.actual_revenue,
      actualCovered: grouped.actual_revenue_covered,
      aop: grouped.aop_revenue,
      aopCount: grouped.revenueAopCount,
      coverage: grouped.rowCount ? grouped.revenueAopCount / grouped.rowCount : 0,
    },
  };
}

function drawComboChart(canvas, groups, metric, collectHits) {
  const ctx = setupCanvas(canvas);
  const plot = chartBox(canvas, 62, 18, 20, 54);
  if (collectHits) state.primaryHits = [];
  const max = Math.max(...groups.flatMap((group) => [metricActual(group, metric), metricAop(group, metric) || 0]), 1);
  drawAxes(ctx, plot, max, metric.format);
  const barGap = 7;
  const barWidth = Math.max(7, Math.min(34, (plot.w - barGap * (groups.length - 1)) / Math.max(groups.length, 1) * 0.55));
  const step = groups.length <= 1 ? plot.w : plot.w / (groups.length - 1);
  const linePoints = [];
  groups.forEach((group, index) => {
    const x = groups.length <= 1 ? plot.x + plot.w / 2 : plot.x + step * index;
    const actual = metricActual(group, metric);
    const barHeight = (actual / max) * plot.h;
    const barX = x - barWidth / 2;
    const barY = plot.y + plot.h - barHeight;
    ctx.fillStyle = colors.actual;
    ctx.fillRect(barX, barY, barWidth, barHeight);
    const aop = metricAop(group, metric);
    if (aop !== null) {
      const y = plot.y + plot.h - (aop / max) * plot.h;
      linePoints.push({ x, y });
    } else {
      linePoints.push(null);
    }
    if (collectHits) {
      state.primaryHits.push({
        x: barX - 4,
        y: plot.y,
        w: barWidth + 8,
        h: plot.h,
        start: group.start,
        end: group.end,
        label: group.label,
        metric,
        actual,
        aop,
        variance: aop === null ? null : actual - aop,
      });
    }
  });
  drawLinePoints(ctx, linePoints, colors.aop);
  drawSparseLabels(ctx, plot, groups);
}

function drawMiniChart(canvas, groups, metric, hitStore) {
  const ctx = setupCanvas(canvas);
  const plot = chartBox(canvas, 48, 12, 16, 34);
  hitStore.length = 0;
  const max = Math.max(...groups.flatMap((group) => [metricActual(group, metric), metricAop(group, metric) || 0]), 1);
  drawAxes(ctx, plot, max, shortNumber);
  const values = groups.map((group) => metricActual(group, metric));
  drawLineSeries(ctx, plot, values, max, colors.actual);
  drawLineSeries(ctx, plot, groups.map((group) => metricAop(group, metric)), max, colors.aop);
  const step = groups.length <= 1 ? plot.w : plot.w / (groups.length - 1);
  groups.forEach((group, index) => {
    const x = groups.length <= 1 ? plot.x + plot.w / 2 : plot.x + step * index;
    const actual = metricActual(group, metric);
    const aop = metricAop(group, metric);
    const actualY = plot.y + plot.h - (actual / max) * plot.h;
    hitStore.push({
      x: x - 10,
      y: Math.max(plot.y, actualY - 18),
      w: 20,
      h: Math.min(plot.h, 36),
      start: group.start,
      end: group.end,
      label: group.label,
      metric,
      actual,
      aop,
      variance: aop === null ? null : actual - aop,
    });
  });
}

function drawVarianceChart(canvas, groups, metric) {
  const ctx = setupCanvas(canvas);
  const plot = chartBox(canvas, 18, 12, 28, 20);
  state.varianceHits = [];
  const values = groups.map((group) => metricVariance(group, metric)).filter((value) => value !== null);
  const maxAbs = Math.max(...values.map(Math.abs), 1);
  const zeroX = plot.x + plot.w / 2;
  const rowHeight = Math.max(34, plot.h / Math.max(groups.length, 1));
  ctx.strokeStyle = colors.grid;
  ctx.beginPath();
  ctx.moveTo(zeroX, plot.y + 20);
  ctx.lineTo(zeroX, plot.y + plot.h);
  ctx.stroke();
  ctx.font = "12px Segoe UI";
  groups.forEach((group, index) => {
    const y = plot.y + index * rowHeight;
    const variance = metricVariance(group, metric);
    ctx.fillStyle = colors.text;
    ctx.textAlign = "left";
    ctx.fillText(group.label, plot.x, y + 12);
    if (variance !== null) {
      const width = Math.abs(variance) / maxAbs * (plot.w / 2 - 4);
      const x = variance >= 0 ? zeroX : zeroX - width;
      const barY = y + 22;
      ctx.fillStyle = "rgba(203,213,225,0.10)";
      ctx.fillRect(plot.x, barY, plot.w, rowHeight * 0.22);
      ctx.fillStyle = variance >= 0 ? colors.positive : colors.negative;
      ctx.fillRect(x, barY, width, rowHeight * 0.22);
      ctx.fillStyle = colors.text;
      ctx.textAlign = variance >= 0 ? "left" : "right";
      drawBoundedValueLabel(ctx, formatVariance(variance, metric), variance >= 0, x, width, plot, barY + 10);
    } else {
      ctx.fillStyle = colors.text;
      ctx.textAlign = "left";
      ctx.fillText("n/a", plot.x, y + 32);
    }
    state.varianceHits.push({
      project: group.label,
      x: 0,
      y: y - 3,
      w: plot.x + plot.w,
      h: rowHeight,
      label: group.label,
      metric,
      actual: metricActual(group, metric),
      aop: metricAop(group, metric),
      variance,
    });
  });
}

function drawLinePoints(ctx, points, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  let active = false;
  points.forEach((point, index) => {
    if (!point) {
      if (active) ctx.stroke();
      active = false;
      return;
    }
    if (!active) {
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
      active = true;
    } else {
      ctx.lineTo(point.x, point.y);
    }
    if (index === points.length - 1) ctx.stroke();
  });
  ctx.fillStyle = color;
  points.filter(Boolean).forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawBoundedValueLabel(ctx, text, isPositive, barX, barWidth, plot, y) {
  const padding = 6;
  const textWidth = ctx.measureText(text).width;
  const plotLeft = plot.x;
  const plotRight = plot.x + plot.w;
  if (isPositive) {
    let x = barX + barWidth + padding;
    if (x + textWidth > plotRight) {
      ctx.textAlign = "right";
      x = plotRight - padding;
    } else {
      ctx.textAlign = "left";
    }
    ctx.fillText(text, x, y);
    return;
  }

  let x = barX - padding;
  if (x - textWidth < plotLeft) {
    ctx.textAlign = "left";
    x = plotLeft + padding;
  } else {
    ctx.textAlign = "right";
  }
  ctx.fillText(text, x, y);
}

function drawLineSeries(ctx, plot, values, max, color) {
  const points = values.map((value, index) => {
    if (value === null || value === undefined) return null;
    const x = values.length <= 1 ? plot.x + plot.w / 2 : plot.x + (plot.w / (values.length - 1)) * index;
    const y = plot.y + plot.h - (value / max) * plot.h;
    return { x, y };
  });
  drawLinePoints(ctx, points, color);
}

function drawAxes(ctx, plot, max, formatter) {
  ctx.strokeStyle = colors.grid;
  ctx.fillStyle = colors.text;
  ctx.font = "11px Segoe UI";
  ctx.textAlign = "right";
  for (let i = 0; i <= 4; i += 1) {
    const y = plot.y + (plot.h / 4) * i;
    const value = max - (max / 4) * i;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.w, y);
    ctx.stroke();
    ctx.fillText(formatter(value), plot.x - 8, y + 4);
  }
}

function drawSparseLabels(ctx, plot, groups) {
  if (!groups.length) return;
  ctx.fillStyle = colors.text;
  ctx.font = "11px Segoe UI";
  ctx.textAlign = "center";
  const step = groups.length <= 1 ? plot.w : plot.w / (groups.length - 1);
  const every = Math.ceil(groups.length / 8);
  groups.forEach((group, index) => {
    if (index % every !== 0 && index !== groups.length - 1) return;
    const x = groups.length <= 1 ? plot.x + plot.w / 2 : plot.x + step * index;
    ctx.fillText(group.label, x, plot.y + plot.h + 22);
  });
}

function setupCanvas(canvas) {
  const rect = canvas.getBoundingClientRect();
  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  return ctx;
}

function chartBox(canvas, left, top, right, bottom) {
  const rect = canvas.getBoundingClientRect();
  return { x: left, y: top, w: rect.width - left - right, h: rect.height - top - bottom };
}

function metricActual(group, metric) {
  return group[metric.actual] || 0;
}

function rowPlanValue(row, planKey) {
  const plan = row.plans?.[state.planScenario];
  const value = plan?.[planKey];
  if (value !== null && value !== undefined && !Number.isNaN(value)) return value;
  const legacyKey = planKey === "generation" ? "aop_generation" : "aop_revenue";
  const legacyValue = row[legacyKey];
  if (legacyValue !== null && legacyValue !== undefined && !Number.isNaN(legacyValue)) return legacyValue;
  return null;
}

function metricAop(group, metric) {
  if (metric.planKey === "generation") return group.generationAopCount ? group.aop_generation : null;
  return group.revenueAopCount ? group.aop_revenue : null;
}

function metricVariance(group, metric) {
  if (metric.planKey === "generation") {
    return group.generationAopCount ? group.actual_generation_covered - group.aop_generation : null;
  }
  return group.revenueAopCount ? group.actual_revenue_covered - group.aop_revenue : null;
}

function groupMetricVariancePct(group, metric) {
  if (metric.planKey === "generation") {
    return group.generationAopCount && group.aop_generation ? (group.actual_generation_covered - group.aop_generation) / group.aop_generation : null;
  }
  return group.revenueAopCount && group.aop_revenue ? (group.actual_revenue_covered - group.aop_revenue) / group.aop_revenue : null;
}

function metricPerformancePct(variancePct) {
  return variancePct === null || variancePct === undefined ? null : 1 + variancePct;
}

function variancePerformanceText(variancePct) {
  const performancePct = metricPerformancePct(variancePct);
  return variancePct === null || performancePct === null ? "n/a" : `${percent(variancePct)} / ${percent(performancePct)}`;
}

function projectPeriod(project) {
  return { key: project, label: project, start: state.start, end: state.end };
}

function periodFor(date, grain) {
  if (grain === "all") return { key: "all", label: "All", start: state.start, end: state.end };
  const d = parseDate(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  if (grain === "day") return { key: date, label: date, start: date, end: date };
  if (grain === "month") return { key: `${year}-${pad(month)}`, label: `${year}-${pad(month)}`, start: `${year}-${pad(month)}-01`, end: monthEndIso(year, month) };
  if (grain === "quarter") {
    const quarter = Math.floor((month - 1) / 3) + 1;
    const startMonth = (quarter - 1) * 3 + 1;
    const endMonth = startMonth + 2;
    return { key: `${year}-Q${quarter}`, label: `${year} Q${quarter}`, start: `${year}-${pad(startMonth)}-01`, end: monthEndIso(year, endMonth) };
  }
  return { key: `${year}`, label: `${year}`, start: `${year}-01-01`, end: `${year}-12-31` };
}

function planScenarios() {
  return state.data?.plan_scenarios?.length ? state.data.plan_scenarios : ["AOP"];
}

function activePlanYears() {
  return state.data?.plan_years_by_scenario?.[state.planScenario] || state.data?.aop_years || [];
}

function updatePlanStatus() {
  const years = activePlanYears();
  els.aopYears.textContent = years.length ? `${state.planScenario}: ${years.join(", ")}` : `${state.planScenario}: None`;
}

function renderProjectButtons() {
  const available = new Set(state.data.projects);
  const groupButtons = projectGroups
    .map((group) => ({ ...group, projects: group.projects.filter((project) => available.has(project)) }))
    .filter((group) => group.projects.length > 1);
  const groupHtml = groupButtons
    .map((group) => `<button type="button" class="group-chip" data-group="${escapeHtml(group.label)}">${escapeHtml(group.label)}</button>`)
    .join("");
  const projectHtml = state.data.projects
    .map((project) => `<button type="button" data-project="${escapeHtml(project)}">${escapeHtml(project)}</button>`)
    .join("");
  els.projectButtons.innerHTML = `<button type="button" data-action="all">Portfolio</button>${groupHtml}${projectHtml}`;
  els.projectButtons.querySelector("[data-action='all']").addEventListener("click", () => {
    state.selectedProjects.clear();
    render();
  });
  [...els.projectButtons.querySelectorAll("[data-group]")].forEach((button) => {
    button.addEventListener("click", () => toggleProjectGroup(button.dataset.group));
  });
  [...els.projectButtons.querySelectorAll("[data-project]")].forEach((button) => {
    button.addEventListener("click", () => toggleProject(button.dataset.project));
  });
  setActiveProjectButtons();
}

function toggleProject(project) {
  if (!project) return;
  if (state.selectedProjects.has(project)) {
    state.selectedProjects.delete(project);
  } else {
    state.selectedProjects.add(project);
  }
  render();
}

function toggleProjectGroup(label) {
  const available = new Set(state.data.projects);
  const group = projectGroups.find((item) => item.label === label);
  if (!group) return;
  const projects = group.projects.filter((project) => available.has(project));
  const allSelected = projects.every((project) => state.selectedProjects.has(project));
  projects.forEach((project) => {
    if (allSelected) state.selectedProjects.delete(project);
    else state.selectedProjects.add(project);
  });
  render();
}

function setActiveProjectButtons() {
  if (!els.projectButtons) return;
  const totalProjects = state.data?.projects?.length || 0;
  const isPortfolio = state.selectedProjects.size === 0 || state.selectedProjects.size === totalProjects;
  const portfolioButton = els.projectButtons.querySelector("[data-action='all']");
  if (portfolioButton) {
    portfolioButton.classList.toggle("active", isPortfolio);
    portfolioButton.setAttribute("aria-pressed", String(isPortfolio));
  }
  [...els.projectButtons.querySelectorAll("[data-project]")].forEach((button) => {
    const active = state.selectedProjects.has(button.dataset.project);
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  [...els.projectButtons.querySelectorAll("[data-group]")].forEach((button) => {
    const group = projectGroups.find((item) => item.label === button.dataset.group);
    const available = new Set(state.data.projects);
    const projects = group ? group.projects.filter((project) => available.has(project)) : [];
    const active = projects.length > 0 && projects.every((project) => state.selectedProjects.has(project));
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function selectionLabel() {
  if (!state.selectedProjects.size) return "Portfolio";
  const selected = state.data.projects.filter((project) => state.selectedProjects.has(project));
  if (selected.length === state.data.projects.length) return "Portfolio";
  const matchingGroup = projectGroups.find((group) => {
    const groupProjects = group.projects.filter((project) => state.data.projects.includes(project));
    return groupProjects.length === selected.length && groupProjects.every((project) => state.selectedProjects.has(project));
  });
  if (matchingGroup) return matchingGroup.label;
  if (selected.length <= 3) return selected.join(" + ");
  return `${selected.length} Projects`;
}

function setDateRange(start, end) {
  state.start = clampDate(start, state.data.actual_date_min, state.data.actual_date_max);
  state.end = clampDate(end, state.data.actual_date_min, state.data.actual_date_max);
  normalizeRange();
  els.startDate.value = state.start;
  els.endDate.value = state.end;
  render();
}

function normalizeRange() {
  state.start = clampDate(state.start, state.data.actual_date_min, state.data.actual_date_max);
  state.end = clampDate(state.end, state.data.actual_date_min, state.data.actual_date_max);
  if (state.start > state.end) [state.start, state.end] = [state.end, state.start];
}

function clampDate(value, min, max) {
  if (!value || value < min) return min;
  if (value > max) return max;
  return value;
}

function applyQuickRange(range) {
  if (range === "today") setDateRange(state.data.actual_date_max, state.data.actual_date_max);
  if (range === "last7") setDateRange(addDaysIso(state.data.actual_date_max, -6), state.data.actual_date_max);
  if (range === "mtd") setDateRange(monthStartFor(state.data.actual_date_max), state.data.actual_date_max);
  if (range === "qtd") setDateRange(quarterStartFor(state.data.actual_date_max), state.data.actual_date_max);
  if (range === "ytd") setDateRange(yearStartFor(state.data.actual_date_max), state.data.actual_date_max);
}

function setActiveControls() {
  els.grainButtons.forEach((button) => button.classList.toggle("active", button.dataset.grain === state.grain));
  els.metricButtons.forEach((button) => button.classList.toggle("active", button.dataset.metric === state.metric));
  els.planButtons.forEach((button) => button.classList.toggle("active", button.dataset.plan === state.planScenario));
  els.rangeButtons.forEach((button) => button.classList.toggle("active", quickRangeActive(button.dataset.range)));
  els.themeButtons.forEach((button) => button.classList.toggle("active", button.dataset.theme === state.theme));
  setActiveProjectButtons();
}

function applyTheme() {
  document.body.dataset.theme = state.theme;
  refreshThemeColors();
  els.themeButtons.forEach((button) => button.classList.toggle("active", button.dataset.theme === state.theme));
}

function refreshThemeColors() {
  colors = readThemeColors();
}

function readThemeColors() {
  const styles = getComputedStyle(document.body);
  const css = (name, fallback) => styles.getPropertyValue(name).trim() || fallback;
  return {
    actual: css("--actual", "#0070c0"),
    aop: css("--aop", "#b7bbbe"),
    positive: css("--positive", "#16a34a"),
    negative: css("--negative", "#dc2626"),
    grid: css("--grid", "rgba(183,187,190,0.22)"),
    text: css("--chart-text", "#b7bbbe"),
  };
}

function quickRangeActive(range) {
  if (range === "today") return state.start === state.data.actual_date_max && state.end === state.data.actual_date_max;
  if (range === "last7") return state.start === addDaysIso(state.data.actual_date_max, -6) && state.end === state.data.actual_date_max;
  if (range === "mtd") return state.start === monthStartFor(state.data.actual_date_max) && state.end === state.data.actual_date_max;
  if (range === "qtd") return state.start === quarterStartFor(state.data.actual_date_max) && state.end === state.data.actual_date_max;
  if (range === "ytd") return state.start === yearStartFor(state.data.actual_date_max) && state.end === state.data.actual_date_max;
  return false;
}

function addCanvasClick(canvas, hitsGetter, callback, tooltipFormatter) {
  canvas.addEventListener("click", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = hitsGetter().find((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h);
    if (hit) callback(hit);
  });
  canvas.addEventListener("mousemove", (event) => {
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const hit = hitsGetter().find((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h);
    canvas.style.cursor = hit ? "pointer" : "default";
    if (hit && tooltipFormatter) {
      showTooltip(event, tooltipFormatter(hit));
    } else {
      hideTooltip();
    }
  });
  canvas.addEventListener("mouseleave", hideTooltip);
}

function trendTooltip(hit) {
  return tooltipHtml(hit.label, hit.metric, hit.actual, hit.aop, hit.variance);
}

function varianceTooltip(hit) {
  return tooltipHtml(hit.label, hit.metric, hit.actual, hit.aop, hit.variance);
}

function tooltipHtml(title, metric, actual, aop, variance) {
  const varianceClassName = variance === null ? "muted" : variance >= 0 ? "positive" : "negative";
  const performance = aop ? actual / aop : null;
  return `<strong>${escapeHtml(title)} | ${escapeHtml(metric.label)}</strong>
    <div><span>Actual</span><b>${metric.format(actual)}</b></div>
    <div><span>${escapeHtml(state.planScenario)} Plan</span><b>${aop === null ? "n/a" : metric.format(aop)}</b></div>
    <div><span>Variance</span><b class="${varianceClassName}">${variance === null ? "n/a" : formatVariance(variance, metric)}</b></div>
    <div><span>Performance</span><b class="${varianceClassName}">${performance === null ? "n/a" : percent(performance)}</b></div>`;
}

function showTooltip(event, html) {
  if (!els.tooltip) return;
  els.tooltip.innerHTML = html;
  els.tooltip.classList.add("visible");
  const offset = 14;
  const rect = els.tooltip.getBoundingClientRect();
  let left = event.clientX + offset;
  let top = event.clientY + offset;
  if (left + rect.width > window.innerWidth - 12) left = event.clientX - rect.width - offset;
  if (top + rect.height > window.innerHeight - 12) top = event.clientY - rect.height - offset;
  els.tooltip.style.left = `${Math.max(12, left)}px`;
  els.tooltip.style.top = `${Math.max(12, top)}px`;
}

function hideTooltip() {
  if (!els.tooltip) return;
  els.tooltip.classList.remove("visible");
}

function varianceClass(value) {
  if (value === null || value === undefined) return "muted";
  return value >= 0 ? "positive" : "negative";
}

function tone(element, value) {
  element.classList.remove("positive", "negative", "muted");
  if (value === null || value === undefined) element.classList.add("muted");
  else element.classList.add(value >= 0 ? "positive" : "negative");
}

function grainLabel(grain) {
  return { day: "Daily", month: "Monthly", quarter: "Quarterly", year: "Yearly" }[grain] || "Period";
}

function yearStartFor(iso) {
  return `${iso.slice(0, 4)}-01-01`;
}

function monthStartFor(iso) {
  return `${iso.slice(0, 7)}-01`;
}

function quarterStartFor(iso) {
  const date = parseDate(iso);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const quarterStartMonth = Math.floor(month / 3) * 3 + 1;
  return `${year}-${pad(quarterStartMonth)}-01`;
}

function parseDate(iso) {
  return new Date(`${iso}T00:00:00Z`);
}

function addDaysIso(iso, days) {
  const date = parseDate(iso);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function monthEndIso(year, month) {
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function number(value, digits = 0) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value || 0);
}

function signedNumber(value, digits = 0) {
  const formatted = number(Math.abs(value || 0), digits);
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function currency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value || 0);
}

function currencySigned(value) {
  const formatted = currency(Math.abs(value || 0));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function formatVariance(value, metric) {
  return metric.label === "Revenue" ? currencySigned(value) : signedNumber(value, 0);
}

function percent(value) {
  return new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(value || 0);
}

function shortNumber(value) {
  const abs = Math.abs(value || 0);
  if (abs >= 1_000_000_000) return `${number(value / 1_000_000_000, 1)}B`;
  if (abs >= 1_000_000) return `${number(value / 1_000_000, 1)}M`;
  if (abs >= 1_000) return `${number(value / 1_000, 0)}K`;
  return number(value, 0);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
