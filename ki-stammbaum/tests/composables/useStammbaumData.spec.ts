import { describe, it, expect, vi, beforeEach } from 'vitest';

const flushPromises = () => new Promise((resolve) => setTimeout(resolve));

describe('useStammbaumData', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete (globalThis as any).$fetch;
  });

  it('caches fetched data', async () => {
    const mockData = { nodes: ['fetched'] };
    (globalThis as any).$fetch = vi.fn().mockResolvedValue(mockData);

    const { useStammbaumData } = await import('@/composables/useStammbaumData');
    const first = useStammbaumData();
    await flushPromises();

    expect((globalThis as any).$fetch).toHaveBeenCalledTimes(1);
    expect(first.data.value).toEqual(mockData);

    const second = useStammbaumData();
    await flushPromises();
    expect((globalThis as any).$fetch).toHaveBeenCalledTimes(1);
    expect(second.data.value).toBe(first.data.value);
  });

  it('uses dynamic import on fetch error', async () => {
    const importData = { nodes: ['imported'] };
    (globalThis as any).$fetch = vi.fn().mockRejectedValue(new Error('fail'));
    vi.mock(
      '@/public/data/ki-stammbaum.json',
      () => ({ default: importData }),
      { virtual: true },
    );

    const { useStammbaumData } = await import('@/composables/useStammbaumData');
    const { data, error } = useStammbaumData();
    await flushPromises();

    expect(data.value).toEqual(importData);
    expect(error.value).toBeNull();
  });

  it('sets error when both fetch and import fail', async () => {
    const fetchErr = new Error('network');
    (globalThis as any).$fetch = vi.fn().mockRejectedValue(fetchErr);
    vi.mock(
      '@/public/data/ki-stammbaum.json',
      () => {
        throw new Error('no file');
      },
      { virtual: true },
    );

    const { useStammbaumData } = await import('@/composables/useStammbaumData');
    const { error, data } = useStammbaumData();
    await flushPromises();

    expect(data.value).toBeNull();
    expect(error.value).toBe(fetchErr);
  });
});
