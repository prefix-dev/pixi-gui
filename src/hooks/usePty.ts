import { useEffect, useRef, useState } from "react";

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

export function usePty(options: {
  id: string;
  onStart?: (event: PtyStartEvent) => void;
  onExit?: (event: PtyExitEvent) => void;
}): PtyState {
  const { id, onStart, onExit } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isKilling, setIsKilling] = useState(false);

  // Refs for synchronous guards against concurrent calls
  const startingRef = useRef(false);
  const killingRef = useRef(false);

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
    if (killingRef.current || !isRunning) return;

    killingRef.current = true;
    setIsKilling(true);
    try {
      await killPty(id);
    } catch (error) {
      console.error("Failed to kill PTY:", error);
      killingRef.current = false;
      setIsKilling(false);
    }
  };

  useEffect(() => {
    const unsubscribeStart = subscribe<PtyStartEvent>("pty-start", (event) => {
      if (event.id !== id) return;
      startingRef.current = false;
      killingRef.current = false;
      setIsRunning(true);
      setIsStarting(false);
      setIsKilling(false);
      onStart?.(event);
    });

    const unsubscribeExit = subscribe<PtyExitEvent>("pty-exit", (event) => {
      if (event.id !== id) return;
      startingRef.current = false;
      killingRef.current = false;
      setIsRunning(false);
      setIsStarting(false);
      setIsKilling(false);
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
