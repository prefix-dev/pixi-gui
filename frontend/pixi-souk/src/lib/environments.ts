import { useSyncExternalStore } from "react";

import type { GlobalEnvironment } from "shared/lib/pixi/global/list";

let busy: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

/** Marks the environment as being installed or uninstalled */
export function setBusyEnvironment(
  environmentName: string,
  channelUrl: string,
  value: boolean,
) {
  const key = `${channelUrl}/${environmentName}`;
  const next = new Set(busy);
  if (value) {
    next.add(key);
  } else {
    next.delete(key);
  }
  busy = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Whether the environment is currently being installed or uninstalled */
export function useIsBusyEnvironment(
  environmentName: string,
  channelUrl: string,
): boolean {
  const key = `${channelUrl}/${environmentName}`;
  return useSyncExternalStore(subscribe, () => busy.has(key));
}

/** Whether an environment named `environmentName` is being installed or uninstalled, from any channel */
export function isBusyEnvironmentName(environmentName: string): boolean {
  return [...busy].some((key) => key.endsWith(`/${environmentName}`));
}

/** The environment providing the package `packageName` from the channel at `channelUrl` */
export function findEnvironment(
  environments: GlobalEnvironment[],
  packageName: string,
  channelUrl: string,
): GlobalEnvironment | undefined {
  return environments.find(
    (environment) =>
      environment.channels.some(({ url }) => url === channelUrl) &&
      environment.dependencies.some(
        (dependency) => dependency.name === packageName,
      ),
  );
}
