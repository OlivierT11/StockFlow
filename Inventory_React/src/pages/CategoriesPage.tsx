import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EntityFormModal } from "../components/EntityFormModal";
import { Icon } from "../components/Icon";
import { usePageTitle } from "../components/layout/shellContext";
import { useConfirm } from "../components/ui/confirmContext";
import { PageHead } from "../components/ui/Page";
import { EmptyState, ErrorBanner, SkeletonPage } from "../components/ui/States";
import { useAuth } from "../context/auth";
import { useData } from "../context/data";
import { useToast } from "../context/toast";
import { useQuery } from "../hooks/useQuery";
import { ApiError, categoriesApi, errorMessage, productsApi } from "../lib/api";
import { fmtInt, fmtMoney, plural } from "../lib/format";
import { stockState } from "../lib/inventory";
import type { Category } from "../lib/types";

export default function CategoriesPage() {
    usePageTitle("Catégories");
    const { isAdmin } = useAuth();
    const confirm = useConfirm();
    const toast = useToast();
    const navigate = useNavigate();
    const { invalidate } = useData();
    const [editing, setEditing] = useState<{ category: Category | null } | null>(null);

    const categories = useQuery("categories", (signal) => categoriesApi.list(signal));
    // Counts and stock value per category come from the whole catalogue.
    const products = useQuery("categories-products", (signal) => productsApi.all(signal));

    if (categories.error) return <ErrorBanner error={categories.error} title="Impossible de charger les catégories." onRetry={categories.reload} />;
    if (!categories.data) return <SkeletonPage rows={5} />;

    const rows = categories.data.map((c) => {
        const own = products.data?.filter((p) => p.categoryId === c.id);
        return {
            ...c,
            count: own?.length,
            low: own?.filter((p) => stockState(p) !== "ok").length,
            value: own?.reduce((s, p) => s + p.price * p.stock, 0),
        };
    });
    const pending = <span className="muted">…</span>;

    function askDelete(row: (typeof rows)[number]) {
        if (row.count) {
            confirm({
                title: "Suppression impossible",
                confirmLabel: "Voir les produits",
                body: (
                    <p>
                        <strong>{row.name}</strong> est encore rattachée à <strong>{row.count} {plural(row.count, "produit")}</strong>.
                        Réaffectez ces produits à une autre catégorie avant de la supprimer.
                    </p>
                ),
                onConfirm: () => navigate(`/produits?cat=${row.id}`),
            });
            return;
        }
        confirm({
            title: "Supprimer cette catégorie ?",
            danger: true,
            confirmLabel: "Supprimer",
            body: <p><strong>{row.name}</strong> ne contient aucun produit et sera supprimée.</p>,
            onConfirm: async () => {
                try {
                    await categoriesApi.remove(row.id);
                    toast("success", "Catégorie supprimée", row.name);
                    invalidate();
                } catch (err) {
                    toast("error", "Suppression refusée", err instanceof ApiError && err.status === 409 && err.detail ? err.detail : errorMessage(err));
                    invalidate();
                }
            },
        });
    }

    const nameRule = (id: number | null) => (v: string) =>
        !v ? "Le nom est obligatoire."
            : v.length > 100 ? "100 caractères maximum."
                : categories.data?.some((c) => c.name.toLowerCase() === v.toLowerCase() && c.id !== id) ? "Cette catégorie existe déjà."
                    : "";

    return (
        <>
            <PageHead
                title="Catégories"
                lede={`${rows.length} ${plural(rows.length, "catégorie")} · chaque produit appartient à une catégorie.`}
                actions={isAdmin && (
                    <button type="button" className="btn btn-primary" onClick={() => setEditing({ category: null })}>
                        <Icon name="plus" />Nouvelle catégorie
                    </button>
                )}
            />
            <section className="card">
                <div className="table-wrap">
                    {rows.length ? (
                        <table className="table">
                            <thead>
                                <tr>
                                    <th scope="col">Nom</th>
                                    <th scope="col" className="num">Produits</th>
                                    <th scope="col" className="num">Sous seuil</th>
                                    <th scope="col" className="num">Valeur du stock</th>
                                    <th scope="col"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        <td><Link className="cell-primary" to={`/produits?cat=${r.id}`}>{r.name}</Link></td>
                                        <td className="num">{r.count === undefined ? pending : fmtInt(r.count)}</td>
                                        <td className="num">
                                            {r.low === undefined ? pending : r.low ? <span className="badge badge-low">{r.low}</span> : <span className="muted">0</span>}
                                        </td>
                                        <td className="num">{r.value === undefined ? pending : fmtMoney(r.value)}</td>
                                        <td>
                                            <div className="row-actions">
                                                {isAdmin && (
                                                    <>
                                                        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Modifier ${r.name}`} title="Modifier" onClick={() => setEditing({ category: r })}>
                                                            <Icon name="pencil" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-ghost btn-icon btn-sm danger"
                                                            aria-label={`Supprimer ${r.name}`}
                                                            title="Supprimer"
                                                            disabled={r.count === undefined}
                                                            onClick={() => askDelete(r)}
                                                        >
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
                            icon="tag"
                            title="Aucune catégorie"
                            text="Créez une première catégorie pour classer vos produits."
                            actions={isAdmin && (
                                <button type="button" className="btn btn-primary" onClick={() => setEditing({ category: null })}>
                                    <Icon name="plus" />Nouvelle catégorie
                                </button>
                            )}
                        />
                    )}
                </div>
                {!!products.error && (
                    <div className="card-foot"><ErrorBanner error={products.error} title="Compteurs indisponibles." onRetry={products.reload} /></div>
                )}
                {!isAdmin && (
                    <div className="card-foot muted"><Icon name="lock" /> Lecture seule : la gestion des catégories est réservée aux administrateurs.</div>
                )}
            </section>

            {editing && (
                <EntityFormModal
                    title={editing.category ? "Modifier la catégorie" : "Nouvelle catégorie"}
                    fields={[
                        {
                            name: "name",
                            label: "Nom",
                            required: true,
                            value: editing.category?.name ?? "",
                            maxLength: 100,
                            hint: "100 caractères maximum.",
                            validate: nameRule(editing.category?.id ?? null),
                        },
                    ]}
                    onSave={async ({ name }) => {
                        if (editing.category) {
                            await categoriesApi.update(editing.category.id, { name });
                            toast("success", "Catégorie modifiée", name);
                        } else {
                            await categoriesApi.create({ name });
                            toast("success", "Catégorie créée", name);
                        }
                        invalidate();
                    }}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}
