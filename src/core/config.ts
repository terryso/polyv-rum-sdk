import type { RUMEnv } from './env';
import { getRUMEnv } from './env';

const getEnv = (key: string, defaultValue = ''): string => {
  const env: RUMEnv = getRUMEnv();
  if (env && Object.prototype.hasOwnProperty.call(env, key)) {
    return (env as any)[key] || defaultValue;
  }
  return defaultValue;
};

const isProduction = getEnv('NODE_ENV') === 'production';
const isDebugEnabled = getEnv('VUE_APP_RUM_DEBUG', 'false') === 'true';

const getSessionId = (): string => {
  if (typeof sessionStorage === 'undefined') {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  let sessionId = sessionStorage.getItem('rum_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    sessionStorage.setItem('rum_session_id', sessionId);
  }
  return sessionId;
};

const getMetricType = (data: any): string => {
  switch (data.type) {
    case 'performance':
      return 'duration';
    case 'xhr':
      return 'xhr';
    case 'fetch':
      return 'fetch';
    case 'click':
      return 'click';
    case 'route':
      return 'route';
    case 'error':
      return 'error';
    default:
      return 'unknown';
  }
};

const extractValue = (data: any): number => {
  switch (data.type) {
    case 'performance':
      return data.duration || 0;
    case 'xhr':
    case 'fetch':
      return data.duration || data.status || 0;
    case 'click':
    case 'error':
      return 1;
    default:
      return 1;
  }
};

export interface SlsConfig {
  host: string;
  project: string;
  logstore: string;
  time: number;
  count: number;
  topic: string;
  source: string;
  enabled: boolean;
  debug: boolean;
  appName: string;
  appVersion: string;
  retryCount: number;
  retryInterval: number;
}

export const slsConfig: SlsConfig = {
  host: getEnv('VUE_APP_SLS_HOST'),
  project: getEnv('VUE_APP_SLS_PROJECT'),
  logstore: getEnv('VUE_APP_SLS_LOGSTORE'),
  time: 10,
  count: 10,
  topic: 'rum-monitor',
  source: 'web',
  enabled: getEnv('VUE_APP_SLS_ENABLED', 'false') === 'true',
  debug: isDebugEnabled,
  appName: getEnv('VUE_APP_RUM_APP_NAME', 'rum-app'),
  appVersion: getEnv('PACKAGE_VERSION', '1.0.0'),
  retryCount: 3,
  retryInterval: 2000
};

if (typeof console !== 'undefined' && isDebugEnabled) {
  console.log('🔧 SLS Config:', {
    enabled: slsConfig.enabled,
    debug: slsConfig.debug,
    host: slsConfig.host,
    project: slsConfig.project,
    logstore: slsConfig.logstore,
    envCheck: {
      VUE_APP_SLS_ENABLED: getEnv('VUE_APP_SLS_ENABLED'),
      VUE_APP_RUM_DEBUG: getEnv('VUE_APP_RUM_DEBUG')
    }
  });
}

export interface MitoSampleRateConfig {
  error: number;
  click: number;
  route: number;
  custom: number;
  xhr: number;
}

export interface MitoConfig {
  dsn: string | null;
  appName: string;
  appVersion: string;
  environment: string;
  debug: boolean;
  maxBreadcrumbs: number;
  sampleRate: MitoSampleRateConfig;
  vue: {
    Vue?: any;
    lifecycle: boolean;
    performance: boolean;
  };
  network: {
    xhr: boolean;
    fetch: boolean;
    ignoreUrls: (string | RegExp)[];
    responseSizeLimit: number;
  };
  error: {
    javascript: boolean;
    promise: boolean;
    resource: boolean;
    ignoreErrors: (string | RegExp)[];
  };
  user: {
    click: boolean;
    route: boolean;
    performance: boolean;
    sensitiveSelectors: string[];
  };
  breadcrumb: {
    console: boolean;
    dom: boolean;
    navigation: boolean;
    customTypes: string[];
  };
  transport: {
    type: 'xhr' | 'fetch' | 'image';
    batch: {
      size: number;
      interval: number;
      immediateOnError: boolean;
    };
    retry: {
      times: number;
      interval: number;
    };
  };
}

export const mitoConfig: MitoConfig = {
  dsn: getEnv('VUE_APP_RUM_DSN', '') || null,
  appName: 'live-admin-v3',
  appVersion: getEnv('PACKAGE_VERSION', '1.0.0'),
  environment: getEnv('NODE_ENV', 'development'),
  debug: isDebugEnabled,
  maxBreadcrumbs: 20,
  sampleRate: {
    error: 1.0,
    click: isProduction ? 0.1 : 1.0,
    route: 1.0,
    custom: 1.0,
    xhr: isProduction ? 0.5 : 1.0
  },
  vue: {
    Vue: undefined,
    lifecycle: true,
    performance: true
  },
  network: {
    xhr: true,
    fetch: true,
    ignoreUrls: [/sls\.aliyuncs\.com/, /file:\/\//],
    responseSizeLimit: 500
  },
  error: {
    javascript: true,
    promise: true,
    resource: true,
    ignoreErrors: [/third-party/, /Network timeout/]
  },
  user: {
    click: true,
    route: true,
    performance: true,
    sensitiveSelectors: [
      'input[type="password"]',
      'input[name*="password"]',
      'input[name*="token"]',
      'textarea[name*="secret"]'
    ]
  },
  breadcrumb: {
    console: isDebugEnabled,
    dom: true,
    navigation: true,
    customTypes: ['vue', 'vuex', 'axios']
  },
  transport: {
    type: 'xhr',
    batch: {
      size: 10,
      interval: 5000,
      immediateOnError: true
    },
    retry: {
      times: 3,
      interval: 2000
    }
  }
};

export interface TransformContext {
  store?: any;
  router?: any;
}

export const getUserInfo = (store?: any): any => {
  try {
    if (!store || !store.state) {
      return {};
    }

    const userModule = store.state.user || {};
    const userInfo = userModule.userInfo || userModule || {};
    const getters = store.getters || {};

    return {
      userId: userInfo.userId || userInfo.id || getters['user/userId'],
      userName: userInfo.userName || userInfo.contact || userInfo.name,
      accountId: userInfo.accountId,
      email: userInfo.email,
      roles: userInfo.roles || [],
      permissions: getters['user/permissions'] || userInfo.permissions || []
    };
  } catch (error) {
    console.warn('Failed to get user info from store:', error);
    return {};
  }
};

export const transformDataForSLS = (data: any, context: TransformContext = {}): any => {
  const timestamp = new Date().toISOString();
  const userInfo = getUserInfo(context.store);

  const dimensions: Record<string, any> = {
    pageTitle: typeof document !== 'undefined' ? document.title : '',
    path: typeof window !== 'undefined' ? window.location.pathname : '',
    search: typeof window !== 'undefined' ? window.location.search : '',
    hash: typeof window !== 'undefined' ? window.location.hash : '',
    ...(userInfo && {
      userId: userInfo.userId,
      userName: userInfo.userName,
      accountId: userInfo.accountId,
      userEmail: userInfo.email,
      userRoles: (userInfo.roles || []).join(','),
      userPermissions: (userInfo.permissions || []).join(',')
    }),
    ...data.customData
  };

  if (data.type === 'click') {
    const target = data.target || {};
    const page = data.page || {};

    dimensions.clickBizId = data.bizId;
    dimensions.clickTargetTag = target.tagName;
    dimensions.clickTargetId = target.id;
    dimensions.clickTargetClass = target.className;
    dimensions.clickTargetSelector = target.selector;
    dimensions.clickTargetText = target.textContent;

    dimensions.clickPageUrl = page.url;
    dimensions.clickPagePath = page.path;
    dimensions.clickPageTitle = page.title;

    dimensions.clickX = data.x;
    dimensions.clickY = data.y;
  }

  return {
    __time__: Math.floor(Date.now() / 1000),
    __source__: 'live-admin-v3',
    timestamp,
    environment: mitoConfig.environment,
    sessionId: getSessionId(),
    user: userInfo,
    dataType: data.type || 'unknown',
    metricType: getMetricType(data),
    value: extractValue(data),
    event: {
      type: data.type,
      url:
        typeof window !== 'undefined' && window.location
          ? window.location.href
          : '',
      userAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      referrer:
        typeof document !== 'undefined' ? document.referrer : undefined
    },
    techStack: {
      vue: (context as any).Vue?.version || 'unknown',
      platform:
        typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
      language:
        typeof navigator !== 'undefined' ? navigator.language : 'unknown'
    },
    rawData: isDebugEnabled ? data : undefined,
    dimensions
  };
};

export const shouldReport = (data: any): boolean => {
  const dataType = data.type as keyof MitoSampleRateConfig;
  const sampleRate = (mitoConfig.sampleRate as any)[dataType] || 0;

  if (sampleRate === 0) return false;
  if (sampleRate === 1) return true;

  return Math.random() < sampleRate;
};
