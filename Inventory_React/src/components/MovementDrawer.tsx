import { Fragment, useCallback, useState, type FormEvent, type KeyboardEvent, type PropsWithChildren } from "react";
import { Icon } from "./Icon";
import { MovementDrawerContext } from "./movementDrawerContext";
import { Field } from "./ui/Form";
import { Overlay } from "./ui/Overlay";
import { useAuth } from "../context/auth";
import { useData } from "../context/data";
import { useToast } from "../context/toast";
import { useQuery } from "../hooks/useQuery";
import { ApiError, errorMessage, productsApi, movementsApi, warehousesApi } from "../lib/api";
import { fieldProps, isInteger } from "../lib/forms";
import { fmtInt, plural } from "../lib/format";
import { signedQty, typeLabel } from "../lib/inventory";
import type { MovementType, Product } from "../lib/types";

const TYPE_HINTS: Record<MovementType, string> = {
    In: "Ajoute des unités au stock (réception, retour).",
    Out: "Retire des unités du stock (chantier, consommation).",
    Adjustment: "Corrige le stock après inventaire : positif ou négatif.",
};

const TYPE_ICONS = { In: "arrow-in", Out: "arrow-out", Adjustment: "sliders" } as const;

function delta(type: MovementType, quantity: number) {
    return type === "Out" ? -quantity : quantity;
}

type ProductPickerProps = {
    products: Product[] | undefined;
    selected: Product | null;
    error?: string;
    onPick: (product: Product | null) => void;
};

/** Search-as-you-type combobox over the catalogue (prototype: #mv-product-slot). */
function ProductPicker({ products, selected, error, onPick }: ProductPickerProps) {
    const [text, setText] = useState("");
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(-1);

    if (selected) {
        return (
            <div className="combo-selected">
                <span className="c-name od-truncate">{selected.name}</span>
                <span className="c-stock">{fmtInt(selected.stock)} en stock</span>
                <button type="button" className="btn btn-ghost btn-icon btn-sm" aria-label="Changer de produit" onClick={() => onPick(null)}>
                    <Icon name="x" />
                </button>
            </div>
        );
    }

    const s = text.trim().toLowerCase();
    const items = (products ?? []).filter((p) => !s || p.name.toLowerCase().includes(s)).slice(0, 8);

    // Start from an empty search if the user comes back with "Changer de produit".
    function pick(product: Product) {
        setText("");
        setOpen(false);
        setActive(-1);
        onPick(product);
    }

    function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((i) => Math.min(items.length - 1, i + 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(0, i - 1));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (items[active]) pick(items[active]);
            else if (items.length === 1) pick(items[0]);
        } else if (e.key === "Escape" && open) {
            e.stopPropagation();
            setOpen(false);
        }
    }

    return (
        <div className="combo">
            <div className="input-search">
                <Icon name="search" />
                <input
                    {...fieldProps("product", error)}
                    className="input"
                    type="search"
                    placeholder={products ? "Rechercher un produit" : "Chargement des produits…"}
                    autoComplete="off"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls="mv-list"
                    aria-autocomplete="list"
                    aria-activedescendant={open && items[active] ? `mv-opt-${items[active].id}` : undefined}
                    value={text}
                    onChange={(e) => {
                        setText(e.target.value);
                        setActive(-1);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onBlur={() => setTimeout(() => setOpen(false), 120)}
                    onKeyDown={onKeyDown}
                />
            </div>
            {open && (
                <ul className="combo-list" id="mv-list" role="listbox">
                    {items.length ? (
                        items.map((p, i) => (
                            <li
                                key={p.id}
                                role="option"
                                id={`mv-opt-${p.id}`}
                                aria-selected={i === active}
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pick(p);
                                }}
                            >
                                <span className="c-name od-truncate">{p.name}</span>
                                <span className="c-stock">{fmtInt(p.stock)}</span>
                            </li>
                        ))
                    ) : (
                        <li className="combo-empty">{products ? `Aucun produit pour « ${text} »` : "Chargement…"}</li>
                    )}
                </ul>
            )}
        </div>
    );
}

function MovementDrawer({ preset, onClose }: { preset?: Product; onClose: () => void }) {
    const toast = useToast();
    const { invalidate } = useData();
    const products = useQuery("drawer-products", (signal) => productsApi.all(signal));
    const warehouses = useQuery("drawer-warehouses", (signal) => warehousesApi.list(signal));

    const [selected, setSelected] = useState<Product | null>(preset ?? null);
    const [warehouseId, setWarehouseId] = useState("");
    const [type, setType] = useState<MovementType>("In");
    const [quantity, setQuantity] = useState("1");
    const [notes, setNotes] = useState("");
    const [errors, setErrors] = useState<{ product?: string; warehouse?: string; quantity?: string; notes?: string }>({});
    const [saving, setSaving] = useState(false);

    const warehouseList = warehouses.data ?? [];
    const effectiveWarehouse = warehouseId || (warehouseList[0] ? String(warehouseList[0].id) : "");

    const qtyError = () => {
        if (!isInteger(quantity)) return "Saisissez une quantité entière.";
        const n = Number(quantity);
        if (type === "Adjustment") return n === 0 ? "La quantité d’ajustement ne peut pas être nulle." : "";
        return n < 1 ? "La quantité doit être supérieure à 0." : "";
    };

    const d = delta(type, Number(quantity) || 0);
    const after = selected ? selected.stock + d : 0;

    async function onSubmit(e: FormEvent, close: () => void) {
        e.preventDefault();
        const next = {
            product: selected ? undefined : "Choisissez un produit.",
            warehouse: effectiveWarehouse ? undefined : "Choisissez un entrepôt.",
            quantity: qtyError() || undefined,
        };
        setErrors(next);
        if (!selected || next.warehouse || next.quantity) return;
        if (after < 0) {
            setErrors({ quantity: `Stock insuffisant : ${fmtInt(selected.stock)} ${plural(selected.stock, "unité")} ${plural(selected.stock, "disponible")}.` });
            return;
        }
        setSaving(true);
        try {
            const movement = await movementsApi.create({
                productId: selected.id,
                warehouseId: Number(effectiveWarehouse),
                type,
                quantity: Number(quantity),
                notes: notes.trim() || null,
            });
            close();
            invalidate();
            toast(
                "success",
                `${typeLabel[movement.type]} enregistrée`,
                `${signedQty(movement.delta)} · ${movement.productName} · stock : ${fmtInt(selected.stock + movement.delta)}`,
            );
        } catch (err) {
            setSaving(false);
            if (err instanceof ApiError && err.status === 422) {
                setErrors({ quantity: err.detail ?? "Stock insuffisant." });
            } else if (err instanceof ApiError && err.status === 400 && Object.keys(err.fieldErrors).length) {
                const fe = err.fieldErrors;
                setErrors({ product: fe.productId, warehouse: fe.warehouseId, quantity: fe.quantity ?? fe.type, notes: fe.notes });
            } else {
                toast("error", "Mouvement refusé", errorMessage(err));
            }
        }
    }

    const quantityHint = type === "Adjustment" ? "Entier non nul : négatif pour retirer, positif pour ajouter." : "Entier strictement positif.";

    return (
        <Overlay drawer persistent onClose={onClose}>
            {(close) => (
                <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="mv-title">
                    <div className="drawer-head">
                        <h2 id="mv-title">Nouveau mouvement de stock</h2>
                        <button type="button" className="btn btn-ghost btn-icon" aria-label="Fermer le panneau" onClick={close}>
                            <Icon name="x" />
                        </button>
                    </div>
                    <form className="drawer-body" id="mv-form" noValidate onSubmit={(e) => onSubmit(e, close)}>
                        <Field name="product" label="Produit" required error={errors.product}>
                            <ProductPicker
                                products={products.data}
                                selected={selected}
                                error={errors.product}
                                onPick={(p) => {
                                    setSelected(p);
                                    setErrors((x) => ({ ...x, product: undefined }));
                                    if (p) setTimeout(() => document.getElementById("f-quantity")?.focus(), 0);
                                    else setTimeout(() => document.getElementById("f-product")?.focus(), 0);
                                }}
                            />
                        </Field>
                        <Field
                            name="warehouse"
                            label="Entrepôt"
                            required
                            error={errors.warehouse}
                            hint={warehouses.data && !warehouseList.length ? "Aucun entrepôt : un administrateur doit d’abord en créer un." : undefined}
                        >
                            <select
                                {...fieldProps("warehouse", errors.warehouse)}
                                className="select"
                                value={effectiveWarehouse}
                                disabled={!warehouseList.length}
                                onChange={(e) => setWarehouseId(e.target.value)}
                            >
                                {!warehouses.data && <option value="">Chargement…</option>}
                                {warehouseList.map((w) => (
                                    <option key={w.id} value={w.id}>{w.name}</option>
                                ))}
                            </select>
                        </Field>
                        <Field name="type" label="Type de mouvement" required labelId="mv-type-label" hint={TYPE_HINTS[type]}>
                            <div className="seg" role="radiogroup" aria-labelledby="mv-type-label">
                                {(["In", "Out", "Adjustment"] as const).map((t) => (
                                    <Fragment key={t}>
                                        <input
                                            type="radio"
                                            name="type"
                                            id={`t-${t}`}
                                            value={t}
                                            checked={type === t}
                                            onChange={() => setType(t)}
                                        />
                                        <label htmlFor={`t-${t}`}><Icon name={TYPE_ICONS[t]} />{typeLabel[t]}</label>
                                    </Fragment>
                                ))}
                            </div>
                        </Field>
                        <Field name="quantity" label="Quantité" required hint={quantityHint} error={errors.quantity}>
                            <input
                                {...fieldProps("quantity", errors.quantity, true)}
                                className="input"
                                type="number"
                                min={type === "Adjustment" ? undefined : 1}
                                step={1}
                                inputMode="numeric"
                                value={quantity}
                                onChange={(e) => setQuantity(e.target.value)}
                                onBlur={() => setErrors((x) => ({ ...x, quantity: qtyError() || undefined }))}
                            />
                        </Field>
                        <div className={`preview${selected && after < 0 ? " is-negative" : ""}`} aria-live="polite">
                            {selected ? (
                                <>
                                    <span className="od-stat"><span className="v">{fmtInt(selected.stock)}</span><span className="l">Stock avant</span></span>
                                    <span className="arrow"><Icon name="arrow-right" /></span>
                                    <span className="od-stat"><span className="v after">{fmtInt(after)}</span><span className="l">Stock après</span></span>
                                    {after < 0 ? (
                                        <span className="small text-danger" style={{ gridColumn: "1/-1", display: "flex", gap: 6, alignItems: "center" }}>
                                            <Icon name="alert-circle" />Stock résultant négatif : le mouvement sera refusé.
                                        </span>
                                    ) : after <= selected.lowStockThreshold ? (
                                        <span className="small text-warning" style={{ gridColumn: "1/-1", display: "flex", gap: 6, alignItems: "center" }}>
                                            <Icon name="alert" />Le produit sera sous son seuil de {fmtInt(selected.lowStockThreshold)}.
                                        </span>
                                    ) : null}
                                </>
                            ) : (
                                <span className="muted small" style={{ gridColumn: "1/-1", textAlign: "center" }}>
                                    Sélectionnez un produit pour voir l’aperçu du stock.
                                </span>
                            )}
                        </div>
                        <Field name="notes" label="Notes" hint="250 caractères maximum, facultatif." error={errors.notes}>
                            <textarea
                                {...fieldProps("notes", errors.notes, true)}
                                className="textarea"
                                maxLength={250}
                                rows={2}
                                placeholder="Chantier, fournisseur, motif…"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                            />
                        </Field>
                    </form>
                    <div className="drawer-foot">
                        <button type="button" className="btn btn-secondary" onClick={close}>Annuler</button>
                        <button type="submit" form="mv-form" className={`btn btn-primary${saving ? " is-loading" : ""}`}>
                            Enregistrer le mouvement
                        </button>
                    </div>
                </div>
            )}
        </Overlay>
    );
}

export function MovementDrawerProvider({ children }: PropsWithChildren) {
    const { isAdmin } = useAuth();
    const toast = useToast();
    const [state, setState] = useState<{ key: number; preset?: Product } | null>(null);

    const open = useCallback(
        (product?: Product) => {
            if (!isAdmin) {
                toast("error", "Action interdite", "Le rôle User ne peut pas enregistrer de mouvement (403).");
                return;
            }
            setState({ key: Date.now(), preset: product });
        },
        [isAdmin, toast],
    );

    return (
        <MovementDrawerContext.Provider value={open}>
            {children}
            {state && <MovementDrawer key={state.key} preset={state.preset} onClose={() => setState(null)} />}
        </MovementDrawerContext.Provider>
    );
}
