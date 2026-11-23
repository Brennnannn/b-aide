import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import type { NavItemData } from "@ui";
import { OuterNavItem } from "./outer-nav-item";

type OuterNavProps = {
    navItems: NavItemData[][];
    /** Rendered in the middle of the bar, centered on the bar itself rather than the space left over. */
    center?: ReactNode;
    /** Rendered at the right end of the bar, just left of the window buttons. */
    right?: ReactNode;
    className?: string;
};

/**
 * B-aide's top-level nav bar, which doubles as the window's title bar (VS Code style): the
 * Electron window is frameless at the top, the whole bar is a drag region (double-click
 * maximizes), and the native min/max/close buttons are overlaid on its top-right corner (they
 * keep their native ~40px height, so the bar shows a little empty space under them). The
 * `env(titlebar-area-*)` padding keeps content clear of those buttons (and of macOS's traffic
 * lights on the left); in a plain browser tab the env vars are unset and the padding is zero.
 * Links, buttons and inputs opt out of dragging via `.app-drag-region` in `index.css`.
 *
 * Three regions: left holds the B mark and the segmented nav items (a divider between each
 * group), `center` sits in the middle, `right` is pinned to the right edge. Left and right share
 * the leftover width equally, so `center` stays visually centered however wide the sides are.
 *
 * @param {NavItemData[][]} navItems - Segments of nav items; a divider renders between groups
 * @param {React.ReactNode} [center] - Content for the middle of the bar
 * @param {React.ReactNode} [right] - Content pinned to the right edge, left of the window buttons
 * @param {string} [className] - Additional classes merged onto the header element
 *
 * @example
 * ```tsx
 * <OuterNav navItems={[mainNav]} center={<PageTitle />} />
 * ```
 */
export function OuterNav({ navItems, center, right, className }: OuterNavProps) {
    return (
        <header
            className={twMerge("app-drag-region sticky top-0 w-full h-16 sm:h-20 shrink-0 z-20 bg-background select-none", className)}
            style={{
                paddingLeft: "env(titlebar-area-x, 0px)",
                paddingRight: "calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw))",
            }}
        >
            <div className="flex items-stretch h-full w-full px-4 gap-4">
                <div className="flex-1 basis-0 flex items-stretch gap-4">
                    <Link
                        to="/"
                        title="B-aide"
                        className="shrink-0 flex items-center px-1 text-2xl sm:text-3xl font-bold leading-none text-text hover:text-primary transition-colors"
                    >
                        B
                    </Link>
                    <nav className="flex items-stretch divide-x divide-trim">
                        {navItems.map((segment, idx) => (
                            <div key={idx} className="flex flex-row">
                                {segment.map((item) => (
                                    <OuterNavItem key={item.type === "link" ? item.link : item.label} item={item} variant="top" />
                                ))}
                            </div>
                        ))}
                    </nav>
                </div>
                <div className="min-w-0 flex items-center">{center}</div>
                <div className="flex-1 basis-0 flex items-center justify-end">{right}</div>
            </div>
        </header>
    );
}
