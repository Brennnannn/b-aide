import { Home } from "lucide-react";

export interface PathItem<TMeta = unknown> {
    name: string;
    children?: PathItem<TMeta>[];
    parent?: PathItem<TMeta>;
    meta?: TMeta;
}

interface ExplorerProps<TMeta = unknown> {
    path: PathItem<TMeta>;
    setPath: (item: PathItem<TMeta>) => void;
}

/**
 * Walks the `parent` chain of `item` and returns an ordered array from root to `item`.
 *
 * @param {PathItem<TMeta>} item - The current leaf node in the path tree
 *
 * @example
 * ```ts
 * tracePath(deepItem); // [root, child, deepItem]
 * ```
 */
export function tracePath<TMeta>(item: PathItem<TMeta>): PathItem<TMeta>[] {
    if (item.parent) {
        return [...tracePath(item.parent), item]
    } else {
        return [item]
    }
}

/**
 * Renders a breadcrumb path bar for tree navigation.
 * Displays a home icon for the root node (its name as the tooltip) and a clickable segment for
 * every level below it, down to `path` itself. At the root, the bar is just the home icon.
 *
 * @param {PathItem<TMeta>} path - The currently active node in the path tree
 * @param {(item: PathItem<TMeta>) => void} setPath - Called when the user clicks a breadcrumb segment
 *
 * @example
 * ```tsx
 * <ExplorerHeader path={currentNode} setPath={setCurrentNode} />
 * ```
 */
export function ExplorerHeader<TMeta = unknown>({
    path,
    setPath
}: ExplorerProps<TMeta>) {

    return (
        <div className="flex gap-2">
            <div className="flex-1">
                <div className="relative">
                    <div className="w-full pl-10 pr-4 py-2 border border-trim rounded-lg focus:ring-1 focus:ring-primary focus:border-transparent min-h-[42px] flex items-center flex-wrap gap-1">
                        {tracePath(path).map((item, index) => (
                            index == 0 ? (
                                <button
                                    key={index}
                                    type="button"
                                    onClick={() => setPath(item)}
                                    title={item.name}
                                    className='absolute left-3 top-1/2 transform -translate-y-1/2 text-text-muted cursor-pointer hover:text-primary transition-colors'
                                >
                                    <Home className='h-5 w-5' />
                                </button>
                            ) : (
                                <div key={index} className="flex items-center">
                                    <span className="text-text-muted mx-1">/</span>
                                    <button
                                        type="button"
                                        onClick={() => setPath(item)}
                                        className="px-2 py-1 rounded hover:bg-hover-1 transition-colors cursor-pointer text-sm font-medium"
                                    >
                                        {item.name}
                                    </button>
                                </div>
                            )
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}