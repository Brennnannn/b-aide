import { cloneElement, isValidElement, ReactElement, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { NavItemData } from "@ui";
import { useRailView } from "./rail-view-context";

const rowClassName =
    "flex flex-row items-center cursor-pointer hover:bg-hover-2 px-6 py-4 border-b border-trim";

/**
 * Renders a clickable navigation item as a plain `<li>` row — no table semantics, so it
 * nests freely inside a recursive tree (`InnerNav`) or a flat dropdown list alike.
 * Navigates for `link` items, fires `onClick` for `action` items, and toggles an inline
 * nested sub-list for `node` items — the icon slot always shows a chevron for `node`
 * regardless of a caller-supplied icon, since it doubles as the expand/collapse indicator.
 *
 * @param {NavItemData} item - The nav item to render
 *
 * @example
 * ```tsx
 * <InnerNavItem item={navLink({ link: "/data/users", label: "Users", icon: <Users /> })} />
 * ```
 */
export function InnerNavItem({ item }: { item: NavItemData }) {
    const isRail = useRailView();
    const [showChildren, setShowChildren] = useState(
        item.type === "node" ? (item.defaultOpen ?? false) : false,
    );

    const icon =
        item.type === "node" ? (
            showChildren ? (
                <ChevronDown className="h-4 w-4" />
            ) : (
                <ChevronRight className="h-4 w-4" />
            )
        ) : isValidElement(item.icon) ? ( //Inject styling into icon
            cloneElement(item.icon as ReactElement<{ className?: string }>, {
                className: "h-4 w-4",
            })
        ) : (
            item.icon
        );

    const content = (
        <>
            <div
                className="h-4 w-4"
                title={
                    item.type === "node"
                        ? item.label
                        : `Navigate to ${item.label}`
                }
            >
                {icon}
            </div>
            {!isRail && (
                <div className="ml-2 min-w-0 truncate" title={item.label}>
                    {item.label}
                </div>
            )}
        </>
    );

    return (
        <li className="list-none">
            {item.type === "link" && (
                <LinkResolver link={item.link}>{content}</LinkResolver>
            )}
            {item.type === "action" && (
                <button
                    type="button"
                    onClick={item.onClick}
                    className={rowClassName + " w-full text-left"}
                >
                    {content}
                </button>
            )}
            {item.type === "node" && (
                <>
                    <button
                        type="button"
                        onClick={() => setShowChildren((prev) => !prev)}
                        className={rowClassName + " w-full text-left"}
                    >
                        {content}
                    </button>
                    {showChildren && (
                        <ul className="ml-4 list-none border-l border-trim">
                            {item.children.map((child) => (
                                <InnerNavItem
                                    key={
                                        child.type === "link"
                                            ? child.link
                                            : child.label
                                    }
                                    item={child}
                                />
                            ))}
                        </ul>
                    )}
                </>
            )}
        </li>
    );
}

type LinkResolverProps = {
    link: string;
    children: React.ReactNode;
};

function LinkResolver({ link, children }: LinkResolverProps) {
    // External links open in a new tab; everything else is an in-app route
    if (link.includes("http"))
        return (
            <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                className={rowClassName}
            >
                {children}
            </a>
        );
    else
        return (
            <Link to={link} className={rowClassName}>
                {children}
            </Link>
        );
}
