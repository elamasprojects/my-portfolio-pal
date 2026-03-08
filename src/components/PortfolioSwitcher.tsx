import { useState } from "react";
import { useActivePortfolio, useCreatePortfolio, useRenamePortfolio, useDeletePortfolio } from "@/hooks/usePortfolio";
import { useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ChevronDown, Plus, Pencil, Trash2 } from "lucide-react";
import { ChessKnight } from "@/components/ChessKnight";
import { toast } from "sonner";

export function PortfolioSwitcher() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { portfolio, portfolios, setActive } = useActivePortfolio();
  const createPortfolio = useCreatePortfolio();
  const renamePortfolio = useRenamePortfolio();
  const deletePortfolio = useDeletePortfolio();

  const [showCreate, setShowCreate] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [newName, setNewName] = useState("");
  const [targetPortfolio, setTargetPortfolio] = useState<{ id: string; name: string } | null>(null);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      const result = await createPortfolio.mutateAsync(newName.trim());
      setActive(result.id);
      toast.success(`Portfolio "${newName.trim()}" created`);
      setNewName("");
      setShowCreate(false);
    } catch {
      toast.error("Failed to create portfolio");
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || !targetPortfolio) return;
    try {
      await renamePortfolio.mutateAsync({ id: targetPortfolio.id, name: newName.trim() });
      toast.success("Portfolio renamed");
      setNewName("");
      setShowRename(false);
      setTargetPortfolio(null);
    } catch {
      toast.error("Failed to rename portfolio");
    }
  };

  const handleDelete = async () => {
    if (!targetPortfolio) return;
    try {
      await deletePortfolio.mutateAsync(targetPortfolio.id);
      toast.success("Portfolio deleted");
      setShowDelete(false);
      setTargetPortfolio(null);
    } catch {
      toast.error("Failed to delete portfolio");
    }
  };

  if (collapsed) {
    return (
      <div className="flex items-center justify-center px-4 py-5">
        <ChessKnight className="h-6 w-6 text-sidebar-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="px-4 py-5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 w-full text-left hover:opacity-80 transition-opacity">
              <ChessKnight className="h-6 w-6 text-sidebar-primary shrink-0" />
              <span className="text-lg font-bold tracking-tight text-sidebar-foreground truncate flex-1">
                {portfolio?.name || "Chess"}
              </span>
              <ChevronDown className="h-4 w-4 text-sidebar-foreground/50 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {portfolios.map((p) => (
              <DropdownMenuItem
                key={p.id}
                className="flex items-center justify-between group"
                onClick={() => setActive(p.id)}
              >
                <span className={p.id === portfolio?.id ? "font-semibold" : ""}>{p.name}</span>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTargetPortfolio(p);
                      setNewName(p.name);
                      setShowRename(true);
                    }}
                  >
                    <Pencil className="h-3 w-3" />
                  </Button>
                  {portfolios.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTargetPortfolio(p);
                        setShowDelete(true);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => { setNewName(""); setShowCreate(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              New Portfolio
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Portfolio</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Portfolio name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog open={showRename} onOpenChange={setShowRename}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Portfolio</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRename(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDelete} onOpenChange={setShowDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete "{targetPortfolio?.name}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently delete this portfolio and all its trades.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
