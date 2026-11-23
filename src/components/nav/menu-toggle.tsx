import { Menu, X } from "lucide-react";
import { Card, ForegroundFocus } from "@ui";

type MenuToggleProps = {
    isOpen: boolean;
    onClick: () => void;
    className?: string;
};

/**
 * Controlled hamburger trigger — renders the Menu/X icon button plus a dismiss backdrop
 * when open. Owns no state of its own; the caller (`OuterNav`, `InnerNav`'s own mobile
 * fallback) drives `isOpen` so the button can stay in sync with whatever it's opening.
 *
 * @param {boolean} isOpen - Whether the thing this button controls is currently open
 * @param {() => void} onClick - Called on click; caller is responsible for flipping `isOpen`
 * @param {string} [className] - Additional classes merged onto the button
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 * <MenuToggle isOpen={isOpen} onClick={() => setIsOpen((v) => !v)} />
 * ```
 */
export function MenuToggle({ isOpen, onClick, className = "" }: MenuToggleProps) {
    return (
        <>
            {isOpen && <ForegroundFocus onClick={onClick} />}
            <Card
                className={`relative z-50 rounded-md w-12 h-12 flex items-center justify-center cursor-pointer hover:bg-hover-2 transition-colors ${className}`}
                onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Card>
        </>
    );
}
