import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { usePageTitle } from "../components/layout/shellContext";
import { useMovementDrawer } from "../components/movementDrawerContext";
import { StockBadge, TypeBadge } from "../components/ui/Badges";
import { Crumb, PageHead } from "../components/ui/Page";
import { Pagination } from "../components/ui/Pagination";
import { EmptyState, ErrorBanner, SkeletonPage, SkeletonRows } from "../components/ui/States";
import { useAuth } from "../context/auth";
import { useProductDelete } from "../hooks/useProductDelete";
import { useQuery } from "../hooks/useQuery";
import { ApiError, productsApi } from "../lib/api";
import { fmtDateTime, fmtInt, fmtMoney, plural, productRef } from "../lib/format";
import { movementUser, qtyTextClass, signedQty, stockState } from "../lib/inventory";
import { gap } from "../lib/style";
import { NotFoundPage } from "./ErrorPages";

const HISTORY_SIZE = 8;

export default function ProductDetailPage() {
    usePageTitle("Détail du produit");
    const { id: idParam } = useParams();
    const id = Number(idParam);
    const [params, setParams] = useSearchParams();
    const page = Math.max(1, Number(params.get("page")) || 1);
    const { user, isAdmin } = useAuth();
    const navigate = useNavigate();
    const openMovement = useMovementDrawer();
    const askDelete = useProductDelete();

    const product = useQuery(`product-${id}`, (signal) => productsApi.get(id, signal), { enabled: id > 0 });
    const history = useQuery(
        `product-${id}-movements-${page}`,
        (signal) => productsApi.movements(id, { askedPage: page, pageSize: HISTORY_SIZE }, signal),
        { keepPrevious: true, enabled: id > 0 },
    );

    if (!(id > 0) || (product.error instanceof ApiError && product.error.status === 404)) return <NotFoundPage />;
    if (product.error) return <ErrorBanner error={product.error} title="Impossible de charger le produit." onRetry={product.reload} />;
    if (!product.data) return <SkeletonPage rows={8} />;

    const p = product.data;
    const state = stockState(p);
    const moves = history.data;

    return (
        <>
            <PageHead
                title={p.name}
                lede={`${p.categoryName ?? "Sans catégorie"} · ${productRef(p.id)}`}
                crumbs={<><Crumb to="/produits">Produits</Crumb><span>{p.name}</span></>}
                actions={
                    isAdmin && (
                        <>
                            <button type="button" className="btn btn-primary" onClick={() => openMovement(p)}>
                                <Icon name="moves" />Nouveau mouvement
                            </button>
                            <Link className="btn btn-secondary" to={`/produits/${p.id}/modifier`}><Icon name="pencil" />Modifier</Link>
                            <button
                                type="button"
                                className="btn btn-danger-outline"
                                onClick={() => askDelete(p, { fromDetail: true, onDeleted: () => navigate("/produits") })}
                            >
                                <Icon name="trash" />Supprimer
                            </button>
                        </>
                    )
                }
            />
            <div className="detail-grid">
                <section className="card" aria-labelledby="info-title">
                    <div className="card-head">
                        <h2 id="info-title">Informations</h2>
                        <StockBadge product={p} />
                    </div>
                    <div className="card-body">
                        <div className="od-grid" style={gap(16, { "--od-cols": 2, marginBottom: 16 })}>
                            <span className="stock-big">
                                <span className={`v${state === "out" ? " text-danger" : state === "low" ? " text-warning" : ""}`}>{fmtInt(p.stock)}</span>
                                <span className="l">Unités en stock</span>
                            </span>
                            <span className="stock-big">
                                <span className="v">{fmtMoney(p.price * p.stock)}</span>
                                <span className="l">Valeur du stock</span>
                            </span>
                        </div>
                        <dl className="dl">
                            <div className="dl-row"><dt>Prix unitaire</dt><dd>{fmtMoney(p.price)}</dd></div>
                            <div className="dl-row">
                                <dt>Seuil de stock bas</dt>
                                <dd>{fmtInt(p.lowStockThreshold)} <span className="sub">Alerte dès que le stock est inférieur ou égal</span></dd>
                            </div>
                            <div className="dl-row"><dt>Catégorie</dt><dd>{p.categoryName ?? "—"}</dd></div>
                        </dl>
                    </div>
                    {!isAdmin && (
                        <div className="card-foot muted"><Icon name="lock" /> Lecture seule : le rôle User ne peut pas modifier les produits.</div>
                    )}
                </section>

                <section className="card" aria-labelledby="hist-title">
                    <div className="card-head">
                        <h2 id="hist-title">Historique des mouvements</h2>
                        {moves && <span className="small muted">{fmtInt(moves.totalItems)} {plural(moves.totalItems, "mouvement")}</span>}
                    </div>
                    {history.error ? (
                        <div className="card-body"><ErrorBanner error={history.error} onRetry={history.reload} /></div>
                    ) : !moves ? (
                        <SkeletonRows rows={HISTORY_SIZE} />
                    ) : moves.totalItems ? (
                        <>
                            <div className={`table-wrap${history.refreshing ? " is-refreshing" : ""}`}>
                                <table className="table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Date</th>
                                            <th scope="col">Type</th>
                                            <th scope="col" className="num">Quantité</th>
                                            <th scope="col">Entrepôt</th>
                                            <th scope="col">Utilisateur</th>
                                            <th scope="col">Notes</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {moves.movements.map((m) => (
                                            <tr key={m.id}>
                                                <td className="od-nowrap">{fmtDateTime(m.date)}</td>
                                                <td><TypeBadge type={m.type} /></td>
                                                <td className="num"><strong className={qtyTextClass(m)}>{signedQty(m.delta)}</strong></td>
                                                <td>{m.warehouseName}</td>
                                                <td className="small">{movementUser(m.userId, user?.id)}</td>
                                                <td className="small muted">{m.notes || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <Pagination
                                page={page}
                                pages={Math.max(1, moves.totalPages)}
                                total={moves.totalItems}
                                size={HISTORY_SIZE}
                                noun="mouvement"
                                onPage={(next) => setParams({ page: String(next) }, { replace: true })}
                            />
                        </>
                    ) : (
                        <EmptyState
                            icon="history"
                            title="Aucun mouvement enregistré"
                            text="Les entrées, sorties et ajustements de ce produit apparaîtront ici."
                            actions={isAdmin && (
                                <button type="button" className="btn btn-secondary" onClick={() => openMovement(p)}>
                                    <Icon name="plus" />Enregistrer un mouvement
                                </button>
                            )}
                        />
                    )}
                </section>
            </div>
        </>
    );
}
