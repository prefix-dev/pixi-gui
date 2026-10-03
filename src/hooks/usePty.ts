import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { subscribe } from "@/lib/event";
import {
  type PtyExitEvent,
  type PtyInvocation,
  type PtyStartEvent,
  createPty,
  isPtyRunning,
  killPty,
} from "@/lib/pty";

export interface PtyState {
  isRunning: boolean;
  isStarting: boolean;
  isKilling: boolean;
  isBusy: boolean;
  start: (
    invocation: PtyInvocation,
    cols: number,
    rows: number,
  ) => Promise<void>;
  kill: () => Promise<void>;
  id: string;
}

const killingPtyIds = new Set<string>();
const killListeners = new Set<() => void>();

function subscribeKill(callback: () => void) {
  killListeners.add(callback);
  return () => {
    killListeners.delete(callback);
  };
}

function notifyKillStatusChange() {
  killListeners.forEach((callback) => callback());
}

export function usePty(options: {
  id: string;
  onStart?: (event: PtyStartEvent) => void;
  onExit?: (event: PtyExitEvent) => void;
}): PtyState {
  const { id, onStart, onExit } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const isKilling = useSyncExternalStore(
    subscribeKill,
    () => killingPtyIds.has(id),
    () => false,
  );

  // Refs for synchronous guards against concurrent calls
  const startingRef = useRef(false);

  const start = async (
    invocation: PtyInvocation,
    cols: number,
    rows: number,
  ) => {
    if (startingRef.current || isRunning) return;

    startingRef.current = true;
    setIsStarting(true);
    try {
      await createPty(id, invocation, cols, rows);
      setIsRunning(true);
    } catch (error) {
      console.error("Failed to start PTY:", error);
      startingRef.current = false;
      setIsStarting(false);
    }
  };

  const kill = async () => {
    if (killingPtyIds.has(id) || !isRunning) return;

    killingPtyIds.add(id);
    notifyKillStatusChange();
    try {
      await killPty(id);
    } catch (error) {
      console.error("Failed to kill PTY:", error);
      killingPtyIds.delete(id);
      notifyKillStatusChange();
    }
  };

  useEffect(() => {
    const unsubscribeStart = subscribe<PtyStartEvent>("pty-start", (event) => {
      if (event.id !== id) return;
      startingRef.current = false;
      setIsRunning(true);
      setIsStarting(false);

      killingPtyIds.delete(id);
      notifyKillStatusChange();

      onStart?.(event);
    });

    const unsubscribeExit = subscribe<PtyExitEvent>("pty-exit", (event) => {
      if (event.id !== id) return;
      startingRef.current = false;
      setIsRunning(false);
      setIsStarting(false);

      killingPtyIds.delete(id);
      notifyKillStatusChange();

      onExit?.(event);
    });

    void (async () => {
      try {
        const running = await isPtyRunning(id);
        setIsRunning(running);
      } catch (error) {
        console.error("Failed to determine PTY state:", error);
      }
    })();

    return () => {
      unsubscribeStart();
      unsubscribeExit();
    };
  }, [id, onExit, onStart]);

  return {
    isRunning,
    isStarting,
    isKilling,
    isBusy: isStarting || isKilling,
    start,
    kill,
    id,
  };
}
