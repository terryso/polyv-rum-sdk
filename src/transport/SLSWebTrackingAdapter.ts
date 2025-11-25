import SlsTracker from '@aliyun-sls/web-track-browser/dist/web-track-browser.es.js';
import { getRUMEnv } from '../core/env';

const getEnv = (key: string, defaultValue = ''): string => {
  const env = getRUMEnv();
  if (env && Object.prototype.hasOwnProperty.call(env, key)) {
    return (env as any)[key] || defaultValue;
  }
  return defaultValue;
};

export interface SLSAdapterConfig {
  host?: string;
  project?: string;
  logstore?: string;
  time?: number;
  count?: number;
  topic?: string;
  source?: string;
  environment?: string;
  debug?: boolean;
  enabled?: boolean;
  userId?: string | null;
  sessionId?: string;
  appName?: string;
  appVersion?: string;
  retryCount?: number;
  retryInterval?: number;
}

export class SLSWebTrackingAdapter {
  private config: Required<SLSAdapterConfig>;
  private slsTracker: any = null;
  private isInitialized = false;
  private isDestroyed = false;
  private pendingLogs: any[] = [];
  private retryQueue: Array<{
    data: any;
    error: Error;
    timestamp: number;
    retryCount: number;
  }> = [];

  constructor(config: SLSAdapterConfig = {}) {
    this.config = {
      host:
        config.host || getEnv('VUE_APP_SLS_HOST') || '',
      project:
        config.project || getEnv('VUE_APP_SLS_PROJECT') || '',
      logstore:
        config.logstore || getEnv('VUE_APP_SLS_LOGSTORE') || '',
      time: config.time ?? 10,
      count: config.count ?? 10,
      topic: config.topic || 'rum-monitor',
      source: config.source || 'web',
      environment: config.environment || getEnv('NODE_ENV', 'development'),
      debug: config.debug ?? (getEnv('VUE_APP_RUM_DEBUG', 'false') === 'true'),
      enabled: config.enabled ?? true,
      userId: config.userId ?? null,
      sessionId: config.sessionId || this.generateSessionId(),
      appName:
        config.appName || getEnv('VUE_APP_RUM_APP_NAME', 'rum-app'),
      appVersion: config.appVersion || getEnv('PACKAGE_VERSION', '1.0.0'),
      retryCount: config.retryCount ?? 3,
      retryInterval: config.retryInterval ?? 2000
    };

    this.handleBeforeSend = this.handleBeforeSend.bind(this);
    this.handleError = this.handleError.bind(this);
  }

  async init(): Promise<void> {
    if (this.isInitialized) {
      console.warn('SLSWebTrackingAdapter already initialized');
      return;
    }

    if (this.isDestroyed) {
      throw new Error(
        'SLSWebTrackingAdapter has been destroyed, cannot reinitialize'
      );
    }

    if (!this.config.enabled) {
      if (this.config.debug) {
        console.log('SLSWebTrackingAdapter is disabled');
      }
      return;
    }

    if (this.config.debug) {
      console.log('🚀 Initializing SLSWebTrackingAdapter...', {
        config: this.config,
        SlsTracker: typeof SlsTracker
      });
    }

    try {
      this.slsTracker = new (SlsTracker as any)({
        host: this.config.host,
        project: this.config.project,
        logstore: this.config.logstore,
        time: this.config.time,
        count: this.config.count,
        topic: this.config.topic,
        source: this.config.source,
        autoPopulateFields: false,
        beforeSend: this.handleBeforeSend
      });

      this.isInitialized = true;

      if (this.config.debug) {
        console.log('✅ SLSWebTrackingAdapter initialized successfully', {
          project: this.config.project,
          logstore: this.config.logstore,
          host: this.config.host,
          trackerInstance: !!this.slsTracker
        });
      }

      await this.sendLog({
        type: 'system',
        category: 'init',
        message: 'SLS WebTracking adapter initialized successfully',
        level: 'info',
        timestamp: Date.now()
      });
    } catch (error: any) {
      console.error('❌ Failed to initialize SLSWebTrackingAdapter:', error);
      this.handleError(error);
      throw error;
    }
  }

  async sendLog(data: Record<string, any>): Promise<void> {
    if (this.config.debug) {
      console.log('📤 Sending log to SLS...', {
        originalData: data,
        isReady: this.checkReady(),
        hasTracker: !!this.slsTracker,
        isInitialized: this.isInitialized
      });
    }

    if (!this.checkReady()) {
      if (this.config.debug) {
        console.log('❌ SLS adapter not ready, skipping log send');
      }
      return;
    }

    try {
      const logData = await this.transformLogData(data);

      if (this.config.debug) {
        console.log('🔧 Transformed SLS Log Data:', logData);
      }

      await this.slsTracker.send(logData);

      if (this.config.debug) {
        console.log('✅ Log sent to SLS successfully');
      }
    } catch (error: any) {
      console.error('❌ Failed to send log to SLS:', error);
      await this.handleSendError(data, error);
    }
  }

  async sendBatchLogs(logs: Record<string, any>[]): Promise<void> {
    if (!this.checkReady()) {
      return;
    }

    if (!Array.isArray(logs) || logs.length === 0) {
      return;
    }

    try {
      const transformedLogs = await Promise.all(
        logs.map((log) => this.transformLogData(log))
      );

      for (const logData of transformedLogs) {
        await this.slsTracker.send(logData);
      }

      if (this.config.debug) {
        console.log(
          `Batch sent ${transformedLogs.length} logs to SLS successfully`
        );
      }
    } catch (error) {
      console.error('Failed to send batch logs to SLS:', error);

      for (const log of logs) {
        await this.handleSendError(log, error as any);
      }
    }
  }

  async transformLogData(data: Record<string, any>): Promise<Record<string, any>> {
    const timestamp = Math.floor(Date.now() / 1000);

    const logData: Record<string, any> = {
      __time__: timestamp,
      __source__: this.config.source,

      // 基础信息
      event_type: data.eventType || data.type || 'unknown',
      category: data.category || 'general',
      level: data.level || 'info',
      client_timestamp: Date.now(),

      // 应用信息
      app_name: this.config.appName,
      // app_version: this.config.appVersion,
      environment: this.config.environment,

      // 会话信息
      session_id: this.config.sessionId,

      // 页面信息
      page_url:
        typeof window !== 'undefined' && window.location
          ? window.location.href
          : '',
      page_title:
        typeof document !== 'undefined' ? document.title : undefined,
      page_path:
        typeof window !== 'undefined' && window.location
          ? window.location.pathname
          : '',
      // 来源页面（用于识别搜索引擎 / 外链等流量来源）
      referrer:
        (data.event && typeof data.event.referrer === 'string'
          ? data.event.referrer
          : typeof document !== 'undefined'
            ? document.referrer
            : undefined),

      // 用户代理信息
      user_agent:
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      language:
        typeof navigator !== 'undefined' ? navigator.language : undefined
    };

    // 用户标识，优先使用上游数据
    if (this.config.userId) {
      logData.user_id = this.config.userId;
    }
    if (data.userId) {
      logData.user_id = data.userId;
    }
    if (data.userName) {
      logData.user_name = data.userName;
    }

    let isInternalUser = false;
    if (data.userEmail && typeof data.userEmail === 'string') {
      const emailParts = data.userEmail.split('@');
      if (emailParts.length === 2) {
        const domain = emailParts[1].toLowerCase();
        const internalDomains = getEnv(
          'VUE_APP_RUM_INTERNAL_EMAIL_DOMAINS',
          'polyv.net,polyv.com'
        )
          .split(',')
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean);
        if (internalDomains.length > 0 && domain) {
          isInternalUser = internalDomains.some((internalDomain) => {
            if (!internalDomain) return false;
            return (
              domain === internalDomain ||
              domain.endsWith(`.${internalDomain}`)
            );
          });
        }
      }
    }

    logData.is_internal_user = isInternalUser;

    // 根据事件类型添加特定字段
    if (logData.event_type === 'error') {
      this.addErrorFields(logData, data);
    } else if (
      logData.event_type === 'xhr' ||
      logData.event_type === 'fetch'
    ) {
      this.addApiFields(logData, data);
    } else if (logData.event_type === 'click') {
      this.addClickFields(logData, data);
    }

    // 添加 detail_json，仅保留 hash 信息
    try {
      let hash = '';
      if (data && typeof data.hash === 'string') {
        hash = data.hash;
      } else if (
        data &&
        data.dimensions &&
        typeof data.dimensions.hash === 'string'
      ) {
        hash = data.dimensions.hash;
      } else if (
        typeof window !== 'undefined' &&
        typeof window.location !== 'undefined'
      ) {
        hash = window.location.hash || '';
      }

      logData.detail_json = JSON.stringify({ hash });
    } catch (error) {
      console.warn('Failed to serialize detail data:', error);
      logData.detail_json = JSON.stringify({
        error: 'Failed to serialize data'
      });
    }

    return logData;
  }

  private addErrorFields(
    logData: Record<string, any>,
    data: Record<string, any>
  ): void {
    if (data.message) {
      logData.error_message = String(data.message);
    }

    if (data.stack) {
      logData.error_stack = String(data.stack);
    }

    if (data.filename) {
      logData.error_filename = data.filename;
    }

    if (data.lineno) {
      logData.error_lineno = String(data.lineno);
    }

    if (data.colno) {
      logData.error_colno = String(data.colno);
    }

    if (data.name) {
      logData.error_name = data.name;
    }
  }

  private addApiFields(
    logData: Record<string, any>,
    data: Record<string, any>
  ): void {
    if (data.url) {
      logData.api_url = data.url;
    }

    if (data.method) {
      logData.api_method = data.method;
    }

    if (data.status !== undefined) {
      logData.api_status = Number(data.status);
    }

    if (data.duration !== undefined) {
      logData.api_duration = Number(data.duration);
    }

    if (data.responseSize !== undefined) {
      logData.api_response_size = Number(data.responseSize);
    }
  }

  private addClickFields(
    logData: Record<string, any>,
    data: Record<string, any>
  ): void {
    if (data.clickBizId || data.bizId) {
      logData.click_biz_id = data.clickBizId || data.bizId;
    }

    if (data.target) {
      logData.click_target = data.target;
    }

    if (data.selector) {
      logData.click_selector = data.selector;
    }

    if (data.text) {
      logData.click_text = data.text;
    }

    if (data.x !== undefined) {
      logData.click_x = Number(data.x);
    }

    if (data.y !== undefined) {
      logData.click_y = Number(data.y);
    }
  }

  private filterSensitiveData(data: Record<string, any>): Record<string, any> {
    const sensitivePatterns = [
      /password/i,
      /token/i,
      /secret/i,
      /key/i,
      /auth/i,
      /credential/i
    ];

    const filtered: Record<string, any> = { ...data };

    Object.keys(filtered).forEach((key) => {
      const value = filtered[key];
      if (typeof value === 'string') {
        if (sensitivePatterns.some((pattern) => pattern.test(key))) {
          filtered[key] = '[FILTERED]';
        }

        if (filtered[key].length > 500) {
          filtered[key] = `${filtered[key].substring(0, 500)}...`;
        }
      }
    });

    return filtered;
  }

  private async handleSendError(data: any, error: Error): Promise<void> {
    const retryItem = {
      data,
      error,
      timestamp: Date.now(),
      retryCount: 0
    };

    this.retryQueue.push(retryItem);

    if (this.shouldRetry(error)) {
      setTimeout(() => {
        this.retryFailedLogs();
      }, this.config.retryInterval);
    }
  }

  private async retryFailedLogs(): Promise<void> {
    if (this.retryQueue.length === 0) {
      return;
    }

    const itemsToRetry = this.retryQueue.filter(
      (item) => item.retryCount < this.config.retryCount
    );

    this.retryQueue = this.retryQueue.filter(
      (item) => item.retryCount >= this.config.retryCount
    );

    for (const item of itemsToRetry) {
      try {
        item.retryCount++;
        await this.sendLog(item.data);

        const index = this.retryQueue.indexOf(item);
        if (index > -1) {
          this.retryQueue.splice(index, 1);
        }
      } catch (error) {
        console.warn(
          `Retry failed for log (attempt ${item.retryCount}):`,
          error
        );

        if (item.retryCount < this.config.retryCount) {
          setTimeout(() => {
            this.retryFailedLogs();
          }, this.config.retryInterval * item.retryCount);
        } else {
          console.error('Max retry attempts reached, dropping log:', item.data);
        }
      }
    }
  }

  private shouldRetry(error: Error): boolean {
    const retryableErrors = [
      'Network timeout',
      'Connection failed',
      'Service unavailable',
      'Rate limit exceeded'
    ];

    return retryableErrors.some(
      (pattern) => (error.message && error.message.includes(pattern))
    );
  }

  private handleError(error: Error): void {
    console.error('SLSWebTrackingAdapter Error:', error);
  }

  private checkReady(): boolean {
    if (!this.config.enabled) {
      return false;
    }

    if (!this.isInitialized) {
      console.warn('SLSWebTrackingAdapter not initialized');
      return false;
    }

    if (!this.slsTracker) {
      console.warn('SLS Tracker not available');
      return false;
    }

    return true;
  }

  private generateSessionId(): string {
    if (typeof sessionStorage !== 'undefined') {
      let sessionId = sessionStorage.getItem('sls_session_id');
      if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random()
          .toString(36)
          .substring(2, 9)}`;
        sessionStorage.setItem('sls_session_id', sessionId);
      }
      return sessionId;
    }

    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  handleBeforeSend(logData: any): boolean | Record<string, any> {
    try {
      const dataSize = JSON.stringify(logData).length;
      const maxSize = 1024 * 1024; // 1MB

      if (dataSize > maxSize) {
        console.warn('Log data too large, skipping:', dataSize);
        return false;
      }

      const filteredData = this.filterSensitiveData(logData);

      if (this.config.debug) {
        console.log('Log before send:', filteredData);
      }

      return filteredData;
    } catch (error) {
      console.error('Error in beforeSend handler:', error);
      return false;
    }
  }

  setUserId(userId: string): void {
    this.config.userId = userId;
  }

  updateConfig(newConfig: Partial<SLSAdapterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): SLSAdapterConfig {
    return { ...this.config };
  }

  getStats(): {
    isInitialized: boolean;
    isDestroyed: boolean;
    pendingLogsCount: number;
    retryQueueCount: number;
    config: {
      project: string | undefined;
      logstore: string | undefined;
      enabled: boolean | undefined;
    };
  } {
    return {
      isInitialized: this.isInitialized,
      isDestroyed: this.isDestroyed,
      pendingLogsCount: this.pendingLogs.length,
      retryQueueCount: this.retryQueue.length,
      config: {
        project: this.config.project,
        logstore: this.config.logstore,
        enabled: this.config.enabled
      }
    };
  }

  destroy(): void {
    if (this.isDestroyed) {
      return;
    }

    try {
      if (this.retryQueue.length > 0 && this.config.debug) {
        console.warn(
          `Destroying adapter with ${this.retryQueue.length} items in retry queue`
        );
      }

      if (this.slsTracker && this.slsTracker.destroy) {
        this.slsTracker.destroy();
      }

      this.isDestroyed = true;
      this.isInitialized = false;
      this.slsTracker = null;
      this.pendingLogs = [];
      this.retryQueue = [];

      if (this.config.debug) {
        console.log('SLSWebTrackingAdapter destroyed');
      }
    } catch (error) {
      console.error('Error destroying SLSWebTrackingAdapter:', error);
    }
  }
}
