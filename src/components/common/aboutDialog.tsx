import { getName } from "@tauri-apps/api/app";
import { openUrl } from "@tauri-apps/plugin-opener";
import { BugIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Row } from "@/components/common/row";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/shadcn/dialog";

import { getAppVersion, getPixiVersion } from "@/lib/pixi/version";

interface AboutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutDialog({ open, onOpenChange }: AboutDialogProps) {
  const [appName, setAppName] = useState<string>("");
  const [appVersion, setAppVersion] = useState<string>("");
  const [pixiVersion, setPixiVersion] = useState<string>("");

  useEffect(() => {
    const loadAppInfo = async () => {
      const [name, version, pixi] = await Promise.all([
        getName(),
        getAppVersion(),
        getPixiVersion(),
      ]);
      setAppName(name);
      setAppVersion(version);
      setPixiVersion(pixi);
    };

    if (open) {
      loadAppInfo();
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-h-[95vh] overflow-y-auto">
        <DialogTitle className="sr-only">About Pixi GUI</DialogTitle>
        <DialogDescription className="sr-only">
          App version details
        </DialogDescription>
        <div className="flex flex-col items-center">
          <img src="/paxton.png" alt="Paxton" className="h-32 mt-pfx-m" />

          <h2 className="font-display text-pfxh-s mt-pfx-ml">{appName}</h2>
          <p className="mt-pfx-s">
            A graphical interface for managing Pixi workspaces
          </p>
          <p className="text-pfxgsl-400 my-pfx-s">© prefix.dev GmbH</p>

          <div className="w-full space-y-pfx-s">
            <Row title={`${appName} Version`} subtitle={appVersion} property />
            <Row title="Pixi API Version" subtitle={pixiVersion} property />
          </div>

          <Button
            variant="ghost"
            className="mt-pfx-m"
            onClick={() =>
              openUrl("https://github.com/prefix-dev/pixi-gui/issues")
            }
          >
            Report Issue <ExternalLinkIcon />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
