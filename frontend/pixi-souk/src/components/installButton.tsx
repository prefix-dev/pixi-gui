import { getRouteApi, useRouter } from "@tanstack/react-router";
import { DownloadIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";

import { showConfirm } from "shared/components/common/genericDialog";
import { Button } from "shared/components/shadcn/button";
import { Spinner } from "shared/components/shadcn/spinner";
import type { PackageMetadata } from "shared/lib/pixi/default/package";
import { installEnvironment } from "shared/lib/pixi/global/install";
import type { GlobalEnvironment } from "shared/lib/pixi/global/list";
import { uninstallEnvironment } from "shared/lib/pixi/global/uninstall";
import { channelLabel } from "shared/lib/utils";

import {
  findEnvironment,
  isBusyEnvironmentName,
  setBusyEnvironment,
  useIsBusyEnvironment,
} from "@/lib/environments";

type InstallButtonProps = (
  | {
      /** Uninstalls this environment */
      environment: GlobalEnvironment;
    }
  | {
      /** Installs this package, or uninstalls the environment providing it */
      pkg: PackageMetadata;
    }
) & {
  /** Shows "Install" or "Uninstall" next to the icon */
  labeled?: boolean;
};

export function InstallButton(props: InstallButtonProps) {
  const router = useRouter();
  const { environments, defaultChannels } =
    getRouteApi("__root__").useLoaderData();

  const environment =
    "environment" in props
      ? props.environment
      : findEnvironment(environments, props.pkg.name, props.pkg.channel_url);

  const [environmentName, channelUrl] =
    "pkg" in props && !environment
      ? [props.pkg.name, props.pkg.channel_url]
      : [environment?.name ?? "", environment?.channels[0]?.url ?? ""];

  const busy = useIsBusyEnvironment(environmentName, channelUrl);

  const install = async (pkg: PackageMetadata) => {
    if (!defaultChannels.includes(pkg.channel)) {
      const confirmed = await showConfirm(
        "Install from a Non-Default Channel?",
        `"${pkg.name}" comes from "${channelLabel(pkg.channel)}", which isn't one of your default channels. ` +
          "Installed packages can run any code on your computer, so only install from channels you trust. " +
          "Install it anyway?",
        "Install",
      );
      if (!confirmed) return;
    }

    // Another environment already has the name, e.g. one with a package of the same name from
    // another channel. pixi would add the package to that environment, from its channels.
    if (
      environments.some(
        (environment) => environment.name === environmentName,
      ) ||
      isBusyEnvironmentName(environmentName)
    ) {
      toast.error(
        `Can't install ${pkg.name}: an environment named "${environmentName}" already exists`,
      );
      return;
    }

    setBusyEnvironment(environmentName, channelUrl, true);
    try {
      await installEnvironment(environmentName, [{ name: pkg.name }], {
        channels: [pkg.channel],
        platform: null,
        expose: [],
        with: [],
        force_reinstall: false,
        no_shortcuts: false,
      });
      await router.invalidate({
        sync: true,
        filter: (match) => match.routeId === "__root__",
      });
      toast.success(`Successfully installed ${pkg.name}`);
    } catch (error) {
      toast.error(`Failed to install ${pkg.name}: ${error}`);
    } finally {
      setBusyEnvironment(environmentName, channelUrl, false);
    }
  };

  const uninstall = async (name: string) => {
    const confirmed = await showConfirm(
      "Uninstall Package",
      `Uninstall "${name}" and remove its environment?`,
      "Uninstall",
    );
    if (!confirmed) return;

    setBusyEnvironment(environmentName, channelUrl, true);
    try {
      await uninstallEnvironment(name);
      await router.invalidate({
        sync: true,
        filter: (match) => match.routeId === "__root__",
      });
      toast.success(`Successfully uninstalled ${name}`);
    } catch (error) {
      toast.error(`Failed to uninstall ${name}: ${error}`);
    } finally {
      setBusyEnvironment(environmentName, channelUrl, false);
    }
  };

  const handleClick = () => {
    if (environment) {
      void uninstall(environment.name);
    } else if ("pkg" in props) {
      void install(props.pkg);
    }
  };

  const label = environment
    ? busy
      ? "Uninstalling…"
      : "Uninstall"
    : busy
      ? "Installing…"
      : "Install";

  const icon = busy ? (
    <Spinner />
  ) : environment ? (
    <Trash2Icon className="text-destructive" />
  ) : (
    <DownloadIcon />
  );

  return props.labeled ? (
    <Button
      variant={environment ? "secondary" : "default"}
      disabled={busy}
      onClick={handleClick}
    >
      {icon}
      {environment ? "Uninstall" : "Install"}
    </Button>
  ) : (
    <Button
      size="icon"
      variant="ghost"
      title={label}
      disabled={busy}
      onClick={handleClick}
    >
      {icon}
    </Button>
  );
}
