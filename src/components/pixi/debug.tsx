import { getRouteApi } from "@tanstack/react-router";
import { message } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";

import { Row } from "@/components/common/row";
import { Button } from "@/components/shadcn/button";

import { reinstall } from "@/lib/pixi/workspace/reinstall";
import { type PtyHandle, killPty, listPtys } from "@/lib/pty";

export function Debug() {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();

  const [isReinstalling, setIsReinstalling] = useState(false);
  const [activePtys, setActivePtys] = useState<PtyHandle[]>([]);

  const refreshPtys = async () => {
    try {
      const handles = await listPtys();
      setActivePtys(handles);
    } catch (err) {
      console.error("Failed to list PTYs:", err);
    }
  };

  const handleKill = async (id: string) => {
    try {
      await killPty(id);
      await refreshPtys();
    } catch (err) {
      console.error("Unable to kill PTY:", err);
    }
  };

  useEffect(() => {
    refreshPtys();
  }, []);

  const handleReinstall = async () => {
    setIsReinstalling(true);

    try {
      await reinstall(workspace.root);
    } catch (err) {
      console.error("Unable to reinstall:", err);
    } finally {
      setIsReinstalling(false);
    }
  };

  return (
    <div className="my-pfx-m space-y-pfx-s">
      <p>Workspace Actions</p>
      <Button
        variant="secondary"
        onClick={handleReinstall}
        disabled={isReinstalling}
      >
        {isReinstalling ? "Reinstalling..." : "Reinstall"}
      </Button>
      <p>Active PTYs</p>
      <div className="flex items-center gap-pfx-s">
        <Button variant="secondary" onClick={refreshPtys}>
          Refresh
        </Button>
      </div>
      {activePtys.length === 0 ? (
        <p>No PTYs active.</p>
      ) : (
        <ul className="space-y-pfx-xs">
          {activePtys.map((pty) => (
            <Row
              key={pty.id}
              title={`${pty.invocation.kind.kind}PTY`}
              subtitle={pty.id}
              onClick={() =>
                message(JSON.stringify(pty, null, 2), { title: "PTY Details" })
              }
              suffix={
                <Button size="sm" onClick={() => handleKill(pty.id)}>
                  Kill
                </Button>
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
