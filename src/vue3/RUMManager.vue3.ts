import type { TransformContext } from '../core/config';
import type { MitoSLSAdapterOptions } from '../core/MitoSLSAdapter';
import { RUMManagerVue2 } from '../vue2/RUMManager.vue2';

export interface RUMManagerContextVue3 extends TransformContext {}

export class RUMManagerVue3 {
  private inner = new RUMManagerVue2();

  init(
    context: RUMManagerContextVue3,
    options: Partial<MitoSLSAdapterOptions> = {}
  ): Promise<void> {
    return this.inner.init(context as any, options);
  }

  trackEvent(eventName: string, eventData: Record<string, any> = {}): void {
    this.inner.trackEvent(eventName, eventData);
  }

  trackPerformance(performanceData: Record<string, any>): void {
    this.inner.trackPerformance(performanceData);
  }

  trackAction(action: string, actionData: Record<string, any> = {}): void {
    this.inner.trackAction(action, actionData);
  }

  trackMetric(
    metricName: string,
    value: number,
    dimensions: Record<string, any> = {}
  ): void {
    this.inner.trackMetric(metricName, value, dimensions);
  }

  getBreadcrumbs(): any[] {
    return this.inner.getBreadcrumbs();
  }

  enable(): void {
    this.inner.enable();
  }

  disable(): void {
    this.inner.disable();
  }

  getConfig(): Record<string, any> {
    return this.inner.getConfig();
  }

  destroy(): void {
    this.inner.destroy();
  }
}
