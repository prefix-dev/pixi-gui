import { invoke } from "@/lib/api/transport";

export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
}

export function createStore(store: string): Store {
  return {
    get: async <T>(key: string) =>
      (await invoke<T | null>("settings_get", { store, key })) ?? undefined,
    set: async (key, value) => {
      await invoke<void>("settings_set", { store, key, value });
    },
  };
}
