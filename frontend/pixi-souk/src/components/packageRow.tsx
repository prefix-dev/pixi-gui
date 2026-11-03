import { DownloadIcon, Trash2Icon } from "lucide-react";

import { CircularIcon } from "shared/components/common/circularIcon";
import { Row } from "shared/components/common/row";
import { Button } from "shared/components/shadcn/button";
import { Spinner } from "shared/components/shadcn/spinner";

type PackageRowProps = {
  name: string;
  versions: string[];
  installed: boolean;
  busy?: boolean;
  onAction: () => void;
};

export function PackageRow({
  name,
  versions,
  installed,
  busy,
  onAction,
}: PackageRowProps) {
  return (
    <Row
      prefix={<CircularIcon icon="package" />}
      title={name}
      subtitle={versions.join(", ")}
      suffix={
        <>
          <Button
            size="icon"
            variant="ghost"
            title={
              installed
                ? busy
                  ? "Uninstalling…"
                  : "Uninstall"
                : busy
                  ? "Installing…"
                  : "Install"
            }
            disabled={busy}
            onClick={onAction}
          >
            {busy ? (
              <Spinner />
            ) : installed ? (
              <Trash2Icon className="text-destructive" />
            ) : (
              <DownloadIcon />
            )}
          </Button>
        </>
      }
    />
  );
}
