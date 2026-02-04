import { openUrl } from "@tauri-apps/plugin-opener";
import { FitAddon } from "@xterm/addon-fit";
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
}

export function Terminal({ id, isRunning }: TerminalProps) {
  const { instance, ref } = useXTerm({
    options: {
      theme: { background: "#000000" },
      cursorBlink: true,
      cursorStyle: "block",
    },
  });
  const restoredBuffer = useRef(false);

  const isRunningRef = useRef(isRunning);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    if (!instance) return;

    // Restore terminal buffer
    if (!restoredBuffer.current) {
      getPtyBuffer(id)
        .then((buffer) => {
          if (!restoredBuffer.current && buffer) {
            instance.reset();
            instance.write(buffer);
          }
          restoredBuffer.current = true;
        })
        .catch((error) => {
          console.error("Failed to load PTY buffer:", error);
          restoredBuffer.current = true;
        });
    }

    // PTY Data -> Terminal
    const unsubscribeData = subscribe<PtyDataEvent>("pty-data", (event) => {
      if (id !== event.id) return;
      instance.write(event.data);
      restoredBuffer.current = true;
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
    if (isRunningRef.current) {
      resizePty(id, instance.cols, instance.rows).catch((error) => {
        console.error("Failed to resize PTY:", error);
      });
    }

    return () => {
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
