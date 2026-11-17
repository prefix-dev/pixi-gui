import {
  useCanGoBack,
  useLocation,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { ArrowLeftIcon, SearchIcon, SlidersHorizontalIcon } from "lucide-react";

import { AppMenu } from "shared/components/common/appMenu";
import { Button } from "shared/components/shadcn/button";
import { Input } from "shared/components/shadcn/input";

// Shared by all pages. The search entry is shown on the start and search pages.
export function HeaderBar() {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { pathname, search } = useLocation();

  const isStart = pathname === "/";
  const isSearch = pathname === "/search";
  const query = isSearch && typeof search.q === "string" ? search.q : "";

  const goBack = () => {
    if (canGoBack) {
      router.history.back();
    } else {
      navigate({ to: "/", replace: true });
    }
  };

  // The first keystroke opens the search page, further ones replace its
  // history entry. Clearing the search goes back to the start page.
  const setQuery = (q: string) => {
    if (!q) {
      goBack();
    } else {
      navigate({ to: "/search", search: { q }, replace: isSearch });
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-pfx-m px-pfx-l py-pfx-m">
      {isStart ? (
        <Button variant="ghost" size="icon">
          <SlidersHorizontalIcon />
        </Button>
      ) : (
        <Button variant="ghost" size="icon" title="Back" onClick={goBack}>
          <ArrowLeftIcon />
        </Button>
      )}
      <div className="flex h-12 max-w-96 flex-1">
        {(isStart || isSearch) && (
          <Input
            autoFocus
            className="flex-1"
            placeholder="Search for packages…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && isSearch) goBack();
            }}
            icon={<SearchIcon />}
          />
        )}
      </div>
      <AppMenu />
    </div>
  );
}
