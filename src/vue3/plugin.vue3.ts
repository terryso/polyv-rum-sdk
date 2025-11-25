import type { App } from 'vue';
import * as Vue from 'vue';
import type { MitoSLSAdapterOptions } from '../core/MitoSLSAdapter';
import { RUMManagerVue3 } from './RUMManager.vue3';

export interface RUMVue3PluginOptions {
  store?: any;
  router?: any;
  coreOptions?: Partial<MitoSLSAdapterOptions>;
}

export function createRUMPluginVue3(options: RUMVue3PluginOptions) {
  const manager = new RUMManagerVue3();

  return {
    install(app: App) {
      manager.init(
        { store: options.store, router: options.router },
        options.coreOptions || {}
      );

      (app.config.globalProperties as any).$rum = {
        trackEvent: manager.trackEvent.bind(manager),
        trackPerformance: manager.trackPerformance.bind(manager),
        trackAction: manager.trackAction.bind(manager),
        trackMetric: manager.trackMetric.bind(manager),
        getBreadcrumbs: manager.getBreadcrumbs.bind(manager),
        enable: manager.enable.bind(manager),
        disable: manager.disable.bind(manager),
        getConfig: manager.getConfig.bind(manager)
      };

      app.provide('rum', manager);
    }
  };
}

export function useRUM(): RUMManagerVue3 | undefined {
  return Vue.inject<RUMManagerVue3>('rum');
}
