export interface RUMEnv {
  [key: string]: string | undefined;
}

export const getRUMEnv = (): RUMEnv => {
  if (typeof window !== 'undefined' && (window as any).VUE_APP_ENV) {
    return (window as any).VUE_APP_ENV as RUMEnv;
  }

  if (typeof process !== 'undefined' && (process as any).env) {
    return (process as any).env as RUMEnv;
  }

  return {};
};

export const RUM_ENV: RUMEnv = getRUMEnv();
