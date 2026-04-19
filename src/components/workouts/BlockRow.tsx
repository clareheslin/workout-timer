import { useEffect, useState } from "react";
import type { Block } from "@/types";
import { blockTotalSeconds, blockTotalSets, formatDuration } from "@/lib/duration";

interface Props {
  block: Block;
  onEdit: () => void;
  onDelete: () => void;
}

export function BlockRow({ block, onEdit, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false);

  // Reset the confirm state if the user walks away for a moment.
  useEffect(() => {
    if (!confirming) return;
    const t = window.setTimeout(() => setConfirming(false), 3000);
    return () => window.clearTimeout(t);
  }, [confirming]);

  const handleDelete = () => {
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  return (
    <li className="rounded-lg border border-border bg-card p-3 text-card-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{block.name}</p>
          <p className="text-xs text-muted-foreground">
            {block.items.length} {block.items.length === 1 ? "exercise" : "exercises"}
            {" · "}
            {blockTotalSets(block)} total {blockTotalSets(block) === 1 ? "set" : "sets"}
            {" · "}
            {(block.mode ?? "circuit") === "sets" ? "Sets" : "Circuit"}
            {" · "}
            {formatDuration(blockTotalSeconds(block))}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className={`rounded-md px-3 py-2 text-sm font-medium ${
              confirming
                ? "bg-destructive text-destructive-foreground"
                : "border border-border hover:bg-accent"
            }`}
          >
            {confirming ? "Tap again to delete" : "Delete"}
          </button>
        </div>
      </div>
    </li>
  );
}
