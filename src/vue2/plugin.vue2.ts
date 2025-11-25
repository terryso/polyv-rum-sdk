import {
  RUMManagerVue2,
  type RUMManagerContext
} from './RUMManager.vue2';
import type { MitoSLSAdapterOptions } from '../core/MitoSLSAdapter';

const rumManagerVue2 = new RUMManagerVue2();

export const initRUMSystem = (
  context: RUMManagerContext,
  options: Partial<MitoSLSAdapterOptions> = {}
) => rumManagerVue2.init(context, options);

export const trackEvent = (
  eventName: string,
  eventData?: Record<string, any>
) => rumManagerVue2.trackEvent(eventName, eventData || {});

export const trackPerformance = (performanceData: Record<string, any>) =>
  rumManagerVue2.trackPerformance(performanceData);

export const trackAction = (
  action: string,
  actionData?: Record<string, any>
) => rumManagerVue2.trackAction(action, actionData || {});

export const trackMetric = (
  metricName: string,
  value: number,
  dimensions?: Record<string, any>
) => rumManagerVue2.trackMetric(metricName, value, dimensions || {});

export const getBreadcrumbs = () => rumManagerVue2.getBreadcrumbs();

export const enableRUM = () => rumManagerVue2.enable();
export const disableRUM = () => rumManagerVue2.disable();
export const getRUMConfig = () => rumManagerVue2.getConfig();
export const destroyRUM = () => rumManagerVue2.destroy();
export const getRUMManager = () => rumManagerVue2;

export const RUMPluginVue2 = {
  install(Vue: any) {
    Vue.prototype.$rum = {
      trackEvent,
      trackPerformance,
      trackAction,
      trackMetric,
      getBreadcrumbs,
      enable: enableRUM,
      disable: disableRUM,
      getConfig: getRUMConfig
    };

    (Vue as any).$rumManager = rumManagerVue2;
  }
};
