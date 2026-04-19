import { describe, expect, it, vi } from 'vitest';
import { fetchLiveFxRatesToJPY } from '$lib/fx-fetch';

describe('fetchLiveFxRatesToJPY', () => {
  it('converts JPY-base API rates to toJPY values', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: true,
        json: async () => ({
          amount: 1,
          base: 'JPY',
          date: '2026-04-01',
          rates: {
            SEK: 0.068,
            THB: 0.24,
            CHF: 0.0059,
            GBP: 0.0052,
            USD: 0.0068,
            MYR: 0.0302,
            SGD: 0.009,
            INR: 0.5714
          }
        })
      } as Response;
    });

    const result = await fetchLiveFxRatesToJPY(fetchMock as unknown as typeof fetch, 50);

    expect(result.toJPY.JPY).toBe(1);
    expect(result.toJPY.SEK).toBeCloseTo(14.70588235, 6);
    expect(result.toJPY.THB).toBeCloseTo(4.16666666, 6);
    expect(result.toJPY.CHF).toBeCloseTo(169.49152542, 6);
    expect(result.toJPY.GBP).toBeCloseTo(192.3076923, 6);
    expect(result.toJPY.USD).toBeCloseTo(147.05882353, 6);
    expect(result.toJPY.MYR).toBeCloseTo(33.11258278, 6);
    expect(result.toJPY.SGD).toBeCloseTo(111.11111111, 6);
    expect(result.toJPY.INR).toBeCloseTo(1.7500875, 6);
    expect(result.updatedAt).toBe('2026-04-01');
  });

  it('throws on non-OK response', async () => {
    const fetchMock = vi.fn(async () => {
      return {
        ok: false,
        status: 503,
        json: async () => ({})
      } as Response;
    });

    await expect(fetchLiveFxRatesToJPY(fetchMock as unknown as typeof fetch, 50)).rejects.toThrow(
      'FX request failed: 503'
    );
  });
});
