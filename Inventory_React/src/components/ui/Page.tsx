import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../Icon";

type PageHeadProps = {
    title: string;
    lede?: ReactNode;
    actions?: ReactNode;
    crumbs?: ReactNode;
};

export function PageHead({ title, lede, actions, crumbs }: PageHeadProps) {
    return (
        <div className="page-head">
            <div className="od-stack">
                {crumbs && <nav className="breadcrumb" aria-label="Fil d’Ariane">{crumbs}</nav>}
                <h1>{title}</h1>
                {lede && <p className="lede">{lede}</p>}
            </div>
            {actions && <div className="page-actions">{actions}</div>}
        </div>
    );
}

export function Crumb({ to, children }: { to: string; children: ReactNode }) {
    return (
        <>
            <Link to={to}>{children}</Link>
            <Icon name="chevron-right" />
        </>
    );
}
