import {
  RUMManagerReact,
  type RUMManagerContext
} from './RUMManager.react';
import type { MitoSLSAdapterOptions } from '../core/MitoSLSAdapter';

const rumManagerReact = new RUMManagerReact();

/**
 * 初始化 RUM 系统
 * 在应用启动时调用
 */
export const initRUMSystem = (
  context: RUMManagerContext = {},
  options: Partial<MitoSLSAdapterOptions> = {}
) => rumManagerReact.init(context, options);

/**
 * 路由变化时调用此方法
 * 配合 React Router 的 useLocation hook 使用
 */
export const handleRouteChange = (location: {
  pathname: string;
  search: string;
  hash: string;
}) => rumManagerReact.handleRouteChange(location);

/**
 * 设置用户信息
 * 在用户登录后调用
 */
export const setUser = (userInfo: {
  userId?: string;
  userName?: string;
  email?: string;
  accountId?: string;
  roles?: string[];
}) => rumManagerReact.setUser(userInfo);

/**
 * 清除用户信息
 * 在用户登出后调用
 */
export const clearUser = () => rumManagerReact.clearUser();

/**
 * 手动上报自定义事件
 */
export const trackEvent = (
  eventName: string,
  eventData?: Record<string, any>
) => rumManagerReact.trackEvent(eventName, eventData || {});

/**
 * 手动上报性能数据
 */
export const trackPerformance = (performanceData: Record<string, any>) =>
  rumManagerReact.trackPerformance(performanceData);

/**
 * 手动上报用户行为
 */
export const trackAction = (
  action: string,
  actionData?: Record<string, any>
) => rumManagerReact.trackAction(action, actionData || {});

/**
 * 手动上报指标数据
 */
export const trackMetric = (
  metricName: string,
  value: number,
  dimensions?: Record<string, any>
) => rumManagerReact.trackMetric(metricName, value, dimensions || {});

/**
 * 获取面包屑
 */
export const getBreadcrumbs = () => rumManagerReact.getBreadcrumbs();

/**
 * 启用 RUM
 */
export const enableRUM = () => rumManagerReact.enable();

/**
 * 禁用 RUM
 */
export const disableRUM = () => rumManagerReact.disable();

/**
 * 获取 RUM 配置
 */
export const getRUMConfig = () => rumManagerReact.getConfig();

/**
 * 销毁 RUM
 */
export const destroyRUM = () => rumManagerReact.destroy();

/**
 * 获取 RUM Manager 实例
 */
export const getRUMManager = () => rumManagerReact;

/**
 * React Hook: useRUM
 * 返回 RUM 相关方法
 */
export const useRUM = () => ({
  trackEvent,
  trackPerformance,
  trackAction,
  trackMetric,
  getBreadcrumbs,
  setUser,
  clearUser,
  enable: enableRUM,
  disable: disableRUM,
  getConfig: getRUMConfig,
});
