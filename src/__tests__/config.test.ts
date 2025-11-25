import { mitoConfig, shouldReport, transformDataForSLS } from '../core/config';

describe('core/config', () => {
  beforeAll(() => {
    (global as any).window = {
      location: {
        href: 'http://localhost:3000/#/test',
        pathname: '/test',
        search: '?a=1',
        hash: '#/test'
      }
    };
    (global as any).document = {
      title: 'Test Page',
      referrer: 'http://referrer.com'
    };
    (global as any).navigator = {
      userAgent: 'TestAgent',
      platform: 'TestOS',
      language: 'en-US'
    };
    (global as any).sessionStorage = {
      getItem: jest.fn(() => null),
      setItem: jest.fn()
    };
  });

  it('shouldReport respects sampleRate defaults', () => {
    expect(shouldReport({ type: 'error' })).toBe(true);
    expect(shouldReport({ type: 'unknown-type' })).toBe(false);
  });

  it('transformDataForSLS produces basic structure', () => {
    const store = {
      state: {
        user: {
          userId: 'u1',
          userName: 'tester',
          accountId: 'acc1',
          email: 'test@example.com',
          roles: ['admin'],
          permissions: ['p1']
        }
      },
      getters: {}
    };

    const data = {
      type: 'click',
      bizId: 'btn_test',
      target: {
        tagName: 'BUTTON',
        id: 'btn',
        className: 'btn-primary',
        selector: 'button.btn-primary',
        textContent: 'Click'
      },
      page: {
        url: 'http://localhost:3000/#/test',
        path: '/test',
        title: 'Test Page'
      },
      x: 10,
      y: 20
    };

    const result = transformDataForSLS(data, { store });

    expect(result).toHaveProperty('__time__');
    expect(result).toHaveProperty('__source__');
    expect(result).toHaveProperty('environment', mitoConfig.environment);
    expect(result).toHaveProperty('user.userId', 'u1');
    expect(result).toHaveProperty('dataType', 'click');
    expect(result).toHaveProperty('dimensions.clickBizId', 'btn_test');
  });
});
