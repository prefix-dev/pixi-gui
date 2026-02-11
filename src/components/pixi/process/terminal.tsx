import { openUrl } from "@tauri-apps/plugin-opener";
import { FitAddon } from "@xterm/addon-fit";
import { Unicode11Addon } from "@xterm/addon-unicode11";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useEffect, useRef } from "react";
import { useXTerm } from "react-xtermjs";

import { subscribe } from "@/lib/event";
import {
  type PtyDataEvent,
  getPtyBuffer,
  resizePty,
  writePty,
} from "@/lib/pty";

interface TerminalProps {
  id: string;
  isRunning: boolean;
  onDimensionsChange?: (cols: number, rows: number) => void;
}

export function Terminal({ id, isRunning, onDimensionsChange }: TerminalProps) {
  const { instance, ref } = useXTerm({
    options: {
      theme: { background: "#000000" },
      cursorBlink: true,
      cursorStyle: "block",
      allowProposedApi: true,
    },
    addons: [
      {
        activate(terminal: import("@xterm/xterm").Terminal) {
          const inner = new Unicode11Addon();
          inner.activate(terminal);
          terminal.unicode.activeVersion = "11";
        },
        dispose() {},
      },
    ],
  });
  const isRunningRef = useRef(isRunning);
  const onDimensionsChangeRef = useRef(onDimensionsChange);
  const bufferLoaded = useRef(false);
  const pendingData = useRef<string[]>([]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    onDimensionsChangeRef.current = onDimensionsChange;
  }, [onDimensionsChange]);

  useEffect(() => {
    if (!instance) return;

    bufferLoaded.current = false;
    pendingData.current = [];

    // Restore terminal buffer. Events are queued until the buffer
    // is loaded to prevent mixing stale and fresh output.
    getPtyBuffer(id)
      .then((buffer) => {
        if (bufferLoaded.current) return;
        bufferLoaded.current = true;
        if (buffer) instance.write(buffer);
        for (const data of pendingData.current) instance.write(data);
        pendingData.current = [];
      })
      .catch((error) => {
        if (bufferLoaded.current) return;
        bufferLoaded.current = true;
        console.error("Failed to load PTY buffer:", error);
        for (const data of pendingData.current) instance.write(data);
        pendingData.current = [];
      });

    // Reset terminal when a new PTY session starts
    const unsubscribeStart = subscribe<{ id: string }>("pty-start", (event) => {
      if (id !== event.id) return;
      instance.reset();
      bufferLoaded.current = true;
      pendingData.current = [];
    });

    // PTY Data -> Terminal
    const unsubscribeData = subscribe<PtyDataEvent>("pty-data", (event) => {
      if (id !== event.id) return;
      if (!bufferLoaded.current) {
        pendingData.current.push(event.data);
        return;
      }
      instance.write(event.data);
    });

    // Terminal Input -> Write PTY
    const onDataDispose = instance.onData((data) => {
      if (!isRunningRef.current) return;
      writePty(id, data).catch((error) => {
        console.error("Failed to write to PTY:", error);
      });
    });

    // Terminal Resize -> Resize PTY
    const fitAddon = new FitAddon();
    instance.loadAddon(fitAddon);
    const applyFit = () => {
      fitAddon.fit();
    };
    window.addEventListener("resize", applyFit);

    const onResizeDispose = instance.onResize(({ cols, rows }) => {
      onDimensionsChangeRef.current?.(cols, rows);
      if (!isRunningRef.current) return;
      resizePty(id, cols, rows).catch((error) => {
        console.error("Failed to resize PTY:", error);
      });
    });

    // Clickable links
    const webLinksAddon = new WebLinksAddon((_event, uri) => {
      openUrl(uri).catch((error) => {
        console.error("Failed to open URL:", error, uri);
      });
    });
    instance.loadAddon(webLinksAddon);

    //  ctrl + c for copy when selecting data, default otherwise
    instance.attachCustomKeyEventHandler((arg) => {
      if (arg.ctrlKey && arg.code === "KeyC" && arg.type === "keydown") {
        const selection = instance.getSelection();
        if (selection) {
          navigator.clipboard.writeText(selection);
          return false;
        }
      }
      return true;
    });

    // Set initial PTY size
    applyFit();
    onDimensionsChangeRef.current?.(instance.cols, instance.rows);
    if (isRunningRef.current) {
      resizePty(id, instance.cols, instance.rows).catch((error) => {
        console.error("Failed to resize PTY:", error);
      });
    }

    return () => {
      unsubscribeStart();
      unsubscribeData();
      onDataDispose.dispose();
      onResizeDispose.dispose();
      window.removeEventListener("resize", applyFit);
      fitAddon.dispose();
      webLinksAddon.dispose();
    };
  }, [id, instance]);

  return (
    <div
      style={{ width: "100%", height: "100%" }}
      className="rounded-pfx-s border border-pfxd-card-border bg-black p-pfx-s"
    >
      <div
        style={{ width: "100%", height: "100%" }}
        className={isRunning ? "" : "[&_.xterm-cursor]:hidden!"}
        ref={ref}
      />
    </div>
  );
}
