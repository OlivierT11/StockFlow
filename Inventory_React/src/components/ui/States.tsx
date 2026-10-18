import type { ReactNode } from "react";
import { Icon, type IconName } from "../Icon";
import { errorMessage } from "../../lib/api";
import { gap } from "../../lib/style";

type EmptyStateProps = {
    icon: IconName;
    title: string;
    text: ReactNode;
    actions?: ReactNode;
};

export function EmptyState({ icon, title, text, actions }: EmptyStateProps) {
    return (
        <div className="empty">
            <span className="empty-icon"><Icon name={icon} /></span>
            <h3>{title}</h3>
            <p>{text}</p>
            {actions && <div className="empty-actions">{actions}</div>}
        </div>
    );
}

type ErrorBannerProps = {
    error: unknown;
    title?: string;
    onRetry?: () => void;
};

export function ErrorBanner({ error, title = "Chargement impossible.", onRetry }: ErrorBannerProps) {
    return (
        <div className="banner banner-danger" role="alert">
            <Icon name="alert-circle" />
            <span className="banner-text"><strong>{title}</strong> {errorMessage(error)}</span>
            {onRetry && (
                <button type="button" className="btn btn-sm btn-secondary" onClick={onRetry}>
                    <Icon name="refresh" />Réessayer
                </button>
            )}
        </div>
    );
}

const SkLine = ({ w, h }: { w: 30 | 50 | 70; h?: number }) => (
    <span className={`skeleton sk-line w-${w}`} style={h ? { height: h } : undefined} />
);

export function SkeletonHead() {
    return (
        <div className="od-stack" style={gap(8)}>
            <SkLine w={30} h={28} />
            <SkLine w={50} />
        </div>
    );
}

export function SkeletonTable({ rows = 10, toolbar = true }: { rows?: number; toolbar?: boolean }) {
    return (
        <div className="card" aria-busy="true" aria-label="Chargement">
            {toolbar && (
                <div className="sk-row" style={{ padding: "16px 20px" }}>
                    <SkLine w={30} h={36} />
                    <SkLine w={30} h={36} />
                </div>
            )}
            {Array.from({ length: rows }, (_, i) => (
                <div className="sk-row" key={i}>
                    <SkLine w={50} />
                    <SkLine w={30} />
                    <SkLine w={30} />
                    <SkLine w={30} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonRows({ rows }: { rows: number }) {
    return (
        <div aria-busy="true" aria-label="Chargement">
            {Array.from({ length: rows }, (_, i) => (
                <div className="sk-row" key={i}>
                    <SkLine w={50} />
                    <SkLine w={30} />
                    <SkLine w={30} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonPage({ rows = 10 }: { rows?: number }) {
    return (
        <div className="od-stack" style={gap(24)} aria-busy="true" aria-label="Chargement">
            <SkeletonHead />
            <SkeletonTable rows={rows} />
        </div>
    );
}
