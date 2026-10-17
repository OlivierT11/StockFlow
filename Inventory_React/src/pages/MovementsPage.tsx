import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { usePageTitle } from "../components/layout/shellContext";
import { useMovementDrawer } from "../components/movementDrawerContext";
import { TypeBadge } from "../components/ui/Badges";
import { PageHead } from "../components/ui/Page";
import { Pagination } from "../components/ui/Pagination";
import { EmptyState, ErrorBanner, SkeletonPage } from "../components/ui/States";
import { useAuth } from "../context/auth";
import { useQuery } from "../hooks/useQuery";
import { movementsApi, warehousesApi } from "../lib/api";
import { addDays, fmtDateTime, fmtInt, parseDay, plural } from "../lib/format";
import { movementUser, qtyTextClass, signedQty } from "../lib/inventory";

const SIZES = [10, 25, 50, 100];

function readParams(params: URLSearchParams) {
    const size = Number(params.get("size"));
    return {
        from: params.get("du") ?? "",
        to: params.get("au") ?? "",
        warehouse: params.get("entrepot") ?? "",
        page: Math.max(1, Number(params.get("page")) || 1),
        size: SIZES.includes(size) ? size : 25,
    };
}

export default function MovementsPage() {
    usePageTitle("Mouvements de stock");
    const { user, isAdmin } = useAuth();
    const openMovement = useMovementDrawer();
    const [params, setParams] = useSearchParams();
    const q = readParams(params);
    const rangeError = q.from && q.to && q.from > q.to ? "La date de fin doit être postérieure à la date de début." : "";
    const active = Boolean(q.from || q.to || q.warehouse);

    function apply(patch: Record<string, string | number>) {
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const [k, v] of Object.entries(patch)) {
                    if (v === "") next.delete(k);
                    else next.set(k, String(v));
                }
                if (!("page" in patch)) next.delete("page");
                return next;
            },
            { replace: true },
        );
    }
    const clear = () => apply({ du: "", au: "", entrepot: "" });

    const warehouses = useQuery("warehouses", (signal) => warehousesApi.list(signal));
    const list = useQuery(
        `movements?${params.toString()}`,
        (signal) =>
            movementsApi.list(
                {
                    warehouseId: q.warehouse ? Number(q.warehouse) : undefined,
                    // "Du" and "Au" are local days; the API compares From <= date < To in UTC.
                    from: q.from ? parseDay(q.from).toISOString() : undefined,
                    to: q.to ? addDays(parseDay(q.to), 1).toISOString() : undefined,
                    askedPage: q.page,
                    pageSize: q.size,
                },
                signal,
            ),
        { keepPrevious: true, enabled: !rangeError },
    );

    if (list.loading && !rangeError) return <SkeletonPage rows={12} />;

    const data = list.data;
    const total = data?.totalItems ?? 0;

    return (
        <>
            <PageHead
                title="Mouvements de stock"
                lede={data ? `${fmtInt(total)} ${plural(total, "mouvement")} ${active ? "sur la sélection" : plural(total, "enregistré")}` : undefined}
                actions={
                    <>
                        <span title="Export disponible dans une prochaine version">
                            <button type="button" className="btn btn-secondary" disabled aria-describedby="csv-hint">
                                <Icon name="download" />Exporter en CSV
                            </button>
                        </span>
                        <span className="sr-only" id="csv-hint">Export CSV non disponible dans cette version.</span>
                        {isAdmin && (
                            <button type="button" className="btn btn-primary" onClick={() => openMovement()}>
                                <Icon name="plus" />Nouveau mouvement
                            </button>
                        )}
                    </>
                }
            />
            <section className="card">
                <form className="toolbar" aria-label="Filtrer les mouvements" onSubmit={(e) => e.preventDefault()}>
                    <div className="field f-date">
                        <label className="field-label" htmlFor="f-du">Du</label>
                        <input className="input" id="f-du" name="du" type="date" value={q.from} onChange={(e) => apply({ du: e.target.value })} />
                    </div>
                    <div className={`field f-date${rangeError ? " has-error" : ""}`}>
                        <label className="field-label" htmlFor="f-au">Au</label>
                        <input
                            className="input"
                            id="f-au"
                            name="au"
                            type="date"
                            value={q.to}
                            min={q.from || undefined}
                            aria-invalid={rangeError ? true : undefined}
                            aria-describedby={rangeError ? "f-au-err" : undefined}
                            onChange={(e) => apply({ au: e.target.value })}
                        />
                    </div>
                    <div className="field f-cat">
                        <label className="field-label" htmlFor="f-wh">Entrepôt</label>
                        <select className="select" id="f-wh" name="entrepot" value={q.warehouse} onChange={(e) => apply({ entrepot: e.target.value })}>
                            <option value="">Tous</option>
                            {warehouses.data?.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                        </select>
                    </div>
                    <div className="toolbar-end">
                        {active && <button type="button" className="btn btn-ghost" onClick={clear}><Icon name="x" />Effacer les filtres</button>}
                    </div>
                </form>

                {rangeError && (
                    <div className="card-body">
                        <div className="banner banner-warning" role="alert" id="f-au-err">
                            <Icon name="alert" /><span className="banner-text">{rangeError}</span>
                        </div>
                    </div>
                )}
                {!!list.error && !rangeError && (
                    <div className="card-body">
                        <ErrorBanner error={list.error} title="Impossible de charger les mouvements." onRetry={list.reload} />
                    </div>
                )}

                {data && !rangeError && (
                    <div className={`table-wrap${list.refreshing ? " is-refreshing" : ""}`}>
                        {total ? (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th scope="col">Date</th>
                                        <th scope="col">Produit</th>
                                        <th scope="col">Type</th>
                                        <th scope="col" className="num">Quantité</th>
                                        <th scope="col">Entrepôt</th>
                                        <th scope="col">Utilisateur</th>
                                        <th scope="col">Notes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.movements.map((m) => (
                                        <tr key={m.id}>
                                            <td className="od-nowrap">{fmtDateTime(m.date)}</td>
                                            <td><Link className="cell-primary" to={`/produits/${m.productId}`}>{m.productName}</Link></td>
                                            <td><TypeBadge type={m.type} /></td>
                                            <td className="num"><strong className={qtyTextClass(m)}>{signedQty(m.delta)}</strong></td>
                                            <td>{m.warehouseName}</td>
                                            <td className="small">{movementUser(m.userId, user?.id)}</td>
                                            <td className="small muted">{m.notes || "—"}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <EmptyState
                                icon="history"
                                title="Aucun mouvement sur cette période"
                                text={active ? "Élargissez la période ou retirez un filtre." : "Les mouvements de stock apparaîtront ici dès qu’ils seront enregistrés."}
                                actions={active && <button type="button" className="btn btn-secondary" onClick={clear}>Effacer les filtres</button>}
                            />
                        )}
                    </div>
                )}

                {data && !rangeError && total > 0 && (
                    <Pagination
                        page={q.page}
                        pages={Math.max(1, data.totalPages)}
                        total={total}
                        size={q.size}
                        sizes={SIZES}
                        noun="mouvement"
                        onPage={(page) => apply({ page })}
                        onSize={(size) => apply({ size })}
                    />
                )}
            </section>
        </>
    );
}
