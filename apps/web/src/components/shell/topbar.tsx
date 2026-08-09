import { Search, Bell, Plus, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSidebarStore } from "@/lib/stores/use-sidebar-store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export function Topbar() {
  const { setMobileOpen } = useSidebarStore();

  const openPalette = () => {
    document.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  return (
    <header
      className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b bg-card px-6"
      role="banner"
    >
      {/* Mobile menu */}
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        onClick={() => setMobileOpen(true)}
        aria-label="Open navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Search input */}
      <div className="flex-1 md:max-w-sm">
        <Button
          variant="outline"
          className="w-full justify-start text-muted-foreground"
          onClick={openPalette}
          aria-label="Open search (Cmd+K)"
        >
          <Search className="mr-2 h-4 w-4" aria-hidden="true" />
          Search or jump to...{" "}
          <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
      </div>

      {/* Right side */}
      <div className="ml-auto flex items-center gap-2">
        {/* Quick add */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={openPalette}
                aria-label="Quick add"
              >
                <Plus className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Quick add (Cmd+K)</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Notifications bell */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
                <Bell className="h-5 w-5" />
                <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground">
                  0
                </span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>No notifications</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* User avatar */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="text-xs">U</AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">User</span>
                <span className="text-xs text-muted-foreground">user@projecte.app</span>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {}}>
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              document.dispatchEvent(new CustomEvent("open-command-palette"));
            }}>
              Command palette
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => {
              fetch("/api/auth/logout", { method: "POST" }).then(() => {
                window.location.href = "/login";
              });
            }}>
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
