import { SLSWebTrackingAdapter } from '../transport/SLSWebTrackingAdapter';

jest.mock(
  '@aliyun-sls/web-track-browser/dist/web-track-browser.es.js',
  () => {
  return jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue(undefined),
    destroy: jest.fn()
  }));
  }
);

describe('SLSWebTrackingAdapter', () => {
  beforeAll(() => {
    (global as any).window = {
      location: {
        href: 'http://localhost:3000/#/test',
        pathname: '/test',
        hash: '#/test'
      }
    };
    (global as any).document = {
      title: 'Test Page'
    };
    (global as any).navigator = {
      userAgent: 'TestAgent',
      language: 'en-US'
    };
  });

  it('initializes and can send a basic log', async () => {
    const adapter = new SLSWebTrackingAdapter({
      enabled: true,
      debug: false
    });

    await adapter.init();

    await expect(
      adapter.sendLog({ type: 'custom', message: 'hello' })
    ).resolves.toBeUndefined();

    const stats = adapter.getStats();
    expect(stats.isInitialized).toBe(true);
  });
});
