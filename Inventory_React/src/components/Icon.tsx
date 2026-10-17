import { ICON_SYMBOLS, type IconName } from "./iconSprite";

export type { IconName };

/** Mounts the SVG sprite once, at the root of the app. */
export function IconSprite() {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            style={{ display: "none" }}
            aria-hidden="true"
            dangerouslySetInnerHTML={{ __html: ICON_SYMBOLS }}
        />
    );
}

type IconProps = {
    name: IconName;
    className?: string;
};

/** Decorative functional icon; the accessible name always comes from the surrounding control. */
export function Icon({ name, className }: IconProps) {
    return (
        <svg className={`od-icon${className ? ` ${className}` : ""}`} aria-hidden="true" focusable="false">
            <use href={`#i-${name}`} />
        </svg>
    );
}
