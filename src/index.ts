export * from './core/env';
export * from './core/config';
export * from './core/MitoSLSAdapter';
export * from './transport/SLSWebTrackingAdapter';

export * as vue2 from './vue2/plugin.vue2';
export {
  initRUMSystem as initRUMSystemVue2,
  trackEvent as trackEventVue2,
  trackPerformance as trackPerformanceVue2,
  trackAction as trackActionVue2,
  trackMetric as trackMetricVue2,
  getBreadcrumbs as getBreadcrumbsVue2,
  enableRUM as enableRUMVue2,
  disableRUM as disableRUMVue2,
  getRUMConfig as getRUMConfigVue2,
  destroyRUM as destroyRUMVue2,
  getRUMManager as getRUMManagerVue2,
  RUMPluginVue2
} from './vue2/plugin.vue2';

export * as vue3 from './vue3/plugin.vue3';
export {
  createRUMPluginVue3,
  useRUM
} from './vue3/plugin.vue3';

export * as react from './react/plugin.react';
export {
  initRUMSystem as initRUMSystemReact,
  trackEvent as trackEventReact,
  trackPerformance as trackPerformanceReact,
  trackAction as trackActionReact,
  trackMetric as trackMetricReact,
  getBreadcrumbs as getBreadcrumbsReact,
  enableRUM as enableRUMReact,
  disableRUM as disableRUMReact,
  getRUMConfig as getRUMConfigReact,
  destroyRUM as destroyRUMReact,
  getRUMManager as getRUMManagerReact,
  handleRouteChange,
  setUser as setRUMUserReact,
  clearUser as clearRUMUserReact,
  useRUM as useRUMReact
} from './react/plugin.react';
