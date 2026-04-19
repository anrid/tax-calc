import type { FxRates } from '$lib/types';

const FX_API_URL = 'https://api.frankfurter.app/latest?from=JPY&to=SEK,THB,CHF,GBP,USD,MYR,SGD,INR';

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

export async function fetchLiveFxRatesToJPY(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 3000
): Promise<FxRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(FX_API_URL, {
      method: 'GET',
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`FX request failed: ${response.status}`);
    }

    const payload = (await response.json()) as FrankfurterResponse;
    const sekPerJPY = payload.rates.SEK;
    const thbPerJPY = payload.rates.THB;
    const chfPerJPY = payload.rates.CHF;
    const gbpPerJPY = payload.rates.GBP;
    const usdPerJPY = payload.rates.USD;
    const myrPerJPY = payload.rates.MYR;
    const sgdPerJPY = payload.rates.SGD;
    const inrPerJPY = payload.rates.INR;

    if (
      !Number.isFinite(sekPerJPY) ||
      sekPerJPY <= 0 ||
      !Number.isFinite(thbPerJPY) ||
      thbPerJPY <= 0 ||
      !Number.isFinite(chfPerJPY) ||
      chfPerJPY <= 0 ||
      !Number.isFinite(gbpPerJPY) ||
      gbpPerJPY <= 0 ||
      !Number.isFinite(usdPerJPY) ||
      usdPerJPY <= 0 ||
      !Number.isFinite(myrPerJPY) ||
      myrPerJPY <= 0 ||
      !Number.isFinite(sgdPerJPY) ||
      sgdPerJPY <= 0 ||
      !Number.isFinite(inrPerJPY) ||
      inrPerJPY <= 0
    ) {
      throw new Error('FX payload missing SEK/THB/CHF/GBP/USD/MYR/SGD/INR rates');
    }

    return {
      toJPY: {
        JPY: 1,
        SEK: 1 / sekPerJPY,
        THB: 1 / thbPerJPY,
        CHF: 1 / chfPerJPY,
        GBP: 1 / gbpPerJPY,
        USD: 1 / usdPerJPY,
        MYR: 1 / myrPerJPY,
        SGD: 1 / sgdPerJPY,
        INR: 1 / inrPerJPY
      },
      updatedAt: payload.date || new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}
