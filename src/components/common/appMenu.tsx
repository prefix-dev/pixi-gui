import { Link } from "@tanstack/react-router";
import { openUrl } from "@tauri-apps/plugin-opener";
import {
  AppWindowIcon,
  BookOpenTextIcon,
  BoxesIcon,
  EllipsisVerticalIcon,
  InfoIcon,
} from "lucide-react";
import { useState } from "react";

import { AboutDialog } from "@/components/common/aboutDialog";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

import { openNewWindow } from "@/lib/window";

interface AppMenuProps {
  showChangeWorkspace?: boolean;
}

export function AppMenu({ showChangeWorkspace = false }: AppMenuProps) {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);

  const handleNewWindow = async () => {
    try {
      await openNewWindow();
    } catch (error) {
      console.error("Failed to open new window:", error);
    }
  };

  const handleDocumentation = async () => {
    try {
      await openUrl("https://pixi.prefix.dev/");
    } catch (error) {
      console.error("Failed to open help URL:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {showChangeWorkspace && (
          <DropdownMenuItem asChild>
            <Link to={"/"}>
              <BoxesIcon /> Change Workspace
            </Link>
          </DropdownMenuItem>
        )}
        {showChangeWorkspace && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={handleNewWindow}>
          <AppWindowIcon /> New Window
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDocumentation}>
          <BookOpenTextIcon /> Documentation
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsAboutDialogOpen(true)}>
          <InfoIcon /> About Pixi GUI
        </DropdownMenuItem>
      </DropdownMenuContent>

      {isAboutDialogOpen && (
        <AboutDialog
          open={true}
          onOpenChange={(open) => !open && setIsAboutDialogOpen(false)}
        />
      )}
    </DropdownMenu>
  );
}
