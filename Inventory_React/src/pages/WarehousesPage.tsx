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
import { ApiError, errorMessage, movementsApi, warehousesApi } from "../lib/api";
import { fmtDateTime, fmtInt, plural } from "../lib/format";
import type { Warehouse } from "../lib/types";

export default function WarehousesPage() {
    usePageTitle("Entrepôts");
    const { isAdmin } = useAuth();
    const confirm = useConfirm();
    const toast = useToast();
    const navigate = useNavigate();
    const { invalidate } = useData();
    const [editing, setEditing] = useState<{ warehouse: Warehouse | null } | null>(null);

    const warehouses = useQuery("warehouses", (signal) => warehousesApi.list(signal));
    const ids = warehouses.data?.map((w) => w.id) ?? [];
    // Movement count and latest movement per warehouse: one single-row page each.
    const stats = useQuery(
        `warehouse-stats-${ids.join(",")}`,
        (signal) => Promise.all(ids.map((id) => movementsApi.list({ warehouseId: id, pageSize: 1 }, signal))),
        { enabled: !!warehouses.data },
    );

    if (warehouses.error) return <ErrorBanner error={warehouses.error} title="Impossible de charger les entrepôts." onRetry={warehouses.reload} />;
    if (!warehouses.data) return <SkeletonPage rows={4} />;

    const rows = warehouses.data.map((w, i) => ({
        ...w,
        count: stats.data?.[i]?.totalItems,
        last: stats.data?.[i]?.movements[0]?.date ?? null,
    }));
    const pending = <span className="muted">…</span>;

    function askDelete(row: (typeof rows)[number]) {
        if (row.count) {
            confirm({
                title: "Suppression impossible",
                confirmLabel: "Voir les mouvements",
                body: (
                    <p>
                        <strong>{row.name}</strong> porte <strong>{row.count} {plural(row.count, "mouvement")}</strong> de stock.
                        L’historique doit rester consultable : un entrepôt avec des mouvements ne peut pas être supprimé.
                    </p>
                ),
                onConfirm: () => navigate(`/mouvements?entrepot=${row.id}`),
            });
            return;
        }
        confirm({
            title: "Supprimer cet entrepôt ?",
            danger: true,
            confirmLabel: "Supprimer",
            body: <p><strong>{row.name}</strong> n’a aucun mouvement et sera supprimé.</p>,
            onConfirm: async () => {
                try {
                    await warehousesApi.remove(row.id);
                    toast("success", "Entrepôt supprimé", row.name);
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
                : warehouses.data?.some((w) => w.name.toLowerCase() === v.toLowerCase() && w.id !== id) ? "Cet entrepôt existe déjà."
                    : "";

    return (
        <>
            <PageHead
                title="Entrepôts"
                lede={`${rows.length} ${plural(rows.length, "entrepôt")} · chaque mouvement est rattaché à un entrepôt.`}
                actions={isAdmin && (
                    <button type="button" className="btn btn-primary" onClick={() => setEditing({ warehouse: null })}>
                        <Icon name="plus" />Nouvel entrepôt
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
                                    <th scope="col" className="num">Mouvements</th>
                                    <th scope="col">Dernier mouvement</th>
                                    <th scope="col"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.id}>
                                        <td>
                                            <span className="cell-stack">
                                                <Link className="cell-primary" to={`/mouvements?entrepot=${r.id}`}>{r.name}</Link>
                                                {r.address && <span className="cell-sub">{r.address}</span>}
                                            </span>
                                        </td>
                                        <td className="num">{r.count === undefined ? pending : fmtInt(r.count)}</td>
                                        <td>{r.count === undefined ? pending : r.last ? fmtDateTime(r.last) : <span className="muted">—</span>}</td>
                                        <td>
                                            <div className="row-actions">
                                                {isAdmin && (
                                                    <>
                                                        <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label={`Modifier ${r.name}`} title="Modifier" onClick={() => setEditing({ warehouse: r })}>
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
                            icon="warehouse"
                            title="Aucun entrepôt"
                            text="Créez un premier entrepôt pour enregistrer des mouvements."
                            actions={isAdmin && (
                                <button type="button" className="btn btn-primary" onClick={() => setEditing({ warehouse: null })}>
                                    <Icon name="plus" />Nouvel entrepôt
                                </button>
                            )}
                        />
                    )}
                </div>
                {!!stats.error && (
                    <div className="card-foot"><ErrorBanner error={stats.error} title="Compteurs indisponibles." onRetry={stats.reload} /></div>
                )}
                {!isAdmin && (
                    <div className="card-foot muted"><Icon name="lock" /> Lecture seule : la gestion des entrepôts est réservée aux administrateurs.</div>
                )}
            </section>

            {editing && (
                <EntityFormModal
                    title={editing.warehouse ? "Modifier l’entrepôt" : "Nouvel entrepôt"}
                    fields={[
                        {
                            name: "name",
                            label: "Nom",
                            required: true,
                            value: editing.warehouse?.name ?? "",
                            maxLength: 100,
                            validate: nameRule(editing.warehouse?.id ?? null),
                        },
                        {
                            name: "address",
                            label: "Adresse",
                            value: editing.warehouse?.address ?? "",
                            maxLength: 250,
                            hint: "Facultatif, 250 caractères maximum.",
                            validate: (v) => (v.length > 250 ? "250 caractères maximum." : ""),
                        },
                    ]}
                    onSave={async ({ name, address }) => {
                        const dto = { name, address: address || null };
                        if (editing.warehouse) {
                            await warehousesApi.update(editing.warehouse.id, dto);
                            toast("success", "Entrepôt modifié", name);
                        } else {
                            await warehousesApi.create(dto);
                            toast("success", "Entrepôt créé", name);
                        }
                        invalidate();
                    }}
                    onClose={() => setEditing(null)}
                />
            )}
        </>
    );
}
