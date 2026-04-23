<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchLiveFxRatesToJPY } from '$lib/fx-fetch';
  import { COUNTRY_RULES } from '$lib/tax/rules';
  import { compareAllCountries } from '$lib/tax/compare';
  import { buildSalarySweep, DEFAULT_SALARY_SWEEP_RANGE } from '$lib/tax/salarySweep';
  import type { SalarySweepResult, SalarySweepSeries } from '$lib/tax/salarySweep';
  import {
    buildSweepHoverSummary,
    getNearestSweepIndex,
    type SweepHoverRow
  } from '$lib/tax/salarySweepHover';
  import { convertCurrency, DEFAULT_FX_RATES, formatMoney } from '$lib/fx';
  import {
    getCitiesForCountry,
    getHouseholdType,
    totalMonthlyCoL,
    COL_VERSION,
    HOUSEHOLD_BEDROOMS
  } from '$lib/costOfLiving';
  import type {
    CalculatorInput,
    CountryCode,
    CountryResult,
    Currency,
    FxRates,
    FxSource,
    SalaryPeriod
  } from '$lib/types';

  type DisplayCountry = {
    result: CountryResult;
    grossDisplay: number;
    taxDisplay: number;
    contribDisplay: number;
    netDisplay: number;
    netMonthlyDisplay: number;
    effectiveRateDisplay: string;
  };

  type ThemePreference = 'system' | 'light' | 'dark';
  type FxEditableCurrency = Exclude<Currency, 'JPY'>;
  type SweepPointLabel = {
    annualUSD: number;
    annualDisplay: number;
    x: number;
  };
  type SweepHoverMarker = {
    country: CountryCode;
    x: number;
    y: number;
  };

  const SWEEP_CHART_WIDTH = 920;
  const SWEEP_CHART_HEIGHT = 360;
  const SWEEP_CHART_INSET = {
    top: 18,
    right: 18,
    bottom: 56,
    left: 108
  };
  const SWEEP_PLOT_WIDTH = SWEEP_CHART_WIDTH - SWEEP_CHART_INSET.left - SWEEP_CHART_INSET.right;
  const SWEEP_PLOT_HEIGHT = SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.top - SWEEP_CHART_INSET.bottom;
  const SWEEP_TOOLTIP_WIDTH = 300;
  const SWEEP_TOOLTIP_HEADER_HEIGHT = 60;
  const SWEEP_TOOLTIP_ROW_HEIGHT = 17;

  const countrySeriesColors: Record<CountryCode, string> = {
    JP: '#00a7a0',
    SE: '#3366ff',
    TH: '#0d7a4f',
    CH: '#e07b24',
    UK: '#355070',
    USCA: '#d64545',
    MY: '#0f9ea8',
    SG: '#d26f06',
    IN: '#1f4f9e'
  };

  const INPUT_STORAGE_KEY = 'tax-calc-input-v2';
  const INPUT_STORAGE_KEY_V1 = 'tax-calc-input-v1';
  const FX_STORAGE_KEY = 'tax-calc-fx-v2';
  const FX_STORAGE_KEY_V1 = 'tax-calc-fx-v1';
  const THEME_STORAGE_KEY = 'tax-calc-theme-v2';
  const THEME_STORAGE_KEY_V1 = 'tax-calc-theme-v1';

  const ALL_CURRENCIES: Currency[] = ['JPY', 'SEK', 'THB', 'CHF', 'GBP', 'USD', 'MYR', 'SGD', 'INR'];
  const FX_EDITABLE_CURRENCIES: FxEditableCurrency[] = [
    'SEK',
    'THB',
    'CHF',
    'GBP',
    'USD',
    'MYR',
    'SGD',
    'INR'
  ];

  const salaryBounds: Record<Currency, { max: number; step: number }> = {
    JPY: { max: 30_000_000, step: 10_000 },
    SEK: { max: 2_500_000, step: 1_000 },
    THB: { max: 8_000_000, step: 1_000 },
    CHF: { max: 500_000, step: 100 },
    GBP: { max: 500_000, step: 100 },
    USD: { max: 800_000, step: 100 },
    MYR: { max: 1_200_000, step: 100 },
    SGD: { max: 800_000, step: 100 },
    INR: { max: 50_000_000, step: 10_000 }
  };

  const countryNames: Record<CountryResult['country'], string> = {
    JP: 'Japan',
    SE: 'Sweden',
    TH: 'Thailand',
    CH: 'Switzerland',
    UK: 'United Kingdom',
    USCA: 'USA (California)',
    MY: 'Malaysia',
    SG: 'Singapore',
    IN: 'India'
  };

  let salaryAmount = 5_000_000;
  let salaryPeriod: SalaryPeriod = 'annual';
  let inputCurrency: Currency = 'JPY';
  let displayCurrency: Currency = 'JPY';

  let married = false;
  let spouseHasIncome = false;
  let dependents = 0;
  let age = 30;

  let selectedColCity: Partial<Record<CountryCode, string>> = {};
  let hoveredSavingsCountry: CountryCode | null = null;
  $: colHouseholdType = getHouseholdType(married, dependents);

  type ColCardData = {
    cities: ReturnType<typeof getCitiesForCountry>;
    cityId: string;
    city: ReturnType<typeof getCitiesForCountry>[number];
    costs: ReturnType<typeof getCitiesForCountry>[number]['costs'][typeof colHouseholdType];
    total: number;
  };
  $: colData = (() => {
    const codes: CountryCode[] = ['JP', 'SE', 'TH', 'CH', 'UK', 'USCA', 'MY', 'SG', 'IN'];
    const result: Partial<Record<CountryCode, ColCardData>> = {};
    for (const code of codes) {
      const cities = getCitiesForCountry(code);
      if (!cities.length) continue;
      const cityId = selectedColCity[code] ?? cities[0].id;
      const city = cities.find((c) => c.id === cityId);
      if (!city) continue;
      const costs = city.costs[colHouseholdType];
      result[code] = { cities, cityId, city, costs, total: totalMonthlyCoL(costs) };
    }
    return result;
  })();

  function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function donutArcPath(cx: number, cy: number, rOuter: number, rInner: number, startDeg: number, endDeg: number): string {
    const end = Math.min(endDeg, startDeg + 359.99);
    const o1 = polarToCartesian(cx, cy, rOuter, startDeg);
    const o2 = polarToCartesian(cx, cy, rOuter, end);
    const i2 = polarToCartesian(cx, cy, rInner, end);
    const i1 = polarToCartesian(cx, cy, rInner, startDeg);
    const large = end - startDeg > 180 ? 1 : 0;
    return `M${o1.x} ${o1.y} A${rOuter} ${rOuter} 0 ${large} 1 ${o2.x} ${o2.y} L${i2.x} ${i2.y} A${rInner} ${rInner} 0 ${large} 0 ${i1.x} ${i1.y}Z`;
  }

  type SavingsEntry = {
    country: CountryCode;
    name: string;
    amountDisplay: number;
    amountLocal: number;
    localCurrency: Currency;
    pctOfTakeHome: number;
    color: string;
    pctOfTotal: number;
    path: string;
  };

  $: colSavingsData = (() => {
    const CX = 130, CY = 130, R_OUT = 108, R_IN = 62;
    const entries = displayCountries
      .map((item): SavingsEntry | null => {
        const col = colData[item.result.country];
        if (!col || col.total === 0) return null;
        const afterLocal = item.result.netMonthlyLocal - col.total;
        const afterDisplay = convertCurrency(afterLocal, item.result.currency, displayCurrency, fxRates);
        return {
          country: item.result.country,
          name: countryNames[item.result.country],
          amountDisplay: afterDisplay,
          amountLocal: afterLocal,
          localCurrency: item.result.currency,
          pctOfTakeHome: item.result.netMonthlyLocal > 0
            ? Math.round((afterLocal / item.result.netMonthlyLocal) * 100) : 0,
          color: countrySeriesColors[item.result.country],
          pctOfTotal: 0,
          path: ''
        };
      })
      .filter((x): x is SavingsEntry => x !== null);

    const positives = entries.filter((e) => e.amountDisplay > 0).sort((a, b) => b.amountDisplay - a.amountDisplay);
    const deficits = entries.filter((e) => e.amountDisplay <= 0);
    const total = positives.reduce((s, e) => s + e.amountDisplay, 0);

    let angle = 0;
    const slices = positives.map((e) => {
      const sweep = (e.amountDisplay / total) * 360;
      const start = angle;
      angle += sweep;
      return { ...e, pctOfTotal: Math.round((e.amountDisplay / total) * 100), path: donutArcPath(CX, CY, R_OUT, R_IN, start, angle) };
    });

    return { slices, deficits, total };
  })();

  let residencyJP = 12;
  let residencySE = 12;
  let residencyTH = 12;
  let residencyCH = 12;
  let residencyUK = 12;
  let residencyUSCA = 12;
  let residencyMY = 12;
  let residencySG = 12;
  let residencyIN = 12;

  let fxSEKToJPY = DEFAULT_FX_RATES.toJPY.SEK;
  let fxTHBToJPY = DEFAULT_FX_RATES.toJPY.THB;
  let fxCHFToJPY = DEFAULT_FX_RATES.toJPY.CHF;
  let fxGBPToJPY = DEFAULT_FX_RATES.toJPY.GBP;
  let fxUSDToJPY = DEFAULT_FX_RATES.toJPY.USD;
  let fxMYRToJPY = DEFAULT_FX_RATES.toJPY.MYR;
  let fxSGDToJPY = DEFAULT_FX_RATES.toJPY.SGD;
  let fxINRToJPY = DEFAULT_FX_RATES.toJPY.INR;
  let fxUpdatedAt = DEFAULT_FX_RATES.updatedAt;

  let fxSource: FxSource = 'default';

  let themePreference: ThemePreference = 'system';
  let systemPrefersDark = false;
  let isDarkTheme = false;
  let resolvedThemeLabel = 'Light (system)';

  let loaded = false;
  let fxRates: FxRates = DEFAULT_FX_RATES;
  let calculatorInput: CalculatorInput;
  let comparison = compareAllCountries(
    {
      salaryAmount,
      salaryPeriod,
      inputCurrency,
      displayCurrency,
      married,
      spouseHasIncome,
      dependents,
      age,
      residencyMonths: {
        JP: residencyJP,
        SE: residencySE,
        TH: residencyTH,
        CH: residencyCH,
        UK: residencyUK,
        USCA: residencyUSCA,
        MY: residencyMY,
        SG: residencySG,
        IN: residencyIN
      }
    },
    fxRates
  );

  let displayCountries: DisplayCountry[] = [];
  let highestMonthlyNet = 1;
  let fxUpdatedDisplay = 'default';
  let salarySweep: SalarySweepResult = {
    range: DEFAULT_SALARY_SWEEP_RANGE,
    ticks: [],
    series: []
  };
  let hiddenSweepCountries: CountryCode[] = [];
  let visibleSweepSeries: SalarySweepSeries[] = [];
  let sweepYDomainMax = 1;
  let sweepYTicks: number[] = [];
  let sweepXLabels: SweepPointLabel[] = [];
  let sweepHoverIndex: number | null = null;
  let sweepHoverAnnualUSD = 0;
  let sweepHoverAnnualDisplay = 0;
  let sweepHoverRows: SweepHoverRow[] = [];
  let sweepHoverMarkers: SweepHoverMarker[] = [];
  let sweepHoverX = SWEEP_CHART_INSET.left;
  let sweepHoverTooltipX = SWEEP_CHART_INSET.left + 10;
  let sweepHoverTooltipHeight = 64;
  let sweepHoverBaselineCountry: CountryCode | null = null;

  function isCurrency(value: unknown): value is Currency {
    return typeof value === 'string' && ALL_CURRENCIES.includes(value as Currency);
  }

  function isThemePreference(value: unknown): value is ThemePreference {
    return value === 'system' || value === 'light' || value === 'dark';
  }

  function clampResidencyMonth(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(12, Math.round(value)));
  }

  function setThemePreference(next: ThemePreference): void {
    themePreference = next;
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    }
  }

  function markFxAsManualSave(): void {
    fxSource = 'saved';
    fxUpdatedAt = new Date().toISOString();
  }

  function toggleSweepCountry(country: CountryCode): void {
    if (hiddenSweepCountries.includes(country)) {
      hiddenSweepCountries = hiddenSweepCountries.filter((item) => item !== country);
      return;
    }
    hiddenSweepCountries = [...hiddenSweepCountries, country];
  }

  function resetSweepCountries(): void {
    hiddenSweepCountries = [];
  }

  function isSweepCountryHidden(country: CountryCode): boolean {
    return hiddenSweepCountries.includes(country);
  }

  function getSweepX(annualUSD: number): number {
    const innerWidth = SWEEP_CHART_WIDTH - SWEEP_CHART_INSET.left - SWEEP_CHART_INSET.right;
    const usdSpan = salarySweep.range.maxAnnualUSD - salarySweep.range.minAnnualUSD;
    if (usdSpan <= 0) return SWEEP_CHART_INSET.left;
    return SWEEP_CHART_INSET.left + ((annualUSD - salarySweep.range.minAnnualUSD) / usdSpan) * innerWidth;
  }

  function getSweepY(netMonthlyDisplay: number): number {
    const innerHeight = SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.top - SWEEP_CHART_INSET.bottom;
    return SWEEP_CHART_INSET.top + innerHeight - (netMonthlyDisplay / sweepYDomainMax) * innerHeight;
  }

  function getSweepYForSeries(series: SalarySweepSeries, annualUSD: number): number | null {
    const points = series.points;
    if (points.length === 0) return null;
    if (annualUSD <= points[0].annualUSD) return getSweepY(points[0].netMonthlyDisplay);
    const last = points[points.length - 1];
    if (annualUSD >= last.annualUSD) return getSweepY(last.netMonthlyDisplay);
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      if (annualUSD >= prev.annualUSD && annualUSD <= curr.annualUSD) {
        const span = curr.annualUSD - prev.annualUSD;
        const t = span > 0 ? (annualUSD - prev.annualUSD) / span : 0;
        return getSweepY(prev.netMonthlyDisplay + t * (curr.netMonthlyDisplay - prev.netMonthlyDisplay));
      }
    }
    return null;
  }

  function createSweepPath(series: SalarySweepSeries): string {
    return series.points
      .map((point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${command} ${getSweepX(point.annualUSD)} ${getSweepY(point.netMonthlyDisplay)}`;
      })
      .join(' ');
  }

  function roundSweepStep(maxValue: number): number {
    const roughStep = maxValue / 5;
    if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
    const power = 10 ** Math.floor(Math.log10(roughStep));
    const normalized = roughStep / power;

    if (normalized <= 1) return power;
    if (normalized <= 2) return 2 * power;
    if (normalized <= 5) return 5 * power;
    return 10 * power;
  }

  function resetSweepHover(): void {
    sweepHoverIndex = null;
  }

  function handleSweepPointerMove(event: PointerEvent): void {
    const target = event.currentTarget as SVGRectElement | null;
    if (!target) return;

    const bounds = target.getBoundingClientRect();
    if (bounds.width <= 0) return;

    const relativeX = ((event.clientX - bounds.left) / bounds.width) * SWEEP_PLOT_WIDTH;
    const clampedX = Math.max(0, Math.min(SWEEP_PLOT_WIDTH, relativeX));
    const annualUSD =
      salarySweep.range.minAnnualUSD +
      (clampedX / SWEEP_PLOT_WIDTH) * (salarySweep.range.maxAnnualUSD - salarySweep.range.minAnnualUSD);
    sweepHoverIndex = getNearestSweepIndex(salarySweep.range, annualUSD);
  }

  function getSweepTooltipX(anchorX: number): number {
    const minX = SWEEP_CHART_INSET.left + 8;
    const maxX = SWEEP_CHART_WIDTH - SWEEP_CHART_INSET.right - SWEEP_TOOLTIP_WIDTH - 8;
    const preferred = anchorX + 10;
    return Math.max(minX, Math.min(maxX, preferred));
  }

  function formatSweepDelta(row: SweepHoverRow): string {
    if (row.isBaseline) return '0.0% (baseline)';
    return `${row.deltaPercent.toFixed(1)}%`;
  }

  $: if (salaryAmount < 0) {
    salaryAmount = 0;
  }

  $: {
    const bound = salaryBounds[inputCurrency];
    if (salaryAmount > bound.max) {
      salaryAmount = bound.max;
    }
  }

  $: if (!Number.isFinite(dependents)) {
    dependents = 0;
  } else {
    dependents = Math.max(0, Math.min(6, Math.round(dependents)));
  }

  $: if (!Number.isFinite(age)) {
    age = 30;
  } else {
    age = Math.max(18, Math.min(80, Math.round(age)));
  }

  $: residencyJP = clampResidencyMonth(residencyJP);
  $: residencySE = clampResidencyMonth(residencySE);
  $: residencyTH = clampResidencyMonth(residencyTH);
  $: residencyCH = clampResidencyMonth(residencyCH);
  $: residencyUK = clampResidencyMonth(residencyUK);
  $: residencyUSCA = clampResidencyMonth(residencyUSCA);
  $: residencyMY = clampResidencyMonth(residencyMY);
  $: residencySG = clampResidencyMonth(residencySG);
  $: residencyIN = clampResidencyMonth(residencyIN);

  $: isDarkTheme =
    themePreference === 'dark' || (themePreference === 'system' && systemPrefersDark);
  $: resolvedThemeLabel =
    themePreference === 'system'
      ? systemPrefersDark
        ? 'Dark (system)'
        : 'Light (system)'
      : isDarkTheme
        ? 'Dark'
        : 'Light';

  $: if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = isDarkTheme ? 'dark' : 'light';
  }

  $: fxUpdatedDisplay =
    fxUpdatedAt === 'manual-default'
      ? 'Default seed'
      : Number.isNaN(new Date(fxUpdatedAt).valueOf())
        ? fxUpdatedAt
        : new Date(fxUpdatedAt).toLocaleString();

  $: fxRates = {
    toJPY: {
      JPY: 1,
      SEK: fxSEKToJPY,
      THB: fxTHBToJPY,
      CHF: fxCHFToJPY,
      GBP: fxGBPToJPY,
      USD: fxUSDToJPY,
      MYR: fxMYRToJPY,
      SGD: fxSGDToJPY,
      INR: fxINRToJPY
    },
    updatedAt: fxUpdatedAt
  } satisfies FxRates;

  $: calculatorInput = {
    salaryAmount,
    salaryPeriod,
    inputCurrency,
    displayCurrency,
    married,
    spouseHasIncome,
    dependents,
    age,
    residencyMonths: {
      JP: residencyJP,
      SE: residencySE,
      TH: residencyTH,
      CH: residencyCH,
      UK: residencyUK,
      USCA: residencyUSCA,
      MY: residencyMY,
      SG: residencySG,
      IN: residencyIN
    }
  } satisfies CalculatorInput;

  $: comparison = compareAllCountries(calculatorInput, fxRates);

  $: displayCountries = comparison.countries.map((result): DisplayCountry => {
    const grossDisplay = convertCurrency(result.grossAnnualLocal, result.currency, displayCurrency, fxRates);
    const taxDisplay = convertCurrency(result.taxAnnualLocal, result.currency, displayCurrency, fxRates);
    const contribDisplay = convertCurrency(
      result.employeeContribAnnualLocal,
      result.currency,
      displayCurrency,
      fxRates
    );
    const netDisplay = convertCurrency(result.netAnnualLocal, result.currency, displayCurrency, fxRates);
    const netMonthlyDisplay = convertCurrency(result.netMonthlyLocal, result.currency, displayCurrency, fxRates);

    return {
      result,
      grossDisplay,
      taxDisplay,
      contribDisplay,
      netDisplay,
      netMonthlyDisplay,
      effectiveRateDisplay: `${(result.effectiveRate * 100).toFixed(1)}%`
    };
  });

  $: salarySweep = buildSalarySweep(
    calculatorInput,
    displayCurrency,
    fxRates,
    DEFAULT_SALARY_SWEEP_RANGE
  );

  $: visibleSweepSeries = salarySweep.series.filter((series) => !hiddenSweepCountries.includes(series.country));

  $: currentSalaryAnnualLocal = salaryPeriod === 'monthly' ? salaryAmount * 12 : salaryAmount;
  $: currentSalaryAnnualUSD = convertCurrency(currentSalaryAnnualLocal, inputCurrency, 'USD', fxRates);
  $: currentSalaryInRange =
    Number.isFinite(currentSalaryAnnualUSD) &&
    currentSalaryAnnualUSD >= salarySweep.range.minAnnualUSD &&
    currentSalaryAnnualUSD <= salarySweep.range.maxAnnualUSD;
  $: currentSalaryX = currentSalaryInRange ? getSweepX(currentSalaryAnnualUSD) : 0;
  $: currentSalaryAnnualDisplay = currentSalaryInRange
    ? convertCurrency(currentSalaryAnnualUSD, 'USD', displayCurrency, fxRates)
    : 0;
  $: currentSalaryMarkers = currentSalaryInRange
    ? visibleSweepSeries.flatMap((series) => {
        const y = getSweepYForSeries(series, currentSalaryAnnualUSD);
        return y === null ? [] : [{ country: series.country, x: currentSalaryX, y }];
      })
    : [];

  $: {
    const targetSeries = visibleSweepSeries.length > 0 ? visibleSweepSeries : salarySweep.series;
    const maxValue = Math.max(
      1,
      ...targetSeries.flatMap((series) => series.points.map((point) => point.netMonthlyDisplay))
    );
    const step = roundSweepStep(maxValue);
    const roundedMax = Math.ceil(maxValue / step) * step;

    sweepYDomainMax = Math.max(1, roundedMax);
    sweepYTicks = [];
    for (let value = 0; value <= sweepYDomainMax; value += step) {
      sweepYTicks.push(value);
    }
  }

  $: sweepXLabels = salarySweep.ticks.map((tick) => ({
    annualUSD: tick.annualUSD,
    annualDisplay: tick.annualDisplay,
    x: getSweepX(tick.annualUSD)
  }));

  $: {
    const maxIndex = salarySweep.series[0] ? salarySweep.series[0].points.length - 1 : null;
    if (sweepHoverIndex !== null && (maxIndex === null || sweepHoverIndex < 0 || sweepHoverIndex > maxIndex)) {
      sweepHoverIndex = null;
    }
  }

  $: {
    if (sweepHoverIndex === null || visibleSweepSeries.length === 0) {
      sweepHoverRows = [];
      sweepHoverMarkers = [];
      sweepHoverAnnualUSD = 0;
      sweepHoverAnnualDisplay = 0;
      sweepHoverBaselineCountry = null;
      sweepHoverX = SWEEP_CHART_INSET.left;
      sweepHoverTooltipX = SWEEP_CHART_INSET.left + 10;
      sweepHoverTooltipHeight = 64;
    } else {
      const summary = buildSweepHoverSummary(visibleSweepSeries, sweepHoverIndex);
      if (!summary) {
        sweepHoverRows = [];
        sweepHoverMarkers = [];
        sweepHoverBaselineCountry = null;
      } else {
        sweepHoverRows = summary.rows;
        sweepHoverAnnualUSD = summary.annualUSD;
        sweepHoverAnnualDisplay = summary.annualDisplay;
        sweepHoverBaselineCountry = summary.baselineCountry;
        sweepHoverX = getSweepX(summary.annualUSD);
        sweepHoverTooltipX = getSweepTooltipX(sweepHoverX);
        sweepHoverTooltipHeight = SWEEP_TOOLTIP_HEADER_HEIGHT + sweepHoverRows.length * SWEEP_TOOLTIP_ROW_HEIGHT;

        sweepHoverMarkers = visibleSweepSeries
          .map((series) => {
            const point = series.points[sweepHoverIndex as number];
            if (!point) return null;
            return {
              country: series.country,
              x: getSweepX(point.annualUSD),
              y: getSweepY(point.netMonthlyDisplay)
            };
          })
          .filter((marker): marker is SweepHoverMarker => marker !== null);
      }
    }
  }

  $: highestMonthlyNet = Math.max(1, ...displayCountries.map((item) => item.netMonthlyDisplay));

  $: if (loaded) {
    localStorage.setItem(
      INPUT_STORAGE_KEY,
      JSON.stringify({
        salaryAmount,
        salaryPeriod,
        inputCurrency,
        displayCurrency,
        married,
        spouseHasIncome,
        dependents,
        age,
        residencyMonths: {
          JP: residencyJP,
          SE: residencySE,
          TH: residencyTH,
          CH: residencyCH,
          UK: residencyUK,
          USCA: residencyUSCA,
          MY: residencyMY,
          SG: residencySG,
          IN: residencyIN
        }
      })
    );

    localStorage.setItem(
      FX_STORAGE_KEY,
      JSON.stringify({
        fxSEKToJPY,
        fxTHBToJPY,
        fxCHFToJPY,
        fxGBPToJPY,
        fxUSDToJPY,
        fxMYRToJPY,
        fxSGDToJPY,
        fxINRToJPY,
        fxUpdatedAt
      })
    );
  }

  onMount(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (event?: MediaQueryListEvent) => {
      systemPrefersDark = event ? event.matches : mediaQuery.matches;
    };

    handleSystemThemeChange();
    mediaQuery.addEventListener('change', handleSystemThemeChange);

    const savedThemeRaw = localStorage.getItem(THEME_STORAGE_KEY) ?? localStorage.getItem(THEME_STORAGE_KEY_V1);
    if (isThemePreference(savedThemeRaw)) {
      themePreference = savedThemeRaw;
    }

    const bootstrap = async () => {
      const inputRaw = localStorage.getItem(INPUT_STORAGE_KEY) ?? localStorage.getItem(INPUT_STORAGE_KEY_V1);
      if (inputRaw) {
        try {
          const parsed = JSON.parse(inputRaw) as Partial<{
            salaryAmount: number;
            salaryPeriod: SalaryPeriod;
            inputCurrency: Currency;
            displayCurrency: Currency;
            married: boolean;
            spouseHasIncome: boolean;
            dependents: number;
            age: number;
            residencyMonths: Partial<CalculatorInput['residencyMonths']>;
            residencyJP: number;
            residencySE: number;
            residencyTH: number;
            residencyCH: number;
            residencyUK: number;
            residencyUSCA: number;
          }>;

          if (typeof parsed.salaryAmount === 'number') salaryAmount = parsed.salaryAmount;
          if (parsed.salaryPeriod === 'annual' || parsed.salaryPeriod === 'monthly') {
            salaryPeriod = parsed.salaryPeriod;
          }
          if (isCurrency(parsed.inputCurrency)) inputCurrency = parsed.inputCurrency;
          if (isCurrency(parsed.displayCurrency)) displayCurrency = parsed.displayCurrency;
          if (typeof parsed.married === 'boolean') married = parsed.married;
          if (typeof parsed.spouseHasIncome === 'boolean') spouseHasIncome = parsed.spouseHasIncome;
          if (typeof parsed.dependents === 'number') dependents = parsed.dependents;
          if (typeof parsed.age === 'number') age = parsed.age;

          if (parsed.residencyMonths) {
            if (typeof parsed.residencyMonths.JP === 'number') residencyJP = parsed.residencyMonths.JP;
            if (typeof parsed.residencyMonths.SE === 'number') residencySE = parsed.residencyMonths.SE;
            if (typeof parsed.residencyMonths.TH === 'number') residencyTH = parsed.residencyMonths.TH;
            if (typeof parsed.residencyMonths.CH === 'number') residencyCH = parsed.residencyMonths.CH;
            if (typeof parsed.residencyMonths.UK === 'number') residencyUK = parsed.residencyMonths.UK;
            if (typeof parsed.residencyMonths.USCA === 'number') residencyUSCA = parsed.residencyMonths.USCA;
            if (typeof parsed.residencyMonths.MY === 'number') residencyMY = parsed.residencyMonths.MY;
            if (typeof parsed.residencyMonths.SG === 'number') residencySG = parsed.residencyMonths.SG;
            if (typeof parsed.residencyMonths.IN === 'number') residencyIN = parsed.residencyMonths.IN;
          } else {
            if (typeof parsed.residencyJP === 'number') residencyJP = parsed.residencyJP;
            if (typeof parsed.residencySE === 'number') residencySE = parsed.residencySE;
            if (typeof parsed.residencyTH === 'number') residencyTH = parsed.residencyTH;
            if (typeof parsed.residencyCH === 'number') residencyCH = parsed.residencyCH;
            if (typeof parsed.residencyUK === 'number') residencyUK = parsed.residencyUK;
            if (typeof parsed.residencyUSCA === 'number') residencyUSCA = parsed.residencyUSCA;
          }
        } catch {
          // Ignore invalid persisted payload.
        }
      }

      const fxRaw = localStorage.getItem(FX_STORAGE_KEY) ?? localStorage.getItem(FX_STORAGE_KEY_V1);
      if (fxRaw) {
        try {
          const parsed = JSON.parse(fxRaw) as Partial<{
            fxSEKToJPY: number;
            fxTHBToJPY: number;
            fxCHFToJPY: number;
            fxGBPToJPY: number;
            fxUSDToJPY: number;
            fxMYRToJPY: number;
            fxSGDToJPY: number;
            fxINRToJPY: number;
            fxUpdatedAt: string;
          }>;

          let hasSavedFx = false;

          if (typeof parsed.fxSEKToJPY === 'number' && parsed.fxSEKToJPY > 0) {
            fxSEKToJPY = parsed.fxSEKToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxTHBToJPY === 'number' && parsed.fxTHBToJPY > 0) {
            fxTHBToJPY = parsed.fxTHBToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxCHFToJPY === 'number' && parsed.fxCHFToJPY > 0) {
            fxCHFToJPY = parsed.fxCHFToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxGBPToJPY === 'number' && parsed.fxGBPToJPY > 0) {
            fxGBPToJPY = parsed.fxGBPToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxUSDToJPY === 'number' && parsed.fxUSDToJPY > 0) {
            fxUSDToJPY = parsed.fxUSDToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxMYRToJPY === 'number' && parsed.fxMYRToJPY > 0) {
            fxMYRToJPY = parsed.fxMYRToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxSGDToJPY === 'number' && parsed.fxSGDToJPY > 0) {
            fxSGDToJPY = parsed.fxSGDToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxINRToJPY === 'number' && parsed.fxINRToJPY > 0) {
            fxINRToJPY = parsed.fxINRToJPY;
            hasSavedFx = true;
          }
          if (typeof parsed.fxUpdatedAt === 'string' && parsed.fxUpdatedAt.length > 0) {
            fxUpdatedAt = parsed.fxUpdatedAt;
          }

          if (hasSavedFx) {
            fxSource = 'saved';
          }
        } catch {
          // Ignore invalid persisted payload.
        }
      }

      try {
        const liveRates = await fetchLiveFxRatesToJPY();
        fxSEKToJPY = liveRates.toJPY.SEK;
        fxTHBToJPY = liveRates.toJPY.THB;
        fxCHFToJPY = liveRates.toJPY.CHF;
        fxGBPToJPY = liveRates.toJPY.GBP;
        fxUSDToJPY = liveRates.toJPY.USD;
        fxMYRToJPY = liveRates.toJPY.MYR;
        fxSGDToJPY = liveRates.toJPY.SGD;
        fxINRToJPY = liveRates.toJPY.INR;
        fxUpdatedAt = liveRates.updatedAt;
        fxSource = 'live';
      } catch {
        // Keep saved/default rates if live lookup fails.
      }

      loaded = true;
    };

    void bootstrap();

    return () => {
      mediaQuery.removeEventListener('change', handleSystemThemeChange);
    };
  });
</script>

<svelte:head>
  <title>Take-Home Comparator (JP/SE/TH/CH/UK/USCA/MY/SG/IN)</title>
  <meta
    name="description"
    content="Employment-focused take-home comparison across nine jurisdictions with adjustable residency assumptions and FX."
  />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main class="app-shell">
  <header class="hero">
    <div>
      <p class="eyebrow">Employment Tax Comparator</p>
      <h1>Nine-country take-home view</h1>
      <p class="muted">
        Compare one salary profile across Japan, Sweden, Thailand, Switzerland, UK, USA (California),
        Malaysia, Singapore, and India.
      </p>
    </div>

    <div class="hero-meta">
      <p><span>FX source</span><strong>{fxSource}</strong></p>
      <p><span>FX updated</span><strong>{fxUpdatedDisplay}</strong></p>
      <p><span>Display currency</span><strong>{displayCurrency}</strong></p>
    </div>
  </header>

  <section class="panel currency-rail" aria-label="Display currency selector">
    <div class="section-head">
      <h2>Display Currency</h2>
      <p class="muted">Used across cards and charts</p>
    </div>
    <div class="currency-options">
      {#each ALL_CURRENCIES as currency}
        <button
          type="button"
          class="currency-chip"
          class:active={displayCurrency === currency}
          on:click={() => (displayCurrency = currency)}>{currency}</button
        >
      {/each}
    </div>
  </section>

  <div class="workspace">
    <section class="panel controls">
      <h2>Salary Profile</h2>
      <p class="muted">Set your primary scenario first. Advanced controls are below.</p>

      <div class="grid two">
        <label>
          <span>Salary amount</span>
          <input type="number" min="0" bind:value={salaryAmount} step={salaryBounds[inputCurrency].step} />
        </label>

        <label>
          <span>Input currency</span>
          <select bind:value={inputCurrency}>
            {#each ALL_CURRENCIES as currency}
              <option value={currency}>{currency}</option>
            {/each}
          </select>
        </label>
      </div>

      <label>
        <span>Salary slider</span>
        <input
          type="range"
          min="0"
          max={salaryBounds[inputCurrency].max}
          step={salaryBounds[inputCurrency].step}
          bind:value={salaryAmount}
        />
      </label>

      <div class="grid">
        <label>
          <span>Salary period</span>
          <select bind:value={salaryPeriod}>
            <option value="annual">Annual</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
      </div>

      <div class="grid two toggles">
        <label class="toggle">
          <input type="checkbox" bind:checked={married} />
          <span>Married</span>
        </label>
        <label class="toggle">
          <input type="checkbox" bind:checked={spouseHasIncome} disabled={!married} />
          <span>Spouse has income</span>
        </label>
      </div>

      <div class="grid two">
        <label>
          <span>Dependents: {dependents}</span>
          <input type="range" min="0" max="6" step="1" bind:value={dependents} />
        </label>

        <label>
          <span>Age: {age}</span>
          <input type="range" min="18" max="80" step="1" bind:value={age} />
        </label>
      </div>

      <details class="advanced">
        <summary>Advanced Controls</summary>

        <div class="advanced-body">
          <section>
            <h3>Residency months (0-12)</h3>
            <p class="muted">Proxy residency inputs for each jurisdiction.</p>

            <div class="residency-grid">
              <label><span>JP</span><input type="number" min="0" max="12" step="1" bind:value={residencyJP} /></label>
              <label><span>SE</span><input type="number" min="0" max="12" step="1" bind:value={residencySE} /></label>
              <label><span>TH</span><input type="number" min="0" max="12" step="1" bind:value={residencyTH} /></label>
              <label><span>CH</span><input type="number" min="0" max="12" step="1" bind:value={residencyCH} /></label>
              <label><span>UK</span><input type="number" min="0" max="12" step="1" bind:value={residencyUK} /></label>
              <label><span>US-CA</span><input type="number" min="0" max="12" step="1" bind:value={residencyUSCA} /></label>
              <label><span>MY</span><input type="number" min="0" max="12" step="1" bind:value={residencyMY} /></label>
              <label><span>SG</span><input type="number" min="0" max="12" step="1" bind:value={residencySG} /></label>
              <label><span>IN</span><input type="number" min="0" max="12" step="1" bind:value={residencyIN} /></label>
            </div>
          </section>

          <section>
            <h3>Manual FX to JPY</h3>
            <p class="muted">Override live rates for scenario testing.</p>

            <div class="fx-grid">
              {#each FX_EDITABLE_CURRENCIES as c}
                <label>
                  <span>1 {c} = JPY</span>

                  {#if c === 'SEK'}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxSEKToJPY} on:input={markFxAsManualSave} />
                  {:else if c === 'THB'}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxTHBToJPY} on:input={markFxAsManualSave} />
                  {:else if c === 'CHF'}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxCHFToJPY} on:input={markFxAsManualSave} />
                  {:else if c === 'GBP'}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxGBPToJPY} on:input={markFxAsManualSave} />
                  {:else if c === 'USD'}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxUSDToJPY} on:input={markFxAsManualSave} />
                  {:else if c === 'MYR'}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxMYRToJPY} on:input={markFxAsManualSave} />
                  {:else if c === 'SGD'}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxSGDToJPY} on:input={markFxAsManualSave} />
                  {:else}
                    <input type="number" min="0.0001" step="0.0001" bind:value={fxINRToJPY} on:input={markFxAsManualSave} />
                  {/if}
                </label>
              {/each}
            </div>
          </section>

          <section>
            <h3>Display currency (fallback)</h3>
            <p class="muted">Primary selector is above in the currency rail.</p>
            <label>
              <span>Display currency</span>
              <select bind:value={displayCurrency}>
                {#each ALL_CURRENCIES as currency}
                  <option value={currency}>{currency}</option>
                {/each}
              </select>
            </label>
          </section>

          <section>
            <h3>Theme</h3>
            <div class="theme-switch" role="group" aria-label="Theme mode">
              <button
                type="button"
                class:active={!isDarkTheme && themePreference !== 'system'}
                on:click={() => setThemePreference('light')}>Light</button
              >
              <button
                type="button"
                class:active={isDarkTheme && themePreference !== 'system'}
                on:click={() => setThemePreference('dark')}>Dark</button
              >
              <button
                type="button"
                class:active={themePreference === 'system'}
                on:click={() => setThemePreference('system')}>System</button
              >
            </div>
            <p class="muted">Current: {resolvedThemeLabel}</p>
          </section>
        </div>
      </details>
    </section>

    <section class="results">
      <section class="panel sweep-panel">
        <div class="section-head">
          <h2>Monthly Take-home vs Annual Compensation</h2>
          <p class="muted">
            Fixed annual range: {formatMoney(DEFAULT_SALARY_SWEEP_RANGE.minAnnualUSD, 'USD')} to
            {formatMoney(DEFAULT_SALARY_SWEEP_RANGE.maxAnnualUSD, 'USD')}
          </p>
        </div>
        <p class="muted">
          Y-axis shows monthly take-home in {displayCurrency}. X-axis values are annual compensation
          shown in {displayCurrency}, with USD-equivalent labels under each tick. Hover a point to
          compare visible countries against the highest monthly take-home at that level.
        </p>

        <div class="sweep-chart-shell">
          <div class="sweep-scroll">
            <svg
              class="sweep-chart"
              viewBox={`0 0 ${SWEEP_CHART_WIDTH} ${SWEEP_CHART_HEIGHT}`}
              role="img"
              aria-label="Monthly take-home versus annual compensation line chart"
            >
              <g class="sweep-grid">
                {#each sweepYTicks as yTick}
                  <line
                    x1={SWEEP_CHART_INSET.left}
                    x2={SWEEP_CHART_WIDTH - SWEEP_CHART_INSET.right}
                    y1={getSweepY(yTick)}
                    y2={getSweepY(yTick)}
                  />
                  <text class="sweep-y-label" x={SWEEP_CHART_INSET.left - 8} y={getSweepY(yTick)} text-anchor="end">
                    {formatMoney(yTick, displayCurrency)}
                  </text>
                {/each}
              </g>

              <line
                class="sweep-axis"
                x1={SWEEP_CHART_INSET.left}
                y1={SWEEP_CHART_INSET.top}
                x2={SWEEP_CHART_INSET.left}
                y2={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom}
              />
              <line
                class="sweep-axis"
                x1={SWEEP_CHART_INSET.left}
                y1={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom}
                x2={SWEEP_CHART_WIDTH - SWEEP_CHART_INSET.right}
                y2={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom}
              />

              {#each sweepXLabels as xTick}
                <line
                  class="sweep-tick"
                  x1={xTick.x}
                  x2={xTick.x}
                  y1={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom}
                  y2={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom + 6}
                />
                <text
                  class="sweep-x-label"
                  x={xTick.x}
                  y={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom + 18}
                  text-anchor="middle"
                >
                  {formatMoney(xTick.annualDisplay, displayCurrency)}
                </text>
                <text
                  class="sweep-x-sub-label"
                  x={xTick.x}
                  y={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom + 33}
                  text-anchor="middle"
                >
                  {formatMoney(xTick.annualUSD, 'USD')}
                </text>
              {/each}

              <text
                class="sweep-axis-title"
                x={(SWEEP_CHART_INSET.left + SWEEP_CHART_WIDTH - SWEEP_CHART_INSET.right) / 2}
                y={SWEEP_CHART_HEIGHT - 6}
                text-anchor="middle"
              >
                Annual compensation ({displayCurrency})
              </text>

              <text
                class="sweep-axis-title"
                x={30}
                y={(SWEEP_CHART_INSET.top + SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom) / 2}
                transform={`rotate(-90 30 ${(SWEEP_CHART_INSET.top + SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom) / 2})`}
                text-anchor="middle"
              >
                Monthly take-home ({displayCurrency})
              </text>

              {#if visibleSweepSeries.length === 0}
                <text class="sweep-empty" x={SWEEP_CHART_WIDTH / 2} y={SWEEP_CHART_HEIGHT / 2} text-anchor="middle">
                  Enable at least one country in the legend.
                </text>
              {:else}
                {#each visibleSweepSeries as series}
                  <path
                    class="sweep-series"
                    d={createSweepPath(series)}
                    style={`stroke:${countrySeriesColors[series.country]}`}
                  />
                {/each}

                {#if currentSalaryInRange}
                  <line
                    class="sweep-salary-line"
                    x1={currentSalaryX}
                    x2={currentSalaryX}
                    y1={SWEEP_CHART_INSET.top}
                    y2={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom}
                  />
                  {#each currentSalaryMarkers as marker}
                    <circle
                      class="sweep-salary-marker"
                      cx={marker.x}
                      cy={marker.y}
                      r="4.2"
                      style={`stroke:${countrySeriesColors[marker.country]}`}
                    />
                  {/each}
                  <text
                    class="sweep-salary-label"
                    x={currentSalaryX}
                    y={SWEEP_CHART_INSET.top - 4}
                    text-anchor="middle"
                  >
                    You · {formatMoney(currentSalaryAnnualDisplay, displayCurrency)}
                  </text>
                {/if}

                <rect
                  class="sweep-hitbox"
                  role="presentation"
                  aria-hidden="true"
                  x={SWEEP_CHART_INSET.left}
                  y={SWEEP_CHART_INSET.top}
                  width={SWEEP_PLOT_WIDTH}
                  height={SWEEP_PLOT_HEIGHT}
                  on:pointermove={handleSweepPointerMove}
                  on:pointerleave={resetSweepHover}
                />

                {#if sweepHoverRows.length > 0}
                  <line
                    class="sweep-crosshair"
                    x1={sweepHoverX}
                    x2={sweepHoverX}
                    y1={SWEEP_CHART_INSET.top}
                    y2={SWEEP_CHART_HEIGHT - SWEEP_CHART_INSET.bottom}
                  />

                  {#each sweepHoverMarkers as marker}
                    <circle
                      class="sweep-marker"
                      cx={marker.x}
                      cy={marker.y}
                      r="3.6"
                      style={`fill:${countrySeriesColors[marker.country]}`}
                    />
                  {/each}

                  <g class="sweep-tooltip" transform={`translate(${sweepHoverTooltipX} ${SWEEP_CHART_INSET.top + 8})`}>
                    <rect class="sweep-tooltip-bg" width={SWEEP_TOOLTIP_WIDTH} height={sweepHoverTooltipHeight} rx="10" ry="10" />
                    <text class="sweep-tooltip-title" x="12" y="18">
                      {formatMoney(sweepHoverAnnualDisplay, displayCurrency)} ({formatMoney(sweepHoverAnnualUSD, 'USD')})
                    </text>
                    {#if sweepHoverBaselineCountry}
                      <text class="sweep-tooltip-subtitle" x="12" y="34">
                        Baseline: {countryNames[sweepHoverBaselineCountry]}
                      </text>
                    {/if}

                    {#each sweepHoverRows as row, index}
                      <circle
                        class="sweep-tooltip-dot"
                        cx="12"
                        cy={49 + index * SWEEP_TOOLTIP_ROW_HEIGHT}
                        r="3.2"
                        style={`fill:${countrySeriesColors[row.country]}`}
                      />
                      <text
                        class="sweep-tooltip-country"
                        class:sweep-tooltip-country-base={row.isBaseline}
                        x="21"
                        y={51 + index * SWEEP_TOOLTIP_ROW_HEIGHT}
                      >
                        {countryNames[row.country]}
                      </text>
                      <text
                        class="sweep-tooltip-value"
                        x="208"
                        y={51 + index * SWEEP_TOOLTIP_ROW_HEIGHT}
                        text-anchor="end"
                      >
                        {formatMoney(row.monthlyValue, displayCurrency)}
                      </text>
                      <text
                        class="sweep-tooltip-delta"
                        x="288"
                        y={51 + index * SWEEP_TOOLTIP_ROW_HEIGHT}
                        text-anchor="end"
                      >
                        {formatSweepDelta(row)}
                      </text>
                    {/each}
                  </g>
                {/if}
              {/if}
            </svg>
          </div>
        </div>

        <div class="sweep-legend" role="group" aria-label="Country lines">
          {#each salarySweep.series as series}
            <button
              type="button"
              class="legend-item"
              class:is-hidden={isSweepCountryHidden(series.country)}
              on:click={() => toggleSweepCountry(series.country)}
            >
              <span class="legend-dot" style={`background:${countrySeriesColors[series.country]}`}></span>
              <span>{countryNames[series.country]}</span>
            </button>
          {/each}

          {#if hiddenSweepCountries.length > 0}
            <button type="button" class="legend-reset" on:click={resetSweepCountries}>Show all countries</button>
          {/if}
        </div>
      </section>

      <section class="panel">
        <div class="section-head">
          <h2>Monthly Take-home ({displayCurrency})</h2>
          <p class="muted">All countries shown</p>
        </div>

        <ul class="chart-list">
          {#each [...displayCountries].sort((a, b) => b.netMonthlyDisplay - a.netMonthlyDisplay) as item}
            <li>
              <div class="row-head">
                <span>{countryNames[item.result.country]}</span>
                <strong>{formatMoney(item.netMonthlyDisplay, displayCurrency)}</strong>
              </div>
              <div class="row-track">
                <i style={`width:${(item.netMonthlyDisplay / highestMonthlyNet) * 100}%`}></i>
              </div>
            </li>
          {/each}
        </ul>
      </section>

      {#if colSavingsData.slices.length > 0}
        <section class="panel col-savings-panel">
          <div class="section-head">
            <h2>Savings after essentials ({displayCurrency})</h2>
            <p class="muted">Monthly surplus after rent, utilities, groceries and consumables — {colHouseholdType} household, {COL_VERSION} estimates. The % after each amount is how much of that country's take-home pay is left after essentials.</p>
          </div>
          <svg viewBox="0 0 640 260" class="col-pie-shell" role="img" aria-label="Savings donut chart">
            <!-- slices -->
            <g>
              {#each colSavingsData.slices as slice}
                <path
                  class="col-pie-slice"
                  d={slice.path}
                  fill={slice.color}
                  stroke="var(--panel)"
                  stroke-width="2.5"
                  opacity={hoveredSavingsCountry && hoveredSavingsCountry !== slice.country ? 0.25 : 1}
                  on:mouseenter={() => (hoveredSavingsCountry = slice.country)}
                  on:mouseleave={() => (hoveredSavingsCountry = null)}
                />
              {/each}
            </g>
            <!-- center hover label -->
            {#if hoveredSavingsCountry}
              {@const hs = colSavingsData.slices.find((s) => s.country === hoveredSavingsCountry)}
              {#if hs}
                <text x="130" y="118" text-anchor="middle" font-size="11" fill="var(--ink-soft)" font-family="var(--font-body)">{hs.name}</text>
                <text x="130" y="134" text-anchor="middle" font-size="13" fill="var(--ink)" font-family="var(--font-body)" font-weight="700">{formatMoney(hs.amountDisplay, displayCurrency)}</text>
                <text x="130" y="150" text-anchor="middle" font-size="11" fill="var(--ink-soft)" font-family="var(--font-body)">saves {hs.pctOfTakeHome}%</text>
              {/if}
            {/if}
            <!-- legend -->
            <g>
              {#each colSavingsData.slices as slice, i}
                {@const legendY = 16 + i * 24}
                {@const dimmed = hoveredSavingsCountry && hoveredSavingsCountry !== slice.country}
                <g
                  class="col-savings-legend-row"
                  opacity={dimmed ? 0.3 : 1}
                >
                  <rect x="275" y={legendY} width="10" height="10" fill={slice.color} rx="2" />
                  <text x="291" y={legendY + 9} font-size="12" fill="var(--ink)" font-family="var(--font-body)" font-weight={hoveredSavingsCountry === slice.country ? '700' : '400'}>{slice.name}</text>
                  <text x="500" y={legendY + 9} font-size="12" fill="var(--ink)" font-family="var(--font-body)" font-weight="600" text-anchor="end">{formatMoney(slice.amountDisplay, displayCurrency)}</text>
                  <text x="505" y={legendY + 9} font-size="11" fill="var(--ink-soft)" font-family="var(--font-body)">{slice.pctOfTotal}% · saves {slice.pctOfTakeHome}%</text>
                </g>
              {/each}
              {#if colSavingsData.deficits.length > 0}
                {@const deficitY = 16 + colSavingsData.slices.length * 24 + 8}
                <line x1="275" y1={deficitY} x2="620" y2={deficitY} stroke="var(--line)" stroke-width="1" />
                {#each colSavingsData.deficits as d, i}
                  {@const dy = deficitY + 12 + i * 22}
                  <g class="col-savings-legend-row" opacity={hoveredSavingsCountry && hoveredSavingsCountry !== d.country ? 0.3 : 1}>
                    <rect x="275" y={dy} width="10" height="10" fill="var(--line)" rx="2" />
                    <text x="291" y={dy + 9} font-size="12" fill="var(--ink-soft)" font-family="var(--font-body)">{d.name}</text>
                    <text x="500" y={dy + 9} font-size="12" fill="#c0392b" font-family="var(--font-body)" font-weight="600" text-anchor="end">{formatMoney(d.amountDisplay, displayCurrency)}</text>
                    <text x="505" y={dy + 9} font-size="11" fill="var(--ink-soft)" font-family="var(--font-body)">deficit</text>
                  </g>
                {/each}
              {/if}
            </g>
          </svg>
        </section>
      {/if}

      <section class="country-list">
        {#each displayCountries as item, index}
          <article class="panel country" style={`--delay:${index * 40}ms`}>
            <header class="country-head">
              <div>
                <h3>{countryNames[item.result.country]}</h3>
                <p class="muted">{item.result.residencyStatus}</p>
              </div>
              <span class="chip">{item.result.currency}</span>
            </header>

            <div class="metric-grid">
              <div>
                <span>Take-home monthly</span>
                <strong>{formatMoney(item.netMonthlyDisplay, displayCurrency)}</strong>
              </div>
              <div>
                <span>Take-home annual</span>
                <strong>{formatMoney(item.netDisplay, displayCurrency)}</strong>
              </div>
              <div>
                <span>Total tax</span>
                <strong>{formatMoney(item.taxDisplay, displayCurrency)}</strong>
              </div>
              <div>
                <span>Employee contributions</span>
                <strong>{formatMoney(item.contribDisplay, displayCurrency)}</strong>
              </div>
              <div>
                <span>Gross annual</span>
                <strong>{formatMoney(item.grossDisplay, displayCurrency)}</strong>
              </div>
              <div>
                <span>Effective rate</span>
                <strong>{item.effectiveRateDisplay}</strong>
              </div>
            </div>

            {#if colData[item.result.country]}
              {@const col = colData[item.result.country]}
              {@const afterEssentials = item.result.netMonthlyLocal - col.total}
              {@const afterEssentialsDisplay = convertCurrency(afterEssentials, item.result.currency, displayCurrency, fxRates)}
              {@const afterEssentialsPct = item.result.netMonthlyLocal > 0 ? Math.round((afterEssentials / item.result.netMonthlyLocal) * 100) : 0}
              <section class="col-section">
                <div class="col-header">
                  <span class="col-label">Est. cost of living</span>
                  <div class="col-city-pills">
                    {#each col.cities as c}
                      <button
                        class="col-city-pill"
                        class:active={col.cityId === c.id}
                        on:click={() => (selectedColCity = { ...selectedColCity, [item.result.country]: c.id })}
                      >{c.name}</button>
                    {/each}
                  </div>
                </div>
                <p class="col-neighbourhoods muted">{col.city.neighbourhoods.join(' · ')}</p>
                <div class="col-breakdown">
                  <div><span>Rent <span class="col-br-tag">{HOUSEHOLD_BEDROOMS[colHouseholdType]}</span></span><strong>{formatMoney(col.costs.rent, item.result.currency)}</strong></div>
                  <div><span>Utilities</span><strong>{formatMoney(col.costs.utilities, item.result.currency)}</strong></div>
                  <div><span>Groceries</span><strong>{formatMoney(col.costs.groceries, item.result.currency)}</strong></div>
                  <div><span>Consumables</span><strong>{formatMoney(col.costs.consumables, item.result.currency)}</strong></div>
                </div>
                <div class="col-after">
                  <div>
                    <span>After essentials</span>
                    <span class="col-version muted">{COL_VERSION} · {col.city.neighbourhoods.join(', ')}</span>
                  </div>
                  <strong class:col-negative={afterEssentials < 0}>
                    {formatMoney(afterEssentialsDisplay, displayCurrency)}/mo
                    <span class="col-after-sub">({#if displayCurrency !== item.result.currency}{formatMoney(afterEssentials, item.result.currency)} · {/if}{afterEssentialsPct}%)</span>
                  </strong>
                </div>
              </section>
            {/if}

            <details class="fold">
              <summary>Calculation details</summary>
              <ul>
                {#each item.result.breakdown as b}
                  <li>
                    <span>{b.label}</span>
                    <strong>{formatMoney(convertCurrency(b.amount, item.result.currency, displayCurrency, fxRates), displayCurrency)}</strong>
                  </li>
                {/each}
              </ul>
            </details>

            <details class="fold">
              <summary>Assumptions</summary>
              <ul>
                {#each item.result.assumptions as assumption}
                  <li>{assumption}</li>
                {/each}
              </ul>
            </details>
          </article>
        {/each}
      </section>
    </section>
  </div>

  <details class="panel sources">
    <summary>Method and Sources</summary>
    <div class="sources-body">
      <p class="muted">
        Models are derived from repository specs for JP/SE/TH/CH/UK/USCA/MY/SG/IN and provide planning
        estimates, not filing advice.
      </p>

      <div class="source-list">
        {#each COUNTRY_RULES as rule}
          <article class="source-row">
            <h3>{rule.countryName}</h3>
            <p><strong>Effective year:</strong> {rule.effectiveTaxYear}</p>
            <p><strong>Scope:</strong> {rule.jurisdiction}</p>
            <ul>
              {#each rule.sources as source}
                <li><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a></li>
              {/each}
            </ul>
          </article>
        {/each}
      </div>
    </div>
  </details>
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  :global(:root) {
    color-scheme: light;
    --font-body: 'Manrope', 'Avenir Next', 'Segoe UI', sans-serif;
    --font-display: 'Sora', 'Manrope', 'Avenir Next', 'Segoe UI', sans-serif;
    --ink: #172129;
    --ink-soft: #445564;
    --line: #c9d4df;
    --panel: rgba(255, 255, 255, 0.88);
    --field-bg: rgba(255, 255, 255, 0.96);
    --field-border: #b8c9d8;
    --focus-ring: rgba(88, 146, 194, 0.22);
    --accent: #0d7a77;
    --accent-soft: #49a79f;
    --chip-bg: #f2f7fc;
    --chip-border: #bfd0df;
    --body-bg:
      radial-gradient(circle at 8% -2%, rgba(184, 227, 225, 0.5), transparent 34%),
      radial-gradient(circle at 100% 0%, rgba(245, 216, 188, 0.45), transparent 40%),
      linear-gradient(180deg, #f4f7fb 0%, #edf1f7 58%, #e8edf5 100%);
    --link: #125a81;
  }

  :global(:root[data-theme='dark']) {
    color-scheme: dark;
    --ink: #e3edf6;
    --ink-soft: #98aebf;
    --line: #2f3f4c;
    --panel: rgba(19, 29, 38, 0.9);
    --field-bg: rgba(14, 22, 30, 0.95);
    --field-border: #3f5568;
    --focus-ring: rgba(93, 153, 198, 0.28);
    --accent: #41b6ac;
    --accent-soft: #6bcfc0;
    --chip-bg: #1d2b37;
    --chip-border: #3d5569;
    --body-bg:
      radial-gradient(circle at 8% -5%, rgba(29, 88, 92, 0.45), transparent 36%),
      radial-gradient(circle at 100% 0%, rgba(86, 61, 43, 0.35), transparent 44%),
      linear-gradient(180deg, #111821 0%, #141e29 56%, #0f1720 100%);
    --link: #90d3f5;
  }

  :global(body) {
    margin: 0;
    font-family: var(--font-body);
    color: var(--ink);
    background: var(--body-bg);
    transition: background 200ms ease, color 200ms ease;
  }

  .app-shell {
    max-width: 1320px;
    margin: 0 auto;
    padding: 1rem;
    display: grid;
    gap: 0.95rem;
  }

  .hero {
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--panel);
    padding: 1rem 1.1rem;
    display: grid;
    grid-template-columns: 1.5fr 1fr;
    gap: 1rem;
    animation: rise-in 420ms ease both;
  }

  .eyebrow {
    margin: 0;
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
    font-weight: 700;
  }

  h1 {
    font-family: var(--font-display);
    margin: 0.1rem 0;
    font-size: clamp(1.34rem, 2.2vw, 1.95rem);
    line-height: 1.14;
  }

  h2,
  h3 {
    font-family: var(--font-display);
    margin: 0;
  }

  h2 {
    font-size: 1.03rem;
  }

  h3 {
    font-size: 0.95rem;
  }

  p {
    margin: 0.2rem 0;
  }

  .muted {
    color: var(--ink-soft);
    font-size: 0.88rem;
  }

  .hero-meta {
    border-left: 1px solid var(--line);
    padding-left: 0.9rem;
    display: grid;
    align-content: center;
    gap: 0.28rem;
  }

  .hero-meta p {
    margin: 0;
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    font-size: 0.84rem;
  }

  .hero-meta span {
    color: var(--ink-soft);
  }

  .currency-rail {
    display: grid;
    gap: 0.6rem;
    padding: 0.78rem 0.9rem;
  }

  .currency-options {
    display: flex;
    flex-wrap: wrap;
    gap: 0.48rem;
  }

  .currency-chip {
    appearance: none;
    border: 1px solid var(--chip-border);
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--ink);
    padding: 0.3rem 0.74rem;
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 140ms ease, color 140ms ease, background 140ms ease;
  }

  .currency-chip.active {
    border-color: var(--accent);
    background: color-mix(in srgb, var(--accent) 14%, var(--chip-bg));
    color: var(--accent);
  }

  .currency-chip:hover {
    border-color: var(--accent-soft);
  }

  .workspace {
    display: grid;
    grid-template-columns: minmax(330px, 390px) minmax(0, 1fr);
    gap: 0.9rem;
    align-items: start;
  }

  .panel {
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--panel);
    backdrop-filter: blur(8px);
    padding: 0.9rem;
    animation: rise-in 460ms ease both;
  }

  .controls {
    position: sticky;
    top: 0.8rem;
    display: grid;
    gap: 0.75rem;
  }

  .grid {
    display: grid;
    gap: 0.62rem;
  }

  .grid.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  label {
    display: grid;
    gap: 0.3rem;
    min-width: 0;
    color: var(--ink-soft);
    font-size: 0.86rem;
  }

  input,
  select {
    width: 100%;
    min-width: 0;
    border: 1px solid var(--field-border);
    background: var(--field-bg);
    color: var(--ink);
    border-radius: 9px;
    padding: 0.45rem 0.55rem;
    font-size: 0.92rem;
  }

  input:focus,
  select:focus {
    outline: 2px solid var(--focus-ring);
    border-color: var(--accent);
    outline-offset: 1px;
  }

  input[type='range'] {
    padding: 0;
    accent-color: var(--accent);
  }

  .toggle {
    grid-template-columns: auto 1fr;
    align-items: center;
    gap: 0.5rem;
    color: var(--ink);
  }

  .toggle input {
    width: 17px;
    height: 17px;
    margin: 0;
  }

  .advanced {
    border: 1px solid var(--line);
    border-radius: 11px;
    padding: 0.58rem 0.62rem;
    background: color-mix(in srgb, var(--panel) 86%, transparent);
  }

  .advanced > summary {
    cursor: pointer;
    font-size: 0.87rem;
    font-weight: 700;
  }

  .advanced-body {
    margin-top: 0.7rem;
    display: grid;
    gap: 0.85rem;
  }

  .advanced-body section {
    border-top: 1px solid var(--line);
    padding-top: 0.65rem;
    display: grid;
    gap: 0.45rem;
  }

  .advanced-body section:first-child {
    border-top: 0;
    padding-top: 0;
  }

  .residency-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .fx-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.52rem;
  }

  .theme-switch {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.38rem;
  }

  .theme-switch button {
    appearance: none;
    border: 1px solid var(--chip-border);
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--ink);
    padding: 0.2rem 0.58rem;
    font-size: 0.79rem;
    cursor: pointer;
  }

  .theme-switch button.active {
    border-color: var(--accent);
    color: var(--accent);
    font-weight: 700;
  }

  .results {
    display: grid;
    gap: 0.8rem;
  }

  .section-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.8rem;
    flex-wrap: wrap;
  }

  .sweep-panel {
    display: grid;
    gap: 0.65rem;
  }

  .sweep-chart-shell {
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 0.44rem 0.56rem;
    background: color-mix(in srgb, var(--panel) 90%, transparent);
  }

  .sweep-scroll {
    overflow-x: auto;
    padding-bottom: 0.2rem;
  }

  .sweep-chart {
    display: block;
    width: 100%;
    min-width: 760px;
    max-height: 390px;
  }

  .sweep-grid line {
    stroke: color-mix(in srgb, var(--line) 72%, transparent);
    stroke-width: 1;
  }

  .sweep-axis {
    stroke: var(--line);
    stroke-width: 1.4;
  }

  .sweep-tick {
    stroke: var(--line);
    stroke-width: 1.2;
  }

  .sweep-y-label,
  .sweep-x-label,
  .sweep-x-sub-label,
  .sweep-axis-title,
  .sweep-empty {
    fill: var(--ink-soft);
    dominant-baseline: middle;
  }

  .sweep-y-label {
    font-size: 11.8px;
  }

  .sweep-x-label {
    font-size: 12px;
  }

  .sweep-x-sub-label {
    font-size: 10.6px;
  }

  .sweep-axis-title {
    fill: var(--ink);
    font-size: 12.2px;
    font-weight: 600;
  }

  .sweep-empty {
    font-size: 12.5px;
  }

  .sweep-series {
    fill: none;
    stroke-width: 2.4;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
    pointer-events: none;
  }

  .sweep-hitbox {
    fill: transparent;
    cursor: crosshair;
  }

  .sweep-crosshair {
    stroke: color-mix(in srgb, var(--accent) 70%, var(--ink-soft));
    stroke-width: 1.2;
    stroke-dasharray: 4 4;
    pointer-events: none;
  }

  .sweep-marker {
    stroke: var(--panel);
    stroke-width: 1.3;
    pointer-events: none;
  }

  .sweep-salary-line {
    stroke: var(--accent);
    stroke-width: 1.6;
    opacity: 0.9;
    pointer-events: none;
  }

  .sweep-salary-marker {
    fill: var(--panel);
    stroke-width: 2;
    pointer-events: none;
  }

  .sweep-salary-label {
    fill: var(--accent);
    font-size: 10.5px;
    font-weight: 600;
    pointer-events: none;
  }

  .sweep-tooltip {
    pointer-events: none;
  }

  .sweep-tooltip-bg {
    fill: color-mix(in srgb, var(--panel) 92%, transparent);
    stroke: var(--line);
    stroke-width: 1;
  }

  .sweep-tooltip-title,
  .sweep-tooltip-subtitle,
  .sweep-tooltip-country,
  .sweep-tooltip-value,
  .sweep-tooltip-delta {
    fill: var(--ink);
    font-size: 11px;
    dominant-baseline: middle;
  }

  .sweep-tooltip-title {
    font-weight: 600;
  }

  .sweep-tooltip-subtitle {
    fill: var(--ink-soft);
    font-size: 10.4px;
  }

  .sweep-tooltip-country-base {
    font-weight: 700;
  }

  .sweep-tooltip-value {
    fill: var(--ink-soft);
  }

  .sweep-tooltip-delta {
    fill: var(--ink-soft);
  }

  .sweep-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.45rem;
    align-items: center;
  }

  .legend-item,
  .legend-reset {
    appearance: none;
    border: 1px solid var(--chip-border);
    border-radius: 999px;
    background: var(--chip-bg);
    color: var(--ink);
    font-size: 0.78rem;
    padding: 0.24rem 0.62rem;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
  }

  .legend-item.is-hidden {
    opacity: 0.48;
    border-style: dashed;
  }

  .legend-item:hover,
  .legend-reset:hover {
    border-color: var(--accent-soft);
  }

  .legend-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    display: inline-block;
    flex-shrink: 0;
  }

  .chart-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.5rem;
  }

  .row-head {
    display: flex;
    justify-content: space-between;
    gap: 0.7rem;
    font-size: 0.82rem;
    color: var(--ink-soft);
  }

  .row-head strong {
    color: var(--ink);
    font-size: 0.83rem;
  }

  .row-track {
    width: 100%;
    height: 8px;
    border-radius: 999px;
    overflow: hidden;
    background: color-mix(in srgb, var(--accent) 15%, transparent);
  }

  .row-track i {
    display: block;
    width: 0;
    height: 100%;
    background: linear-gradient(90deg, var(--accent), var(--accent-soft));
    transition: width 380ms cubic-bezier(0.22, 1, 0.36, 1);
  }

  .country-list {
    display: grid;
    gap: 0.74rem;
  }

  .country {
    display: grid;
    gap: 0.65rem;
    animation-delay: var(--delay);
  }

  .country-head {
    display: flex;
    justify-content: space-between;
    align-items: start;
    gap: 0.7rem;
  }

  .chip {
    font-size: 0.72rem;
    border: 1px solid var(--chip-border);
    background: var(--chip-bg);
    border-radius: 999px;
    padding: 0.18rem 0.5rem;
    font-weight: 700;
  }

  .metric-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.45rem;
  }

  .metric-grid div {
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 0.5rem;
    display: grid;
    gap: 0.2rem;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
  }

  .metric-grid span {
    color: var(--ink-soft);
    font-size: 0.78rem;
  }

  .metric-grid strong {
    font-size: 0.88rem;
    font-weight: 700;
  }

  .col-section {
    border-top: 1px solid var(--line);
    padding-top: 0.75rem;
    display: grid;
    gap: 0.5rem;
  }

  .col-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .col-label {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-soft);
  }

  .col-city-pills {
    display: flex;
    gap: 0.25rem;
  }

  .col-city-pill {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    border: 1px solid var(--chip-border);
    background: var(--chip-bg);
    color: var(--ink-soft);
    cursor: pointer;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }

  .col-city-pill.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }

  .col-city-pill:not(.active):hover {
    background: var(--field-bg);
    color: var(--ink);
  }

  .col-neighbourhoods {
    font-size: 0.75rem;
    margin: 0;
    line-height: 1.3;
  }

  .col-breakdown {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.3rem 0.5rem;
  }

  .col-breakdown div {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 0.25rem;
  }

  .col-br-tag {
    font-size: 0.68rem;
    font-weight: 700;
    padding: 0.05rem 0.3rem;
    border-radius: 3px;
    background: var(--chip-bg);
    border: 1px solid var(--chip-border);
    color: var(--ink-soft);
    vertical-align: middle;
  }

  .col-breakdown span {
    font-size: 0.78rem;
    color: var(--ink-soft);
  }

  .col-breakdown strong {
    font-size: 0.78rem;
    font-weight: 600;
  }

  .col-after {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.4rem;
    border-top: 1px solid var(--line);
    flex-wrap: wrap;
  }

  .col-after div {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
  }

  .col-after span:first-child {
    font-size: 0.83rem;
    font-weight: 700;
  }

  .col-after strong {
    font-size: 1rem;
    font-weight: 700;
    color: var(--accent);
  }

  .col-after strong.col-negative {
    color: #c0392b;
  }

  .col-version {
    font-size: 0.7rem;
  }

  .col-after-sub {
    font-size: 0.78rem;
    font-weight: 400;
    opacity: 0.7;
    white-space: nowrap;
  }

  .col-savings-panel {
    display: grid;
    gap: 0.75rem;
  }

  .col-pie-shell {
    width: 100%;
    overflow: visible;
  }

  .col-pie-slice {
    transition: opacity 0.15s;
  }

  .col-pie-slice:hover {
    opacity: 0.75;
  }

  .fold {
    border-top: 1px solid var(--line);
    padding-top: 0.5rem;
  }

  .fold summary {
    cursor: pointer;
    color: var(--ink-soft);
    font-size: 0.83rem;
    font-weight: 700;
  }

  .fold[open] summary {
    color: var(--ink);
  }

  .fold ul {
    margin: 0.4rem 0 0;
    padding-left: 1rem;
    display: grid;
    gap: 0.25rem;
  }

  .fold li {
    font-size: 0.81rem;
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .sources > summary {
    cursor: pointer;
    font-size: 1rem;
    font-weight: 700;
  }

  .sources-body {
    margin-top: 0.7rem;
    display: grid;
    gap: 0.7rem;
  }

  .source-list {
    border-top: 1px solid var(--line);
  }

  .source-row {
    padding: 0.7rem 0;
    border-bottom: 1px solid var(--line);
    display: grid;
    gap: 0.24rem;
  }

  .source-row:last-child {
    border-bottom: 0;
  }

  .source-row p {
    margin: 0;
    font-size: 0.83rem;
    color: var(--ink-soft);
  }

  .source-row ul {
    margin: 0.2rem 0 0;
    padding-left: 1rem;
    display: grid;
    gap: 0.2rem;
  }

  .source-row a {
    color: var(--link);
    font-size: 0.82rem;
    text-decoration: none;
  }

  .source-row a:hover {
    text-decoration: underline;
  }

  @keyframes rise-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (max-width: 1140px) {
    .workspace {
      grid-template-columns: 1fr;
    }

    .controls {
      position: static;
    }

    .metric-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 760px) {
    .app-shell {
      padding: 0.75rem 0.65rem 1rem;
    }

    .hero {
      grid-template-columns: 1fr;
      gap: 0.7rem;
    }

    .hero-meta {
      border-left: 0;
      border-top: 1px solid var(--line);
      padding-left: 0;
      padding-top: 0.55rem;
    }

    .grid.two,
    .fx-grid,
    .metric-grid {
      grid-template-columns: 1fr;
    }

    .residency-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .currency-options {
      flex-wrap: nowrap;
      overflow-x: auto;
      padding-bottom: 0.25rem;
    }

    .currency-chip {
      flex: 0 0 auto;
    }

    .sweep-chart {
      min-width: 700px;
    }
  }

  @media (max-width: 520px) {
    .residency-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
