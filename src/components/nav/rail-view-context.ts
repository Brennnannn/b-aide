import { createContext, createElement, useContext, type ReactNode } from "react";

const railViewContext = createContext<boolean>(false);

/**
 * Publishes whether nav items below it should render in "rail" mode (icon only, no label).
 * Mounted by `InnerNavMenu` around its item list; consumed by `InnerNavItem` via `useRailView()`.
 *
 * @param {boolean} isRail - True when child nav items should hide their label
 * @param {React.ReactNode} children - Components that call `useRailView()`
 *
 * @example
 * ```tsx
 * <RailViewProvider isRail={display === 'rail'}>
 *   <InnerNavList navItems={navItems} />
 * </RailViewProvider>
 * ```
 */
export function RailViewProvider({ isRail, children }: { isRail: boolean; children: ReactNode }) {
    return createElement(railViewContext.Provider, { value: isRail }, children)
}

/**
 * Returns whether the current nav item should render in rail mode (icon only, no label).
 * Defaults to `false` (label shown) when called outside a `RailViewProvider`.
 *
 * @example
 * ```ts
 * const isRail = useRailView();
 * ```
 */
export function useRailView() {
    return useContext(railViewContext);
}
