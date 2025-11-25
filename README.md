# polyv-rum-sdk

Polyv RUM SDK，基于 **MitoJS + 阿里云 SLS Web Tracking** 的前端监控采集与日志上报库，支持：

- Core：与框架无关的采集与上报逻辑（MitoJS + SLS）。
- Vue2：与现有 `live-admin-v3` 的 RUM 使用方式 100% 兼容。
- Vue3：提供插件工厂与 `useRUM` composable。

## 安装

```bash
npm install polyv-rum-sdk
# 或者使用 pnpm / yarn
```

> 作为依赖使用时，不需要再单独安装 `@mitojs/browser` 和 `@aliyun-sls/web-track-browser`，它们已作为依赖内置。

## 环境变量

SDK 通过 `window.VUE_APP_ENV` 或 `process.env` 读取以下变量（与 `live-admin-v3` 保持一致）：

- SLS 相关
  - `VUE_APP_SLS_HOST`
  - `VUE_APP_SLS_PROJECT`
  - `VUE_APP_SLS_LOGSTORE`
  - `VUE_APP_SLS_ENABLED`
- RUM 相关
  - `VUE_APP_RUM_DSN`
  - `VUE_APP_RUM_DEBUG`
  - `VUE_APP_RUM_ENABLED`
- 通用
  - `NODE_ENV`
  - `MODE`
  - `PACKAGE_VERSION`

## 使用方式

### Vue 2 项目（推荐）

```js
// main.js
import Vue from 'vue';
import router from './router';
import store from './store';
import { initRUMSystemVue2 as initRUMSystem } from 'polyv-rum-sdk';

initRUMSystem(
  { store, router, Vue },
  {
    debug: import.meta.env.VUE_APP_RUM_DEBUG === 'true',
    environment:
      import.meta.env.MODE || import.meta.env.NODE_ENV || 'development'
  }
);
```

业务代码中可以仍然通过 `this.$rum.xxx` 使用（在 `live-admin-v3` 中通过 alias 或统一替换即可）：

```js
this.$rum.trackEvent('event_name', { foo: 'bar' });
```

可用方法：

- `trackEvent(eventName, eventData?)`
- `trackPerformance(performanceData)`
- `trackAction(action, actionData?)`
- `trackMetric(metricName, value, dimensions?)`
- `getBreadcrumbs()`
- `enableRUM()` / `disableRUM()`
- `getRUMConfig()` / `destroyRUM()`

### Vue 3 项目（示例）

```ts
import { createApp } from 'vue';
import { createRUMPluginVue3 } from 'polyv-rum-sdk';

const app = createApp(App);

app
  .use(store)
  .use(router)
  .use(
    createRUMPluginVue3({
      store,
      router,
      coreOptions: {
        debug: import.meta.env.VUE_APP_RUM_DEBUG === 'true'
      }
    })
  )
  .mount('#app');
```

在组件中：

```ts
import { useRUM } from 'polyv-rum-sdk';

const rum = useRUM();
rum?.trackEvent('event_name');
```

### Core 能力（非框架场景）

```ts
import { initRUMCore } from 'polyv-rum-sdk';

const adapter = await initRUMCore({});
adapter.trackEvent({ name: 'custom', foo: 'bar' });
```

## 本地开发

```bash
# 安装依赖
npm install

# 构建
npm run build

# 运行单元测试
npm test

# 开发模式打包（watch）
npm run dev
```

## 发布与 GitHub Actions

本仓库自带一个 GitHub Actions 工作流 `.github/workflows/publish.yml`，用于在打 tag 时自动发布到 npm。

### 前置配置

1. 在 GitHub 仓库的 **Settings → Secrets and variables → Actions → New repository secret** 中添加：
   - `NPM_TOKEN`: 拥有 `npm publish` 权限的 token。
2. 确认 `package.json` 中的包名 `"polyv-rum-sdk"` 在 npm 上可用（未被他人占用）。

### 发布流程

1. 在本地修改 `package.json` 的 `version` 字段，或使用：

   ```bash
   npm version patch   # 或 minor / major
   ```

2. 推送 tag：

   ```bash
   git push origin --tags
   ```

3. GitHub Actions 会在检测到 tag（形如 `v1.2.3`）后自动：
   - 安装依赖
   - 运行 `npm test`
   - 运行 `npm run build`
   - 执行 `npm publish --access public`

如需手动发布，也可以在本地执行：

```bash
npm test
npm run build
npm publish --access public
```

确保本地已通过 `npm login` 并具有发布权限。
