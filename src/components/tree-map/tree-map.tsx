import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { RadialMap } from "./radial-map";

/** One node of the map. Nodes are given flat; the tree is rebuilt from `parentId`. */
export type TreeMapNode = {
  id: string;
  parentId: string | null;
  title: string;
  /** Where clicking the node goes. Nodes without one can't be clicked. */
  link?: string;
  /** Any CSS colour; tints the default chip, when there's no `content`. */
  color?: string;
  /** Any CSS colour for the line to its parent; plain grey when omitted. */
  lineColor?: string;
  /**
   * What the node shows, e.g. `<Endeavor mode="chip" />`. It should fill the height it's given
   * (the map sizes, moves and scales it). Defaults to the title in a chip tinted by `color`.
   */
  content?: ReactNode;
};

type TreeMapOverlayProps = {
  nodes: TreeMapNode[];
  /** The node you're on; it and its ancestors are emphasised. */
  currentId?: string;
  /** Shown above the map, e.g. the tree's name and figures (`EndeavorMapHeader`). */
  header?: ReactNode;
  /** Called after a node with a link is clicked; the overlay closes first. */
  onNavigate: (link: string) => void;
  onClose: () => void;
};

/**
 * The tree map (`RadialMap`) covering the whole content pane. It fills its nearest positioned
 * ancestor, so render it inside the pane it should cover (that pane needs `relative`). A
 * `header` sits above the map on the left, the close X on the right, and the map takes the rest
 * of the height. Escape or the X closes it.
 */
export function TreeMapOverlay({
  onClose,
  onNavigate,
  header,
  ...map
}: TreeMapOverlayProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    // Frosted glass: the work pane stays visible, blurred, behind the map, so it reads as a layer
    // over your work rather than a page in place of it. Fades in on open (`starting:`).
    // z-35: above the page's own floating controls (z-30), below the sidebar's overlay mode (z-40)
    <div className="absolute inset-0 z-35 flex flex-col bg-background/50 backdrop-blur-sm transition-opacity duration-200 starting:opacity-0">
      <div className="shrink-0 flex flex-row items-start justify-between gap-4 px-6 pt-5">
        <div className="min-w-0">{header}</div>
        <button
          type="button"
          onClick={onClose}
          title="Close map (Esc)"
          className="shrink-0 rounded-md p-1 text-text-muted cursor-pointer hover:bg-hover-1 hover:text-primary transition-colors"
        >
          <X className="h-6 w-6" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <RadialMap
          {...map}
          onNavigate={(link) => {
            onClose();
            onNavigate(link);
          }}
        />
      </div>
    </div>
  );
}
