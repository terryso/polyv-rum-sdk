import * as Mito from '@mitojs/browser';
import {
  mitoConfig,
  slsConfig,
  transformDataForSLS,
  shouldReport,
  type MitoConfig,
  type TransformContext
} from './config';
import {
  SLSWebTrackingAdapter,
  type SLSAdapterConfig
} from '../transport/SLSWebTrackingAdapter';

export interface MitoSLSAdapterOptions extends MitoConfig {
  slsConfigOverride?: Partial<SLSAdapterConfig>;
}

export class MitoSLSAdapter {
  private options: MitoSLSAdapterOptions;
  private mitoInstance: any = null;
  private slsAdapter: SLSWebTrackingAdapter | null = null;
  private store: any = null;
  private router: any = null;
  private isInitialized = false;

  constructor(options: Partial<MitoSLSAdapterOptions> = {}) {
    this.options = {
      ...mitoConfig,
      ...options
    } as MitoSLSAdapterOptions;

    this.handleDataReport = this.handleDataReport.bind(this);
    this.handleRouteChange = this.handleRouteChange.bind(this);
    this.handleError = this.handleError.bind(this);
    this.addBreadcrumb = this.addBreadcrumb.bind(this);
  }

  addBreadcrumb(payload: any): void {
    if (!this.mitoInstance || !this.mitoInstance.breadcrumb) {
      return;
    }

    const breadcrumb = this.mitoInstance.breadcrumb;

    if (typeof breadcrumb.add === 'function') {
      breadcrumb.add(payload);
      return;
    }

    if (typeof breadcrumb.push === 'function') {
      breadcrumb.push(payload);
    }
  }

  async init(context: TransformContext & { Vue?: any } = {}): Promise<void> {
    if (this.isInitialized) {
      console.warn('MitoSLSAdapter already initialized');
      return;
    }

    this.store = context.store;
    this.router = context.router;

    if (!this.options.dsn) {
      console.warn(
        'MitoSLSAdapter: DSN not configured, RUM system will run in simulation mode'
      );
    }

    try {
      const slsConfigOverride = this.options.slsConfigOverride || {};
      this.slsAdapter = new SLSWebTrackingAdapter({
        ...slsConfig,
        ...slsConfigOverride
      });
      await this.slsAdapter.init();

      this.mitoInstance = Mito.init({
        dsn: this.options.dsn || undefined,
        debug: this.options.debug,
        maxBreadcrumbs: this.options.maxBreadcrumbs,
        Vue: context.Vue || this.options.vue?.Vue,
        framework: {
          vue: true
        },
        beforeDataReport: this.handleDataReport,
        silent: !this.options.debug,
        silentConsole: !this.options.debug,
        enableUrlHash: true,
        enableUserAgent: true,
        enableHistory: true,
        performance: {
          enable: this.options.user.performance,
          sampleRate: (this.options.sampleRate as any).performance || 1.0
        },
        user: {
          enableClickTrack: this.options.user.click,
          clickTrackSampleRate: (this.options.sampleRate as any).click,
          ignoreSelector: this.options.user.sensitiveSelectors.join(', ')
        },
        api: {
          enableApiMonitor: this.options.network.xhr,
          apiMonitorSampleRate: (this.options.sampleRate as any).xhr,
          ignoreUrls: this.options.network.ignoreUrls,
          requestSizeLimit: this.options.network.responseSizeLimit * 1024
        }
      } as any);

      this.setupVueIntegration();
      this.setupRouterIntegration();
      this.setupErrorHandling();

      this.isInitialized = true;
      if (this.options.debug) {
        console.log('MitoSLSAdapter initialized successfully');
      }
    } catch (error) {
      console.error('Failed to initialize MitoSLSAdapter:', error);
      this.handleError(error);
    }
  }

  private setupVueIntegration(): void {
    if (!this.store) {
      console.warn('Vuex store not provided, some features may be limited');
      return;
    }

    this.store.subscribe((mutation: any) => {
      try {
        if (this.shouldTrackMutation(mutation)) {
          this.addBreadcrumb({
            type: 'vuex',
            message: `Vuex: ${mutation.type}`,
            category: 'vuex',
            data: {
              mutation: mutation.type,
              payload: mutation.payload
            }
          });
        }
      } catch (error) {
        console.warn('Failed to track Vuex mutation:', error);
      }
    });

    if (this.options.debug) {
      console.log('Vue integration configured');
    }
  }

  private setupRouterIntegration(): void {
    if (!this.router) {
      console.warn('Vue router not provided, route tracking disabled');
      return;
    }

    this.router.afterEach((to: any, from: any) => {
      try {
        this.handleRouteChange(to, from);
      } catch (error) {
        console.warn('Failed to handle route change:', error);
      }
    });

    if (this.options.debug) {
      console.log('Router integration configured');
    }
  }

  private setupErrorHandling(): void {
    if (this.options.debug) {
      console.log('Error handling configured');
    }
  }

  handleDataReport(data: any): boolean | void {
    try {
      if (this.options.debug) {
        console.log('🔍 MitoJS Data Report:', {
          type: data.type,
          timestamp: data.t || Date.now(),
          data
        });
      }

      if (!shouldReport(data)) {
        if (this.options.debug) {
          console.log('⏭️ Data filtered by sampling rate:', data.type);
        }
        return false;
      }

      const slsData = transformDataForSLS(data, {
        store: this.store,
        router: this.router
      });

      this.sendToSLS(slsData);

      return false;
    } catch (error) {
      console.error('Failed to handle data report:', error);
      return false;
    }
  }

  handleRouteChange(to: any, from: any): void {
    try {
      const routeData = {
        type: 'route',
        from: {
          path: from.fullPath,
          name: from.name,
          params: from.params,
          query: from.query
        },
        to: {
          path: to.fullPath,
          name: to.name,
          params: to.params,
          query: to.query
        },
        timestamp: Date.now()
      };

      this.addBreadcrumb({
        type: 'route',
        message: `Route: ${from.fullPath} -> ${to.fullPath}`,
        category: 'navigation',
        data: routeData
      });

      if (shouldReport(routeData)) {
        const slsData = transformDataForSLS(routeData, {
          store: this.store,
          router: this.router
        });
        this.sendToSLS(slsData);
      }
    } catch (error) {
      console.error('Failed to handle route change:', error);
    }
  }

  handleError(error: any): void {
    try {
      const errorData = {
        type: 'error',
        message: error?.message || 'Unknown error',
        stack: error?.stack,
        name: error?.name,
        timestamp: Date.now()
      };

      this.addBreadcrumb({
        type: 'error',
        message: errorData.message,
        category: 'error',
        data: errorData
      });

      if (shouldReport(errorData)) {
        const slsData = transformDataForSLS(errorData, {
          store: this.store,
          router: this.router
        });
        this.sendToSLS(slsData);
      }
    } catch (e) {
      console.error('Failed to handle error:', e);
    }
  }

  async sendToSLS(data: any): Promise<void> {
    try {
      if (!this.slsAdapter) {
        if (this.options.debug) {
          console.log('📝 RUM Data [SIMULATION MODE]:', data);
        }
        return;
      }

      const slsLogData = this.transformDataForSLSLog(data);
      if (this.options.debug) {
        console.log('🔧 Transformed SLS Log Data:', slsLogData);
      }

      await this.slsAdapter.sendLog(slsLogData);

      if (this.options.debug) {
        console.log('✅ RUM Data sent to SLS successfully');
      }
    } catch (error) {
      console.error('❌ Failed to send data to SLS:', error);

      if (this.options.debug) {
        console.log('🔄 RUM Data [FALLBACK MODE]:', data);
      }
    }
  }

  transformDataForSLSLog(data: any): any {
    return {
      eventType: data.dataType || data.event?.type || 'unknown',
      category: this.getEventCategory(data.dataType),
      level: this.getEventLevel(data.dataType),
      ...data.event,
      ...data.dimensions,
      ...data.rawData
    };
  }

  getEventCategory(dataType: string): string {
    switch (dataType) {
      case 'error':
        return 'error';
      case 'performance':
        return 'performance';
      case 'click':
      case 'route':
        return 'user';
      case 'xhr':
        return 'general';
      default:
        return 'general';
    }
  }

  getEventLevel(dataType: string): string {
    switch (dataType) {
      case 'error':
        return 'error';
      case 'xhr':
        return 'warn';
      default:
        return 'info';
    }
  }

  getUserInfoFromStore(): any {
    try {
      const user = this.store?.state?.user || {};
      return {
        userId: user.userId || user.id,
        userName: user.userName || user.name,
        accountId: user.accountId
      };
    } catch (error) {
      console.warn('Failed to get user info from store:', error);
      return {};
    }
  }

  shouldTrackMutation(mutation: any): boolean {
    const ignoredMutations = ['SET_LOADING', 'SET_CURRENT_PAGE', 'UPDATE_MOUSE_POSITION'];
    return !ignoredMutations.includes(mutation.type);
  }

  trackEvent(eventData: Record<string, any>): void {
    try {
      const customData = {
        type: 'custom',
        timestamp: Date.now(),
        ...eventData
      };

      this.addBreadcrumb({
        type: 'custom',
        message: `Custom Event: ${eventData.name || 'unknown'}`,
        category: 'custom',
        data: customData
      });

      if (shouldReport(customData)) {
        const slsData = transformDataForSLS(customData, {
          store: this.store,
          router: this.router
        });
        this.sendToSLS(slsData);
      }
    } catch (error) {
      console.error('Failed to track custom event:', error);
    }
  }

  setUser(userInfo: {
    userId?: string;
    userName?: string;
    email?: string;
    accountId?: string;
    roles?: string[];
  }): void {
    try {
      if (this.mitoInstance && this.mitoInstance.setUser) {
        this.mitoInstance.setUser({
          id: userInfo.userId,
          username: userInfo.userName,
          email: userInfo.email
        });
      }

      if (this.slsAdapter && userInfo.userId) {
        this.slsAdapter.setUserId(userInfo.userId);
      }
    } catch (error) {
      console.error('Failed to set user info:', error);
    }
  }

  getBreadcrumbs(): any[] {
    try {
      return this.mitoInstance?.getBreadcrumbs?.() || [];
    } catch (error) {
      console.error('Failed to get breadcrumbs:', error);
      return [];
    }
  }

  destroy(): void {
    try {
      if (typeof window !== 'undefined') {
        window.removeEventListener('error', this.handleError as any);
        window.removeEventListener(
          'unhandledrejection',
          this.handleError as any
        );
      }

      if (this.mitoInstance && this.mitoInstance.destroy) {
        this.mitoInstance.destroy();
      }

      if (this.slsAdapter) {
        this.slsAdapter.destroy();
      }

      this.isInitialized = false;
      if (this.options.debug) {
        console.log('MitoSLSAdapter destroyed');
      }
    } catch (error) {
      console.error('Failed to destroy MitoSLSAdapter:', error);
    }
  }
}

let instance: MitoSLSAdapter | null = null;

export const getMitoAdapter = (
  options: Partial<MitoSLSAdapterOptions> = {}
): MitoSLSAdapter => {
  if (!instance) {
    instance = new MitoSLSAdapter(options);
  }
  return instance;
};

export const initRUMCore = async (
  context: TransformContext & { Vue?: any },
  options: Partial<MitoSLSAdapterOptions> = {}
): Promise<MitoSLSAdapter> => {
  const adapter = getMitoAdapter(options);
  await adapter.init(context);
  return adapter;
};

export const getRUMCoreInstance = (): MitoSLSAdapter | null => instance;
