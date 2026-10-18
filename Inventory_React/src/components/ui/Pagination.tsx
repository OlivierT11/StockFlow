import { Fragment } from "react";
import { Icon } from "../Icon";
import { fmtInt, plural } from "../../lib/format";

type PaginationProps = {
    page: number;
    pages: number;
    total: number;
    size: number;
    noun: string;
    sizes?: number[];
    onPage: (page: number) => void;
    onSize?: (size: number) => void;
};

/** First two, last two and the neighbours of the current page, with ellipses in between. */
function pageSequence(page: number, pages: number): number[] {
    const seq = new Set<number>();
    for (const p of [1, 2, page - 1, page, page + 1, pages - 1, pages]) {
        if (p >= 1 && p <= pages) seq.add(p);
    }
    return [...seq].sort((a, b) => a - b);
}

export function Pagination({ page, pages, total, size, noun, sizes, onPage, onSize }: PaginationProps) {
    const from = total ? (page - 1) * size + 1 : 0;
    const to = Math.min(page * size, total);
    const seq = pageSequence(page, pages);

    return (
        <nav className="pagination" aria-label="Pagination">
            <span className="pg-total">
                {total ? `${from}–${to} sur ${fmtInt(total)} ${plural(total, noun)}` : "Aucun résultat"}
            </span>
            {sizes && onSize && (
                <label className="pg-size">
                    <span className="small muted">Par page</span>
                    <select className="select" aria-label="Éléments par page" value={size} onChange={(e) => onSize(Number(e.target.value))}>
                        {sizes.map((s) => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                </label>
            )}
            <div className="pg-pages">
                <button type="button" className="pg-btn" disabled={page <= 1} aria-label="Page précédente" onClick={() => onPage(page - 1)}>
                    <Icon name="chevron-left" />
                </button>
                {seq.map((p, i) => (
                    <Fragment key={p}>
                        {i > 0 && p - seq[i - 1] > 1 && <span className="pg-ellipsis" aria-hidden="true">…</span>}
                        <button
                            type="button"
                            className="pg-btn"
                            aria-current={p === page ? "page" : undefined}
                            aria-label={`Page ${p}`}
                            onClick={() => onPage(p)}
                        >
                            {p}
                        </button>
                    </Fragment>
                ))}
                <button type="button" className="pg-btn" disabled={page >= pages} aria-label="Page suivante" onClick={() => onPage(page + 1)}>
                    <Icon name="chevron-right" />
                </button>
            </div>
        </nav>
    );
}
