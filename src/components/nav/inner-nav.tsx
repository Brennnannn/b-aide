import { useState } from "react";
import { Outlet } from "react-router-dom";
import {
    Frame,
    HeaderBumpProvider,
    useScreenSizeCtx,
    SIZE,
    type NavItemData,
    Card,
} from "@ui";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { InnerNavItem } from "./inner-nav-item";
import { RailViewProvider } from "./rail-view-context";
import { MenuToggle } from "./menu-toggle";

type InnerNavBaseProps = {
    name: string;
    navItems: NavItemData[];
    sideActions?: React.ReactNode[];
    children?: React.ReactNode;
    railMode?: boolean;
};

type InnerNavToggleProps =
    | { handleToggle?: false; isOpen?: never; setOpen?: never }
    | { handleToggle: true; isOpen: boolean; setOpen: (open: boolean) => void };

type InnerNavMenuProps = InnerNavBaseProps & InnerNavToggleProps;

type InnerNavProps = {
    name: string;
    navItems: NavItemData[];
    sideActions?: React.ReactNode[];
    children?: React.ReactNode;
    railMode?: boolean;
};

/**
 * Route-level sidebar wrapper — renders `InnerNavMenu` docked next to `Outlet` at `sm` and
 * above, or behind its own hamburger trigger below that. To embed the panel inside another
 * nav shell (e.g. `OuterNav`'s hamburger drawer) use `InnerNavMenu` directly with `handleToggle`.
 *
 * @param {string} name - The header title for the navigation sidebar
 * @param {NavItemData[]} navItems - Nav items to display in the sidebar
 * @param {React.ReactNode[]} [sideActions] - Optional array of action components below nav items
 * @param {React.ReactNode} [children] - Rendered below the title, above the item list, at every breakpoint
 * @param {boolean} [railMode=true] - When collapsed, fall back to an icon rail instead of fully hiding
 *
 * @example
 * ```tsx
 * <InnerNav
 *   name="Data Management"
 *   navItems={[{ link: "/data/users", label: "Users" }]}
 * />
 * ```
 */
export function InnerNav({
    name,
    navItems = [],
    sideActions,
    children,
    railMode = true,
}: InnerNavProps) {
    const { size } = useScreenSizeCtx();
    const [isOpen, setIsOpen] = useState(false);
    const headerBump = "ml-14";
    const isOverlay = size < SIZE.LG;

    if (size < SIZE.SM)
        return (
            <HeaderBumpProvider headerBump={headerBump}>
                <Frame format="mobile-nav">
                    <div className="absolute mt-2">
                        <MenuToggle
                            isOpen={isOpen}
                            onClick={() => setIsOpen((v) => !v)}
                        />
                    </div>
                    {isOpen && (
                        <InnerNavMobileList
                            name={name}
                            navItems={navItems}
                            sideActions={sideActions}
                        >
                            {children}
                        </InnerNavMobileList>
                    )}
                    <div className="flex flex-col h-full w-full overflow-hidden">
                        <Outlet />
                    </div>
                </Frame>
            </HeaderBumpProvider>
        );

    // `relative`: below LG the panel is an absolute overlay at h-full, which must mean this row's
    // height, not the viewport's (it would run under the bottom bar, or past the page's end)
    return (
        <div className="relative flex h-full w-full overflow-hidden">
            {isOverlay && railMode && <div className="shrink-0 w-16" />}
            <InnerNavMenu
                name={name}
                navItems={navItems}
                sideActions={sideActions}
                railMode={railMode}
            >
                {children}
            </InnerNavMenu>
            <Frame format="cornered-start">
                <Outlet />
            </Frame>
        </div>
    );
}

/**
 * The sidebar panel itself — title bar, item list, optional side actions, and a `children`
 * slot rendered between the title and the list (e.g. an auth badge in hamburger mode).
 * Self-manages its own expand/collapse toggle by default; pass `handleToggle` to let a
 * parent (like `OuterNav`) drive `isOpen` externally instead — this also strips the
 * internal collapse icon, since the parent owns that trigger. Collapsed state falls back
 * to an icon rail when `railMode` is true, or fully hides when false. Below `SIZE.LG` it
 * renders as an absolute overlay instead of reserving layout space.
 *
 * @param {string} name - The header title
 * @param {NavItemData[]} navItems - Nav items to display
 * @param {React.ReactNode[]} [sideActions] - Optional actions rendered below the item list
 * @param {React.ReactNode} [children] - Rendered below the title, above the item list
 * @param {boolean} [railMode=true] - Collapsed fallback: icon rail (true) or fully hidden (false)
 * @param {boolean} [handleToggle=false] - When true, `isOpen`/`setOpen` are required and drive expand/collapse externally
 *
 * @example
 * ```tsx
 * <InnerNavMenu name="Data" navItems={navItems} />
 * ```
 */
export function InnerNavMenu(props: InnerNavMenuProps) {
    const {
        name,
        navItems = [],
        sideActions,
        children,
        railMode = true,
    } = props;
    const { size } = useScreenSizeCtx();
    const [selfOpen, setSelfOpen] = useState<boolean>(size >= SIZE.LG);

    const open = props.handleToggle ? props.isOpen : selfOpen;
    const setOpen = props.handleToggle ? props.setOpen : setSelfOpen;
    const isOverlay = size < SIZE.LG;
    const display: "hidden" | "rail" | "full" = open
        ? "full"
        : railMode
          ? "rail"
          : "hidden";

    if (display === "hidden") return null;

    return (
        <div
            className={`${isOverlay ? "absolute z-40" : "flex items-start"} h-full ${display === "rail" ? "w-16" : "w-64"}`}
        >
            <div className="flex flex-col flex-1 h-full border-r border-trim bg-background">
                <div className="sticky top-0 bg-surface z-10 border-b border-trim px-6 py-3 flex flex-row justify-between items-center w-full text-left text-xs font-medium uppercase tracking-wider">
                    {display === "full" && name}
                    {!props.handleToggle && (
                        <div onClick={() => setOpen(display !== "full")}>
                            {display === "full" ? (
                                <PanelLeftClose className="h-4 w-4 hover:cursor-pointer" />
                            ) : (
                                <PanelLeftOpen className="h-4 w-4 hover:cursor-pointer" />
                            )}
                        </div>
                    )}
                </div>
                {display === "full" && children}
                <RailViewProvider isRail={display === "rail"}>
                    <NavListItems
                        navItems={navItems}
                        listClassName="w-full flex-1 min-h-0 overflow-y-auto"
                    />
                </RailViewProvider>
                {display === "full" && sideActions && (
                    <div className="flex flex-col border-t border-trim max-h-1/3 gap-2 p-3 mt-2">
                        {sideActions}
                    </div>
                )}
            </div>
        </div>
    );
}

type InnerNavMobileListProps = {
    name: string;
    navItems: NavItemData[];
    sideActions?: React.ReactNode[];
    children?: React.ReactNode;
};

/**
 * Floating mobile-drawer variant of `InnerNavMenu`'s item list. `InnerNav`'s hamburger menu
 * sits inside an absolutely-positioned wrapper that has no explicit height, so a panel relying
 * on `h-full` there collapses to zero height instead of growing with its content — this sizes
 * to its own content instead, and grows with the list rather than scroll-capping it. Rounded on
 * all corners since it floats mid-screen instead of docking flush against a screen edge.
 *
 * @param {string} name - The header title
 * @param {NavItemData[]} navItems - Nav items to display
 * @param {React.ReactNode[]} [sideActions] - Optional actions rendered below the item list
 * @param {React.ReactNode} [children] - Rendered below the title, above the item list
 *
 * @example
 * ```tsx
 * <InnerNavMobileList name="Data" navItems={navItems} />
 * ```
 */
export function InnerNavMobileList({
    name,
    navItems = [],
    sideActions,
    children,
}: InnerNavMobileListProps) {
    return (
        <div className="absolute z-40 top-16 w-64">
            <Card className="flex flex-col overflow-hidden">
                <div className="border-b border-trim px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                    {name}
                </div>
                {children}
                <NavListItems
                    navItems={navItems}
                    listClassName="w-full"
                />
                {sideActions && (
                    <div className="flex flex-col border-t border-trim gap-2 p-3">
                        {sideActions}
                    </div>
                )}
            </Card>
        </div>
    );
}

function NavListItems({
    navItems,
    listClassName,
}: {
    navItems: NavItemData[];
    listClassName: string;
}) {
    return (
        <ul className={listClassName}>
            {navItems.map((item) => (
                <InnerNavItem
                    key={item.type === "link" ? item.link : item.label}
                    item={item}
                />
            ))}
        </ul>
    );
}
