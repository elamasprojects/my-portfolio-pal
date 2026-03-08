import { useState } from "react";
import { useTags, useCreateTag, TradeTag } from "@/hooks/useTags";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag, Plus, X } from "lucide-react";

const TAG_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#f97316",
];

interface TagPickerProps {
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
}

export function TagPicker({ selectedTagIds, onToggle }: TagPickerProps) {
  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();
  const [newTagName, setNewTagName] = useState("");
  const [open, setOpen] = useState(false);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    const color = TAG_COLORS[tags.length % TAG_COLORS.length];
    try {
      const tag = await createTag.mutateAsync({ name: newTagName.trim(), color });
      onToggle(tag.id);
      setNewTagName("");
    } catch {}
  };

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {selectedTags.map((tag) => (
          <Badge
            key={tag.id}
            className="text-xs cursor-pointer hover:opacity-80 gap-1"
            style={{ backgroundColor: tag.color, color: "#fff" }}
            onClick={() => onToggle(tag.id)}
          >
            {tag.name}
            <X className="h-3 w-3" />
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 text-xs gap-1 px-2">
              <Tag className="h-3 w-3" />
              Tags
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {tags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => onToggle(tag.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent transition-colors text-left ${
                      selected ? "bg-accent" : ""
                    }`}
                  >
                    <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                    <span className="truncate flex-1">{tag.name}</span>
                    {selected && <span className="text-xs text-primary">✓</span>}
                  </button>
                );
              })}
              {tags.length === 0 && (
                <p className="text-xs text-muted-foreground px-2 py-1">No tags yet</p>
              )}
            </div>
            <div className="flex gap-1 mt-2 pt-2 border-t">
              <Input
                placeholder="New tag..."
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                className="h-7 text-xs"
              />
              <Button size="icon" className="h-7 w-7 shrink-0" onClick={handleCreate} disabled={!newTagName.trim()}>
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Display-only tag badges for trade log rows
export function TagBadges({ tagIds, tags }: { tagIds: string[]; tags: TradeTag[] }) {
  if (tagIds.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {tagIds.map((id) => {
        const tag = tags.find((t) => t.id === id);
        if (!tag) return null;
        return (
          <span
            key={id}
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
            style={{ backgroundColor: tag.color + "22", color: tag.color }}
          >
            {tag.name}
          </span>
        );
      })}
    </div>
  );
}
