import { useEffect, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { usePageTitle, useShell } from "../components/layout/shellContext";
import { StockBadge } from "../components/ui/Badges";
import { PageHead } from "../components/ui/Page";
import { Pagination } from "../components/ui/Pagination";
import { EmptyState, ErrorBanner, SkeletonPage } from "../components/ui/States";
import { SortHeader } from "../components/ui/Table";
import { useAuth } from "../context/auth";
import { useDebouncedCallback } from "../hooks/useDebouncedCallback";
import { useProductDelete } from "../hooks/useProductDelete";
import { useQuery } from "../hooks/useQuery";
import { categoriesApi, productsApi } from "../lib/api";
import { fmtInt, fmtMoney, plural, productRef } from "../lib/format";
import { stockState } from "../lib/inventory";
import { gap } from "../lib/style";
import type { ProductSort, SortDirection } from "../lib/types";

const SIZES = [10, 25, 50, 100];
const SORTS: ProductSort[] = ["name", "price", "stock"];
/** The API only accepts unaccented letters, digits and spaces in the name filter. */
const SEARCH_RE = /^[a-zA-Z0-9 ]*$/;

type Filters = { search: string; cat: string; min: string; max: string; low: boolean };

function readParams(params: URLSearchParams) {
    const size = Number(params.get("size"));
    const sort = params.get("sort") as ProductSort;
    return {
        search: params.get("search") ?? "",
        cat: params.get("cat") ?? "",
        min: params.get("min") ?? "",
        max: params.get("max") ?? "",
        low: params.get("low") === "1",
        sort: SORTS.includes(sort) ? sort : "name",
        dir: (params.get("dir") === "desc" ? "desc" : "asc") as SortDirection,
        page: Math.max(1, Number(params.get("page")) || 1),
        size: SIZES.includes(size) ? size : 10,
    };
}

const priceError = (v: string) => (v !== "" && (Number(v) < 0 || Number(v) > 1_000_000) ? "Entre 0 et 1 000 000 €." : "");

export default function ProductsPage() {
    usePageTitle("Produits");
    const { isAdmin } = useAuth();
    const { productCount, lowStockCount } = useShell();
    const askDelete = useProductDelete();
    const [params, setParams] = useSearchParams();
    const q = readParams(params);

    // Inputs keep their own text; the URL holds the applied filters.
    const [draft, setDraft] = useState<Filters>({ search: q.search, cat: q.cat, min: q.min, max: q.max, low: q.low });
    // Follow URL changes made elsewhere (nav link, dashboard tile, back button) without fighting the typing.
    const urlFilters = [q.search, q.cat, q.min, q.max, q.low].join("|");
    const [syncedFilters, setSyncedFilters] = useState(urlFilters);
    if (urlFilters !== syncedFilters) {
        setSyncedFilters(urlFilters);
        setDraft((d) => ({ search: d.search.trim() === q.search ? d.search : q.search, cat: q.cat, min: q.min, max: q.max, low: q.low }));
    }
    const searchError = SEARCH_RE.test(draft.search) ? "" : "Recherche limitée aux lettres sans accents, aux chiffres et aux espaces.";

    function apply(patch: Record<string, string | number | boolean>) {
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                for (const [k, v] of Object.entries(patch)) {
                    if (v === "" || v === false || v === null) next.delete(k);
                    else next.set(k, v === true ? "1" : String(v));
                }
                if (!("page" in patch)) next.delete("page");
                return next;
            },
            { replace: true },
        );
    }

    const applySearch = useDebouncedCallback((search: string) => {
        if (SEARCH_RE.test(search)) apply({ search: search.trim() });
    }, 300);

    function applyDraft(next: Filters) {
        apply({
            search: SEARCH_RE.test(next.search) ? next.search.trim() : q.search,
            cat: next.cat,
            min: priceError(next.min) ? q.min : next.min,
            max: priceError(next.max) ? q.max : next.max,
            low: next.low,
        });
    }

    function clearAll() {
        const empty: Filters = { search: "", cat: "", min: "", max: "", low: false };
        setDraft(empty);
        applyDraft(empty);
    }

    const categories = useQuery("categories", (signal) => categoriesApi.list(signal));
    const list = useQuery(
        `products?${params.toString()}`,
        (signal) =>
            productsApi.paged(
                {
                    askedPage: q.page,
                    pageSize: q.size,
                    name: q.search || undefined,
                    categoryId: q.cat ? Number(q.cat) : undefined,
                    minPrice: q.min !== "" ? Number(q.min) : undefined,
                    maxPrice: q.max !== "" ? Number(q.max) : undefined,
                    lowStockOnly: q.low || undefined,
                    sortBy: q.sort,
                    sortDirection: q.dir,
                },
                signal,
            ),
        { keepPrevious: true },
    );

    // After a delete the current page can disappear: go back to the last one.
    const totalPages = list.data?.totalPages ?? 0;
    useEffect(() => {
        if (totalPages > 0 && q.page > totalPages) apply({ page: totalPages });
    });

    const catName = (id: string) => categories.data?.find((c) => String(c.id) === id)?.name ?? `n° ${id}`;
    const active: { key: string; label: string; clear: Partial<Filters> }[] = [];
    if (q.search) active.push({ key: "search", label: `Recherche : « ${q.search} »`, clear: { search: "" } });
    if (q.cat) active.push({ key: "cat", label: `Catégorie : ${catName(q.cat)}`, clear: { cat: "" } });
    if (q.min !== "" || q.max !== "") {
        active.push({
            key: "price",
            label: `Prix : ${q.min !== "" ? fmtMoney(Number(q.min)) : "0 €"} – ${q.max !== "" ? fmtMoney(Number(q.max)) : "∞"}`,
            clear: { min: "", max: "" },
        });
    }
    if (q.low) active.push({ key: "low", label: "Stock bas uniquement", clear: { low: false } });

    if (list.loading && !list.error) return <SkeletonPage />;

    const data = list.data;
    const total = data?.totalItems ?? 0;
    const onSort = (key: ProductSort) => apply({ sort: key, dir: q.sort === key && q.dir === "asc" ? "desc" : "asc" });

    return (
        <>
            <PageHead
                title="Produits"
                lede={productCount !== null && lowStockCount !== null
                    ? `${fmtInt(productCount)} ${plural(productCount, "produit")} ${plural(productCount, "référencé")} · ${fmtInt(lowStockCount)} à surveiller`
                    : undefined}
                actions={isAdmin && <Link className="btn btn-primary" to="/produits/nouveau"><Icon name="plus" />Ajouter un produit</Link>}
            />
            <section className="card">
                <form
                    className="toolbar"
                    role="search"
                    aria-label="Filtrer les produits"
                    onSubmit={(e: FormEvent) => {
                        e.preventDefault();
                        applyDraft(draft);
                    }}
                >
                    <div className={`field f-search${searchError ? " has-error" : ""}`}>
                        <label className="field-label" htmlFor="f-search">Recherche</label>
                        <div className="input-search">
                            <Icon name="search" />
                            <input
                                className="input"
                                id="f-search"
                                name="search"
                                type="search"
                                placeholder="Nom du produit"
                                value={draft.search}
                                aria-invalid={searchError ? true : undefined}
                                aria-describedby={searchError ? "f-search-err" : undefined}
                                onChange={(e) => {
                                    setDraft((d) => ({ ...d, search: e.target.value }));
                                    applySearch(e.target.value);
                                }}
                            />
                        </div>
                        {searchError && (
                            <span className="field-error" id="f-search-err"><Icon name="alert-circle" /><span>{searchError}</span></span>
                        )}
                    </div>
                    <div className="field f-cat">
                        <label className="field-label" htmlFor="f-cat">Catégorie</label>
                        <select
                            className="select"
                            id="f-cat"
                            name="cat"
                            value={draft.cat}
                            onChange={(e) => {
                                const next = { ...draft, cat: e.target.value };
                                setDraft(next);
                                apply({ cat: next.cat });
                            }}
                        >
                            <option value="">Toutes</option>
                            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    {(["min", "max"] as const).map((k) => (
                        <div key={k} className={`field f-price${priceError(draft[k]) ? " has-error" : ""}`}>
                            <label className="field-label" htmlFor={`f-${k}`}>{k === "min" ? "Prix min (€)" : "Prix max (€)"}</label>
                            <input
                                className="input"
                                id={`f-${k}`}
                                name={k}
                                type="number"
                                min={0}
                                step={0.01}
                                inputMode="decimal"
                                value={draft[k]}
                                aria-invalid={priceError(draft[k]) ? true : undefined}
                                title={priceError(draft[k]) || undefined}
                                onChange={(e) => setDraft((d) => ({ ...d, [k]: e.target.value }))}
                                onBlur={() => {
                                    if (!priceError(draft[k]) && draft[k] !== q[k]) apply({ [k]: draft[k] });
                                }}
                            />
                        </div>
                    ))}
                    <label className="check f-check">
                        <input
                            type="checkbox"
                            name="low"
                            checked={draft.low}
                            onChange={(e) => {
                                setDraft((d) => ({ ...d, low: e.target.checked }));
                                apply({ low: e.target.checked });
                            }}
                        />
                        Stock bas uniquement
                    </label>
                    <div className="toolbar-end">
                        {active.length > 0 && (
                            <button type="button" className="btn btn-ghost" onClick={clearAll}><Icon name="x" />Effacer les filtres</button>
                        )}
                    </div>
                </form>

                {active.length > 0 && (
                    <div className="toolbar-summary">
                        <span>{fmtInt(total)} {plural(total, "résultat")}</span>
                        {active.map((a) => (
                            <span key={a.key} className="filter-chip">
                                {a.label}
                                <button
                                    type="button"
                                    aria-label={`Retirer le filtre ${a.label}`}
                                    onClick={() => {
                                        const next = { ...draft, ...a.clear };
                                        setDraft(next);
                                        apply(a.clear);
                                    }}
                                >
                                    <Icon name="x" />
                                </button>
                            </span>
                        ))}
                    </div>
                )}

                {!!list.error && (
                    <div className="card-body">
                        <ErrorBanner error={list.error} title="Impossible de charger les produits." onRetry={list.reload} />
                    </div>
                )}

                {data && (
                    <div className={`table-wrap${list.refreshing ? " is-refreshing" : ""}`}>
                        {total ? (
                            <table className="table">
                                <thead>
                                    <tr>
                                        <SortHeader sortKey="name" label="Nom" sort={q.sort} dir={q.dir} onSort={onSort} />
                                        <th scope="col">Catégorie</th>
                                        <SortHeader sortKey="price" label="Prix" sort={q.sort} dir={q.dir} numeric onSort={onSort} />
                                        <SortHeader sortKey="stock" label="Stock" sort={q.sort} dir={q.dir} numeric onSort={onSort} />
                                        <th scope="col"><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.products.map((p) => (
                                        <tr key={p.id}>
                                            <td>
                                                <span className="cell-stack">
                                                    <Link className="cell-primary" to={`/produits/${p.id}`}>{p.name}</Link>
                                                    <span className="cell-sub">{productRef(p.id)}</span>
                                                </span>
                                            </td>
                                            <td>{p.categoryName ?? <span className="muted">—</span>}</td>
                                            <td className="num">{fmtMoney(p.price)}</td>
                                            <td className="num">
                                                <span className="od-row" style={gap(8, { justifyContent: "flex-end" })}>
                                                    <strong>{fmtInt(p.stock)}</strong>
                                                    {stockState(p) !== "ok" && <StockBadge product={p} />}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="row-actions">
                                                    <Link className="btn btn-ghost btn-icon btn-sm" to={`/produits/${p.id}`} aria-label={`Voir ${p.name}`} title="Voir">
                                                        <Icon name="eye" />
                                                    </Link>
                                                    {isAdmin && (
                                                        <>
                                                            <Link className="btn btn-ghost btn-icon btn-sm" to={`/produits/${p.id}/modifier`} aria-label={`Modifier ${p.name}`} title="Modifier">
                                                                <Icon name="pencil" />
                                                            </Link>
                                                            <button type="button" className="btn btn-ghost btn-icon btn-sm danger" aria-label={`Supprimer ${p.name}`} title="Supprimer" onClick={() => askDelete(p)}>
                                                                <Icon name="trash" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <EmptyState
                                icon="search"
                                title="Aucun produit ne correspond"
                                text={active.length ? "Essayez d’élargir la recherche ou de retirer un filtre." : "Le catalogue est vide. Ajoutez un premier produit pour commencer."}
                                actions={
                                    active.length
                                        ? <button type="button" className="btn btn-secondary" onClick={clearAll}>Effacer les filtres</button>
                                        : isAdmin && <Link className="btn btn-primary" to="/produits/nouveau"><Icon name="plus" />Ajouter un produit</Link>
                                }
                            />
                        )}
                    </div>
                )}
                {data && total > 0 && (
                    <Pagination
                        page={q.page}
                        pages={Math.max(1, data.totalPages)}
                        total={total}
                        size={q.size}
                        sizes={SIZES}
                        noun="produit"
                        onPage={(page) => apply({ page })}
                        onSize={(size) => apply({ size })}
                    />
                )}
            </section>
        </>
    );
}
