import { getRouteApi } from "@tanstack/react-router";
import { LoaderCircleIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { CircularIcon } from "shared/components/common/circularIcon";
import { PreferencesGroup } from "shared/components/common/preferencesGroup";
import { Row } from "shared/components/common/row";
import { SelectableRow } from "shared/components/common/selectableRow";
import { Button } from "shared/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "shared/components/shadcn/dialog";
import type { Editor } from "shared/lib/editor";

import { FeatureChooserDialog } from "@/components/process/featureChooserDialog";

interface EditorDialogProps {
  onOpenChange: (open: boolean) => void;
  environment: string;
  availableEditors: Editor[];
  installableEditors: Editor[];
  onSubmit: (editor: Editor) => void;
  onInstallEditor: (packageName: string, feature: string) => Promise<void>;
}

export function EditorDialog({
  onOpenChange,
  environment,
  availableEditors,
  installableEditors,
  onSubmit,
  onInstallEditor,
}: EditorDialogProps) {
  const { environments } = getRouteApi("/workspace/$path").useLoaderData();
  const environmentFeatures = environments.find(
    (env) => env.name === environment,
  )?.features ?? ["default"];

  const [selection, setSelection] = useState<Editor | null>(null);
  const [installingPackage, setInstallingPackage] = useState<string | null>(
    null,
  );
  const [featureChooserOpen, setFeatureChooserOpen] = useState(false);
  const isInstalling = installingPackage !== null && !featureChooserOpen;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection) return;

    onOpenChange(false);
    onSubmit(selection);
  };

  const handleInstallClick = (packageName: string) => {
    setInstallingPackage(packageName);
    if (environmentFeatures.length === 1) {
      void performInstall(packageName, environmentFeatures[0]);
    } else {
      setFeatureChooserOpen(true);
    }
  };

  const handleFeatureSelected = (feature: string) => {
    if (installingPackage) {
      setFeatureChooserOpen(false);
      void performInstall(installingPackage, feature);
    }
  };

  const performInstall = async (packageName: string, feature: string) => {
    try {
      await onInstallEditor(packageName, feature);
    } finally {
      setInstallingPackage(null);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={isInstalling ? undefined : onOpenChange}>
        <DialogContent className="max-w-md max-h-[90vh] flex flex-col">
          <form onSubmit={handleSubmit} className="flex flex-col min-h-0">
            <DialogHeader>
              <DialogTitle>Open in Editor</DialogTitle>
              <DialogDescription>
                The editor is started within the &ldquo;{environment}&rdquo;
                environment.
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto min-h-0 space-y-pfx-m">
              {/* Available Editors Section (system editors + installed editors) */}
              <PreferencesGroup
                title="Available"
                nested
                placeholder="No editors found"
              >
                {availableEditors.map((editor) => (
                  <SelectableRow
                    key={editor.packageName ?? editor.command}
                    prefix={<CircularIcon icon="editor" />}
                    title={editor.name}
                    subtitle={editor.description}
                    selected={selection?.command === editor.command}
                    onClick={() => setSelection(editor)}
                    variant="single"
                  />
                ))}
              </PreferencesGroup>

              {/* Installable Section (not yet installed) */}
              {installableEditors.length > 0 && (
                <PreferencesGroup
                  title="Installable"
                  description={`Following editors can be installed to the "${environment}" environment.`}
                  nested
                >
                  {installableEditors.map((editor) => (
                    <Row
                      key={editor.packageName}
                      prefix={<CircularIcon icon="package" />}
                      title={editor.name}
                      subtitle={editor.description}
                      suffix={
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleInstallClick(editor.packageName ?? "")
                          }
                          disabled={isInstalling}
                        >
                          {isInstalling &&
                          installingPackage === editor.packageName ? (
                            <LoaderCircleIcon className="animate-spin" />
                          ) : (
                            "Install"
                          )}
                        </Button>
                      }
                    />
                  ))}
                </PreferencesGroup>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={isInstalling}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!selection || isInstalling}>
                {selection ? `Open in ${selection.name}` : "Open"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {featureChooserOpen && (
        <FeatureChooserDialog
          open={featureChooserOpen}
          onOpenChange={() => {
            setFeatureChooserOpen(false);
            setInstallingPackage(null);
          }}
          features={environmentFeatures}
          onSelect={handleFeatureSelected}
        />
      )}
    </>
  );
}
