import { Icon } from "../Icon";
import { stockState, typeLabel } from "../../lib/inventory";
import type { MovementType, Product, Role } from "../../lib/types";

export function StockBadge({ product }: { product: Pick<Product, "stock" | "lowStockThreshold"> }) {
    const s = stockState(product);
    if (s === "out") return <span className="badge badge-out"><Icon name="alert-circle" />Rupture</span>;
    if (s === "low") return <span className="badge badge-low"><Icon name="alert" />Sous seuil</span>;
    return <span className="badge badge-ok"><Icon name="check" />Normal</span>;
}

export function TypeBadge({ type }: { type: MovementType }) {
    if (type === "In") return <span className="badge badge-in"><Icon name="arrow-in" />{typeLabel.In}</span>;
    if (type === "Out") return <span className="badge badge-sortie"><Icon name="arrow-out" />{typeLabel.Out}</span>;
    return <span className="badge badge-adj"><Icon name="sliders" />{typeLabel.Adjustment}</span>;
}

export function RoleBadge({ role }: { role: Role }) {
    return role === "Admin"
        ? <span className="badge badge-admin"><Icon name="shield" />Admin</span>
        : <span className="badge badge-user">User</span>;
}
