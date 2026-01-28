import { mitoConfig, slsConfig, type TransformContext } from '../core/config';
import { getRUMEnv } from '../core/env';
import {
  initRUMCore,
  type MitoSLSAdapterOptions
} from '../core/MitoSLSAdapter';

export interface RUMManagerContext extends TransformContext {
  // React 不需要额外的上下文
}

// React 用户信息更新回调类型
export type UserChangeCallback = (user: {
  userId?: string;
  userName?: string;
  email?: string;
  accountId?: string;
  roles?: string[];
} | null) => void;

export class RUMManagerReact {
  private adapter: any = null;
  private isInitialized = false;
  private isEnabled = true;
  private context: RUMManagerContext = {};
  private previousLocation: { pathname: string; search: string; hash: string } | null = null;

  async init(
    context: RUMManagerContext = {},
    options: Partial<MitoSLSAdapterOptions> = {}
  ): Promise<void> {
    try {
      if (!this.shouldEnableRUM()) {
        if (mitoConfig.debug) {
          console.log('[RUM] RUM system is disabled');
        }
        return;
      }

      if (this.isInitialized) {
        if (mitoConfig.debug) {
          console.log('[RUM] RUM system already initialized');
        }
        return;
      }

      this.context = {
        store: context.store,
        router: context.router,
        ...context
      };

      const mergedOptions: Partial<MitoSLSAdapterOptions> = {
        ...mitoConfig,
        ...options,
        // React 项目不设置 Vue 框架配置
        ...(options.framework === 'react' ? { framework: 'react' } : {}),
      };

      this.adapter = await initRUMCore(
        {
          store: this.context.store,
          router: this.context.router,
        },
        mergedOptions
      );

      this.setupUserInteractionTracking();

      this.isInitialized = true;
      if (mitoConfig.debug) {
        console.log('[RUM] RUM system initialized successfully');
      }
    } catch (error) {
      console.error('[RUM] Failed to initialize RUM system:', error);
    }
  }

  private shouldEnableRUM(): boolean {
    if (!this.isEnabled) {
      return false;
    }

    const env = getRUMEnv();

    // 支持 VUE_APP_RUM_ENABLED（兼容性）和 VITE_RUM_ENABLED（React/Vite）
    const rumEnabled = (env as any).VUE_APP_RUM_ENABLED || (env as any).VITE_RUM_ENABLED;
    if (rumEnabled !== undefined) {
      return rumEnabled === 'true';
    }

    const mode = (env as any).MODE || (env as any).NODE_ENV;
    const isProdEnv = mode === 'prod' || mode === 'production';

    return !isProdEnv;
  }

  /**
   * 设置 React Router 路由监听
   * 在路由变化时调用此方法
   */
  handleRouteChange(location: { pathname: string; search: string; hash: string }): void {
    if (!this.adapter || !this.previousLocation) {
      this.previousLocation = location;
      return;
    }

    // 只在路由实际变化时上报
    if (location.pathname !== this.previousLocation.pathname) {
      if (typeof this.adapter.handleRouteChange === 'function') {
        this.adapter.handleRouteChange(
          { path: location.pathname, search: location.search, hash: location.hash },
          { path: this.previousLocation.pathname, search: this.previousLocation.search, hash: this.previousLocation.hash }
        );
      }
    }
    this.previousLocation = location;
  }

  private setupUserInteractionTracking(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    document.addEventListener(
      'click',
      (event: MouseEvent) => {
        try {
          const originalTarget = event.target as HTMLElement | null;

          const findClosest = (el: any, selector: string): HTMLElement | null =>
            el && typeof el.closest === 'function' ? el.closest(selector) : null;

          let target = findClosest(originalTarget, '[rum-id],[rum-name]');

          if (!target) {
            target = findClosest(
              originalTarget,
              'button, a, [role="button"], [role="link"]'
            );
          }

          if (!target && originalTarget && window.getComputedStyle) {
            const style = window.getComputedStyle(originalTarget);
            if (style.cursor === 'pointer') {
              target = originalTarget;
            }
          }

          if (!target) {
            return;
          }

          const getAttr = (el: any, name: string): string | null =>
            el && typeof el.getAttribute === 'function'
              ? el.getAttribute(name)
              : null;

          let bizId =
            getAttr(target, 'rum-id') || getAttr(target, 'rum-name') || '';

          if (!bizId) {
            const tagName = target.tagName
              ? target.tagName.toLowerCase()
              : 'element';

            const classList = (target.className || '')
              .toString()
              .split(/\s+/)
              .filter((c: string) => c.trim());
            const primaryClass = classList[0] || 'no-class';

            const getLabel = (el: any): string => {
              if (!el) return '';
              const text = (el.textContent || '').trim();
              if (text) return text;
              const ariaLabel = getAttr(el, 'aria-label');
              if (ariaLabel) return ariaLabel;
              const title = getAttr(el, 'title');
              if (title) return title;
              const alt = getAttr(el, 'alt');
              if (alt) return alt;
              const placeholder = getAttr(el, 'placeholder');
              if (placeholder) return placeholder;
              const value = typeof el.value === 'string' ? el.value.trim() : '';
              if (value) return value;
              return '';
            };

            const label = getLabel(target);
            const safeLabel =
              (label || primaryClass).replace(/\s+/g, '_').slice(0, 32) ||
              'no_label';

            const routeKey = window.location.pathname || 'unknown_route';

            let indexSuffix = '';
            try {
              const parent = target.parentNode as HTMLElement | null;
              if (parent && parent.children && parent.children.length) {
                const siblings = Array.from(parent.children).filter(
                  (el) =>
                    el.tagName === target.tagName &&
                    (el as HTMLElement).className === target.className
                );
                const index = siblings.indexOf(target);
                if (index >= 0) {
                  indexSuffix = `[${index}]`;
                }
              }
            } catch {
              // ignore
            }

            bizId = `${routeKey}|${tagName}.${primaryClass}${indexSuffix}|${safeLabel}`;
          }

          const targetInfo = {
            tagName: target.tagName,
            className: target.className,
            id: target.id,
            textContent: target.textContent?.substring(0, 50) || '',
            selector: this.getCSSSelector(target)
          };

          this.trackAction('click', {
            type: 'click',
            bizId,
            x: event.clientX,
            y: event.clientY,
            target: targetInfo,
            page: {
              url: window.location.href,
              title: document.title,
              path: window.location.pathname
            },
            timestamp: Date.now()
          });
        } catch (error) {
          console.warn('[RUM] Failed to track click event:', error);
        }
      },
      true
    );

    if (mitoConfig.debug) {
      console.log('[RUM] User interaction tracking configured');
    }
  }

  private getCSSSelector(element: Element | null): string {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return '';
    }

    const path: string[] = [];
    let current: Element | null = element;

    while (current && current.nodeType === Node.ELEMENT_NODE) {
      let selector = current.tagName.toLowerCase();

      if (current.id) {
        selector += `#${current.id}`;
        path.unshift(selector);
        break;
      }

      if ((current as HTMLElement).className) {
        const classes = (current as HTMLElement).className
          .split(' ')
          .filter((c) => c.trim());
        if (classes.length > 0) {
          selector += `.${classes[0]}`;
        }
      }

      path.unshift(selector);
      current = current.parentElement;

      if (path.length > 5) {
        break;
      }
    }

    return path.join(' > ');
  }

  trackEvent(eventName: string, eventData: Record<string, any> = {}): void {
    if (!this.checkRUMAvailable()) {
      return;
    }

    try {
      this.adapter.trackEvent({
        name: eventName,
        ...eventData
      });
    } catch (error) {
      console.error('[RUM] Failed to track event:', error);
    }
  }

  trackPerformance(performanceData: Record<string, any>): void {
    if (!this.checkRUMAvailable()) {
      return;
    }

    try {
      this.adapter.trackEvent({
        name: 'performance',
        type: 'performance',
        ...performanceData
      });
    } catch (error) {
      console.error('[RUM] Failed to track performance:', error);
    }
  }

  trackAction(action: string, actionData: Record<string, any> = {}): void {
    if (!this.checkRUMAvailable()) {
      return;
    }

    try {
      this.adapter.trackEvent({
        name: 'user_action',
        action,
        ...actionData
      });
    } catch (error) {
      console.error('[RUM] Failed to track action:', error);
    }
  }

  trackMetric(
    metricName: string,
    value: number,
    dimensions: Record<string, any> = {}
  ): void {
    if (!this.checkRUMAvailable()) {
      return;
    }

    try {
      this.adapter.trackEvent({
        name: 'metric',
        metricName,
        value,
        dimensions
      });
    } catch (error) {
      console.error('[RUM] Failed to track metric:', error);
    }
  }

  /**
   * 设置用户信息
   * 在用户登录后调用
   */
  setUser(userInfo: {
    userId?: string;
    userName?: string;
    email?: string;
    accountId?: string;
    roles?: string[];
  }): void {
    if (!this.adapter) {
      return;
    }

    try {
      this.adapter.setUser(userInfo);
      if (mitoConfig.debug) {
        console.log('[RUM] User info set:', userInfo);
      }
    } catch (error) {
      console.error('[RUM] Failed to set user info:', error);
    }
  }

  /**
   * 清除用户信息
   * 在用户登出后调用
   */
  clearUser(): void {
    if (!this.adapter) {
      return;
    }

    try {
      this.adapter.setUser({});
      if (mitoConfig.debug) {
        console.log('[RUM] User info cleared');
      }
    } catch (error) {
      console.error('[RUM] Failed to clear user info:', error);
    }
  }

  getBreadcrumbs(): any[] {
    if (!this.checkRUMAvailable()) {
      return [];
    }

    try {
      return this.adapter.getBreadcrumbs();
    } catch (error) {
      console.error('[RUM] Failed to get breadcrumbs:', error);
      return [];
    }
  }

  enable(): void {
    this.isEnabled = true;
    if (mitoConfig.debug) {
      console.log('[RUM] RUM system enabled');
    }
  }

  disable(): void {
    this.isEnabled = false;
    if (mitoConfig.debug) {
      console.log('[RUM] RUM system disabled');
    }
  }

  private checkRUMAvailable(): boolean {
    return this.isEnabled && this.isInitialized && !!this.adapter;
  }

  getConfig(): Record<string, any> {
    return {
      isInitialized: this.isInitialized,
      isEnabled: this.isEnabled,
      environment: mitoConfig.environment,
      debug: mitoConfig.debug,
      sls: {
        enabled: slsConfig.enabled,
        configured: true,
        project: slsConfig.project,
        logstore: slsConfig.logstore
      }
    };
  }

  destroy(): void {
    try {
      if (this.adapter) {
        this.adapter.destroy();
        this.adapter = null;
      }

      this.isInitialized = false;
      this.context = {} as RUMManagerContext;
      this.previousLocation = null;
      if (mitoConfig.debug) {
        console.log('[RUM] RUM system destroyed');
      }
    } catch (error) {
      console.error('[RUM] Failed to destroy RUM system:', error);
    }
  }
}
