import { Link, useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { usePageTitle } from "../components/layout/shellContext";
import { useMovementDrawer } from "../components/movementDrawerContext";
import { ChartTable, StockChart, type ChartDay } from "../components/StockChart";
import { TypeBadge } from "../components/ui/Badges";
import { PageHead } from "../components/ui/Page";
import { EmptyState, ErrorBanner, SkeletonHead } from "../components/ui/States";
import { useAuth } from "../context/auth";
import { useQuery } from "../hooks/useQuery";
import { categoriesApi, dashboardApi, movementsApi, warehousesApi } from "../lib/api";
import { addDays, fmtCompactMoney, fmtDateTime, fmtInt, fmtMoney, isoDay, plural, relTime, startOfDay } from "../lib/format";
import { movementUser, qtyTextClass, signedQty } from "../lib/inventory";
import { gap } from "../lib/style";
import type { StockMovement } from "../lib/types";

function DashboardSkeleton() {
    return (
        <div className="od-stack" style={gap(24)} aria-busy="true" aria-label="Chargement du tableau de bord">
            <SkeletonHead />
            <div className="tiles">
                {[0, 1, 2, 3].map((i) => <span key={i} className="skeleton sk-tile" />)}
            </div>
            <div className="dash-grid">
                <span className="skeleton sk-block" style={{ height: 320, borderRadius: 8 }} />
                <span className="skeleton sk-block" style={{ height: 320, borderRadius: 8 }} />
            </div>
        </div>
    );
}

/** Last 7 days (today included), number of In and Out movements per day. */
function chartSeries(movements: StockMovement[], today: Date): ChartDay[] {
    const days = Array.from({ length: 7 }, (_, i) => ({ date: addDays(startOfDay(today), i - 6), in: 0, out: 0 }));
    const byKey = new Map(days.map((d) => [isoDay(d.date), d]));
    for (const m of movements) {
        const day = byKey.get(isoDay(m.date));
        if (!day) continue;
        if (m.type === "In") day.in++;
        else if (m.type === "Out") day.out++;
    }
    return days;
}

function firstName(email: string) {
    const name = email.split("@")[0].split(/[._-]/)[0] ?? "";
    return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function DashboardPage() {
    usePageTitle("Tableau de bord");
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const openMovement = useMovementDrawer();

    const now = new Date();
    const todayKey = isoDay(now);
    const dash = useQuery("dashboard", (signal) => dashboardApi.get(signal));
    const meta = useQuery("dashboard-meta", (signal) => Promise.all([categoriesApi.list(signal), warehousesApi.list(signal)]));
    const week = useQuery(`dashboard-week-${todayKey}`, (signal) =>
        movementsApi.all({ from: addDays(startOfDay(new Date()), -6).toISOString() }, signal),
    );

    if (dash.error) return <ErrorBanner error={dash.error} title="Tableau de bord indisponible." onRetry={dash.reload} />;
    if (!dash.data) return <DashboardSkeleton />;

    const d = dash.data;
    const outCount = d.lowStockProducts.filter((p) => p.stock === 0).length;
    const days = week.data ? chartSeries(week.data, now) : null;
    const today = week.data?.filter((m) => isoDay(m.date) === todayKey) ?? [];
    const yesterdayKey = isoDay(addDays(now, -1));
    const yesterdayCount = week.data?.filter((m) => isoDay(m.date) === yesterdayKey).length ?? 0;
    const todayIn = today.filter((m) => m.type === "In").length;
    const todayOut = today.filter((m) => m.type === "Out").length;
    const greet = now.getHours() < 18 ? "Bonjour" : "Bonsoir";
    const dayLabel = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

    return (
        <>
            <PageHead
                title="Tableau de bord"
                lede={`${greet} ${firstName(user?.email ?? "")}, voici l’état du stock ce ${dayLabel}.`}
                actions={
                    isAdmin ? (
                        <>
                            <button type="button" className="btn btn-secondary" onClick={() => navigate("/produits/nouveau")}>
                                <Icon name="plus" />Produit
                            </button>
                            <button type="button" className="btn btn-primary" onClick={() => openMovement()}>
                                <Icon name="moves" />Nouveau mouvement
                            </button>
                        </>
                    ) : (
                        <Link className="btn btn-secondary" to="/mouvements"><Icon name="history" />Journal des mouvements</Link>
                    )
                }
            />

            <section className="tiles" aria-label="Indicateurs clés">
                <Link className="card tile" to="/produits">
                    <span className="tile-label"><Icon name="package" />Produits référencés</span>
                    <span className="tile-value">{fmtInt(d.productCount)}</span>
                    <span className="tile-delta">
                        {meta.data ? `${meta.data[0].length} ${plural(meta.data[0].length, "catégorie")} · ${meta.data[1].length} ${plural(meta.data[1].length, "entrepôt")}` : "…"}
                    </span>
                    <span className="tile-cta"><Icon name="arrow-right" /></span>
                </Link>
                <div className="card tile">
                    <span className="tile-label"><Icon name="euro" />Valeur totale du stock</span>
                    <span className="tile-value">{fmtCompactMoney(d.totalStockValue)}</span>
                    <span className="tile-delta">{fmtMoney(d.totalStockValue)} au prix d’achat</span>
                </div>
                <Link className={`card tile${d.lowStockProductCount ? " is-alert" : ""}`} to="/produits?low=1">
                    <span className="tile-label"><Icon name="alert" />Produits sous seuil</span>
                    <span className="tile-value">{fmtInt(d.lowStockProductCount)}</span>
                    <span className={`tile-delta${outCount ? " bad" : ""}`}>
                        {outCount ? <><Icon name="alert-circle" />dont {outCount} en rupture</> : "Aucune rupture"}
                    </span>
                    <span className="tile-cta"><Icon name="arrow-right" /></span>
                </Link>
                <Link className="card tile" to={`/mouvements?du=${todayKey}&au=${todayKey}`}>
                    <span className="tile-label"><Icon name="moves" />Mouvements du jour</span>
                    <span className="tile-value">{week.data ? fmtInt(today.length) : "…"}</span>
                    {week.data ? (
                        <span className={`tile-delta ${today.length >= yesterdayCount ? "up" : "down"}`}>
                            <Icon name="arrow-up" />
                            {todayIn} {plural(todayIn, "entrée")} · {todayOut} {plural(todayOut, "sortie")} · hier : {yesterdayCount}
                        </span>
                    ) : (
                        <span className="tile-delta">{week.error ? "Indisponible" : "Chargement…"}</span>
                    )}
                    <span className="tile-cta"><Icon name="arrow-right" /></span>
                </Link>
            </section>

            <div className="dash-grid">
                <section className="card" aria-labelledby="chart-title">
                    <div className="card-head">
                        <div className="od-stack" style={gap(2)}>
                            <h2 id="chart-title">Entrées et sorties sur 7 jours</h2>
                            <span className="small muted">Nombre de mouvements par jour, tous entrepôts</span>
                        </div>
                        <div className="chart-legend" aria-label="Légende">
                            <span><i className="k-in" />Entrées</span>
                            <span><i className="k-out" />Sorties</span>
                        </div>
                    </div>
                    <div className="card-body">
                        {week.error ? (
                            <ErrorBanner error={week.error} onRetry={week.reload} />
                        ) : days ? (
                            <>
                                <StockChart days={days} labelledBy="chart-title" />
                                <details className="chart-details">
                                    <summary><Icon name="chevron-down" />Voir les valeurs en tableau</summary>
                                    <ChartTable days={days} />
                                </details>
                            </>
                        ) : (
                            <span className="skeleton sk-block" style={{ display: "block", height: 220 }} />
                        )}
                    </div>
                </section>

                <section className="card" aria-labelledby="low-title">
                    <div className="card-head">
                        <h2 id="low-title">Produits sous seuil</h2>
                        <Link className="btn btn-ghost btn-sm" to="/produits?low=1">Voir tout<Icon name="arrow-right" /></Link>
                    </div>
                    {d.lowStockProducts.length ? (
                        <ul className="mini-list">
                            {d.lowStockProducts.slice(0, 5).map((p) => (
                                <li key={p.id}>
                                    <span className="mv-meta">
                                        <Link className="mv-title od-truncate" to={`/produits/${p.id}`}>{p.name}</Link>
                                        <span className="mv-sub">{p.categoryName ?? "Sans catégorie"} · seuil {fmtInt(p.lowStockThreshold)}</span>
                                        <span className="stock-meter" aria-hidden="true">
                                            <i
                                                className={p.stock === 0 ? "out" : undefined}
                                                style={{ width: `${Math.min(100, Math.round((p.stock / Math.max(1, p.lowStockThreshold)) * 100))}%` }}
                                            />
                                        </span>
                                    </span>
                                    <span className="od-stat" style={{ textAlign: "right" }}>
                                        <span className={`mv-qty${p.stock === 0 ? " out" : ""}`}>{fmtInt(p.stock)}</span>
                                        <span className="small muted">{p.stock === 0 ? "rupture" : "en stock"}</span>
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <EmptyState icon="check-circle" title="Tous les stocks sont au-dessus du seuil" text="Aucun produit ne nécessite de réapprovisionnement." />
                    )}
                </section>
            </div>

            <section className="card" aria-labelledby="recent-title">
                <div className="card-head">
                    <h2 id="recent-title">Derniers mouvements</h2>
                    <Link className="btn btn-ghost btn-sm" to="/mouvements">Journal complet<Icon name="arrow-right" /></Link>
                </div>
                {d.recentMovements.length ? (
                    <div className="table-wrap">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">Date</th>
                                    <th scope="col">Produit</th>
                                    <th scope="col">Type</th>
                                    <th scope="col" className="num">Quantité</th>
                                    <th scope="col">Entrepôt</th>
                                    <th scope="col">Utilisateur</th>
                                </tr>
                            </thead>
                            <tbody>
                                {d.recentMovements.slice(0, 8).map((m) => (
                                    <tr key={m.id}>
                                        <td className="od-nowrap">
                                            <span className="cell-stack">
                                                <span>{fmtDateTime(m.date)}</span>
                                                <span className="cell-sub">{relTime(m.date)}</span>
                                            </span>
                                        </td>
                                        <td><Link className="cell-primary" to={`/produits/${m.productId}`}>{m.productName}</Link></td>
                                        <td><TypeBadge type={m.type} /></td>
                                        <td className="num"><strong className={qtyTextClass(m)}>{signedQty(m.delta)}</strong></td>
                                        <td>{m.warehouseName}</td>
                                        <td className="small">{movementUser(m.userId, user?.id)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <EmptyState icon="history" title="Aucun mouvement enregistré" text="Les entrées, sorties et ajustements apparaîtront ici." />
                )}
            </section>
        </>
    );
}
