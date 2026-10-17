import { useNavigate } from "react-router-dom";
import { useConfirm } from "../components/ui/confirmContext";
import { useData } from "../context/data";
import { useToast } from "../context/toast";
import { ApiError, errorMessage, productsApi } from "../lib/api";
import { plural } from "../lib/format";
import type { Product } from "../lib/types";

/**
 * Confirm then delete a product. The API keeps movement history (FK restrict),
 * so a product with movements gets an explanation instead of a failing delete.
 */
export function useProductDelete() {
    const confirm = useConfirm();
    const toast = useToast();
    const navigate = useNavigate();
    const { invalidate } = useData();

    return async function askDelete(product: Pick<Product, "id" | "name">, options: { onDeleted?: () => void; fromDetail?: boolean } = {}) {
        let moves: number | null = null;
        try {
            moves = (await productsApi.movements(product.id, { pageSize: 1 })).totalItems;
        } catch {
            moves = null; // unknown: let the API decide
        }

        if (moves) {
            confirm({
                title: "Suppression impossible",
                confirmLabel: options.fromDetail ? "Compris" : "Voir l’historique",
                body: (
                    <p>
                        <strong>{product.name}</strong> porte <strong>{moves} {plural(moves, "mouvement")}</strong> de stock.
                        L’historique doit rester consultable : un produit avec des mouvements ne peut pas être supprimé.
                    </p>
                ),
                onConfirm: () => {
                    if (!options.fromDetail) navigate(`/produits/${product.id}`);
                },
            });
            return;
        }

        confirm({
            title: "Supprimer ce produit ?",
            danger: true,
            confirmLabel: "Supprimer définitivement",
            body: <p><strong>{product.name}</strong> sera retiré du catalogue. Cette action est irréversible.</p>,
            onConfirm: async () => {
                try {
                    await productsApi.remove(product.id);
                    toast("success", "Produit supprimé", product.name);
                    options.onDeleted?.();
                    invalidate();
                } catch (err) {
                    if (err instanceof ApiError && err.status === 404) {
                        toast("info", "Produit déjà supprimé", product.name);
                        options.onDeleted?.();
                        invalidate();
                    } else {
                        toast("error", "Suppression refusée", errorMessage(err));
                    }
                }
            },
        });
    };
}
