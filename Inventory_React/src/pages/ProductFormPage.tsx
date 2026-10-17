import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { usePageTitle } from "../components/layout/shellContext";
import { Field, FormSummary } from "../components/ui/Form";
import { Crumb, PageHead } from "../components/ui/Page";
import { ErrorBanner, SkeletonHead } from "../components/ui/States";
import { useData } from "../context/data";
import { useToast } from "../context/toast";
import { useQuery } from "../hooks/useQuery";
import { useValidation } from "../hooks/useValidation";
import { ApiError, categoriesApi, errorMessage, productsApi } from "../lib/api";
import { fieldProps, isInteger } from "../lib/forms";
import { fmtInt } from "../lib/format";
import { gap } from "../lib/style";
import type { Category, Product } from "../lib/types";
import { NotFoundPage } from "./ErrorPages";

type ProductFormProps = {
    product?: Product;
    categories: Category[] | undefined;
    onReload: () => void;
};

function ProductForm({ product, categories, onReload }: ProductFormProps) {
    const editing = !!product;
    const navigate = useNavigate();
    const toast = useToast();
    const { invalidate } = useData();
    const [form, setForm] = useState({
        name: product?.name ?? "",
        categoryId: product?.categoryId ? String(product.categoryId) : "",
        price: product ? product.price.toFixed(2) : "",
        stock: "0",
        lowStockThreshold: product ? String(product.lowStockThreshold) : "10",
    });
    const [saving, setSaving] = useState(false);
    const [conflict, setConflict] = useState(false);

    const v = useValidation({
        name: () => {
            const n = form.name.trim();
            return !n ? "Le nom est obligatoire." : n.length > 100 ? "Le nom ne doit pas dépasser 100 caractères." : "";
        },
        categoryId: () => (!form.categoryId ? "Choisissez une catégorie." : ""),
        price: () =>
            form.price === ""
                ? "Le prix est obligatoire."
                : Number(form.price.replace(",", ".")) < 0
                    ? "Le prix doit être supérieur ou égal à 0."
                    : !/^\d+([.,]\d{1,2})?$/.test(form.price)
                        ? "Le prix accepte au plus deux décimales (ex. 12,50)."
                        : "",
        stock: () =>
            editing
                ? ""
                : form.stock === ""
                    ? "Le stock initial est obligatoire."
                    : !isInteger(form.stock) || Number(form.stock) < 0
                        ? "Le stock doit être un entier supérieur ou égal à 0."
                        : "",
        lowStockThreshold: () =>
            form.lowStockThreshold === ""
                ? "Le seuil est obligatoire."
                : !isInteger(form.lowStockThreshold) || Number(form.lowStockThreshold) < 0
                    ? "Le seuil doit être un entier supérieur ou égal à 0."
                    : "",
    });

    const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
        setForm((f) => ({ ...f, [key]: e.target.value }));
        v.changed(key);
    };

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        if (!v.checkAll()) return;
        setSaving(true);
        const values = {
            name: form.name.trim(),
            price: Number(form.price.replace(",", ".")),
            lowStockThreshold: Number(form.lowStockThreshold),
            categoryId: Number(form.categoryId),
        };
        try {
            if (product) {
                // The API requires the stock on update: re-read it so a movement saved meanwhile is not overwritten.
                const current = await productsApi.get(product.id);
                await productsApi.update({ id: product.id, ...values, stock: current.stock });
                invalidate();
                toast("success", "Produit mis à jour", values.name);
                navigate(`/produits/${product.id}`);
            } else {
                const created = await productsApi.create({ ...values, stock: Number(form.stock) });
                invalidate();
                toast("success", "Produit créé", `${created.name} a été ajouté au catalogue.`, {
                    label: "Voir",
                    onClick: () => navigate(`/produits/${created.id}`),
                });
                navigate("/produits");
            }
        } catch (err) {
            setSaving(false);
            if (err instanceof ApiError && err.status === 409) {
                setConflict(true);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else if (err instanceof ApiError && err.status === 404 && product) {
                toast("error", "Produit introuvable", "Ce produit a été supprimé entre-temps (404).");
                navigate("/produits");
            } else if (err instanceof ApiError && err.status === 400 && Object.keys(err.fieldErrors).length) {
                v.setServerErrors(err.fieldErrors);
            } else {
                toast("error", editing ? "Enregistrement impossible" : "Création impossible", errorMessage(err));
            }
        }
    }

    return (
        <>
            {conflict && (
                <div className="banner banner-danger" role="alert">
                    <Icon name="alert" />
                    <span className="banner-text">
                        <strong>Conflit de modification (409).</strong> Ce produit a été modifié par une autre requête.
                        Rechargez pour voir la dernière version avant d’enregistrer.
                    </span>
                    <button type="button" className="btn btn-sm btn-secondary" onClick={onReload}>Recharger</button>
                </div>
            )}
            <section className="card" style={{ maxWidth: 760 }}>
                <form noValidate onSubmit={onSubmit}>
                    <div className="card-body od-stack" style={gap(20)}>
                        <FormSummary errors={v.summary} />
                        <div className="form-grid">
                            <Field name="name" label="Nom du produit" required hint="100 caractères maximum." error={v.errors.name} className="span-2">
                                <input
                                    {...fieldProps("name", v.errors.name, true)}
                                    className="input"
                                    maxLength={100}
                                    autoFocus
                                    value={form.name}
                                    onChange={set("name")}
                                    onBlur={() => v.check("name")}
                                />
                            </Field>
                            <Field name="categoryId" label="Catégorie" required error={v.errors.categoryId}>
                                <select
                                    {...fieldProps("categoryId", v.errors.categoryId)}
                                    className="select"
                                    value={form.categoryId}
                                    onChange={set("categoryId")}
                                    onBlur={() => v.check("categoryId")}
                                >
                                    <option value="">{categories ? "Choisir une catégorie" : "Chargement…"}</option>
                                    {categories?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </Field>
                            <Field name="price" label="Prix unitaire" required hint="Deux décimales, supérieur ou égal à 0." error={v.errors.price}>
                                <div className="input-affix">
                                    <input
                                        {...fieldProps("price", v.errors.price, true)}
                                        className="input"
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        inputMode="decimal"
                                        value={form.price}
                                        onChange={set("price")}
                                        onBlur={() => v.check("price")}
                                    />
                                    <span className="affix">€</span>
                                </div>
                            </Field>
                            {product ? (
                                <div className="field">
                                    <span className="field-label">Stock actuel</span>
                                    <input className="input" type="text" value={fmtInt(product.stock)} disabled aria-describedby="stock-hint" />
                                    <span className="field-hint" id="stock-hint">Le stock se modifie uniquement par un mouvement de stock.</span>
                                </div>
                            ) : (
                                <Field name="stock" label="Stock initial" required hint="Quantité disponible à la création." error={v.errors.stock}>
                                    <input
                                        {...fieldProps("stock", v.errors.stock, true)}
                                        className="input"
                                        type="number"
                                        min={0}
                                        step={1}
                                        inputMode="numeric"
                                        value={form.stock}
                                        onChange={set("stock")}
                                        onBlur={() => v.check("stock")}
                                    />
                                </Field>
                            )}
                            <Field
                                name="lowStockThreshold"
                                label="Seuil de stock bas"
                                required
                                hint="Le produit passe « sous seuil » quand le stock est inférieur ou égal."
                                error={v.errors.lowStockThreshold}
                            >
                                <input
                                    {...fieldProps("lowStockThreshold", v.errors.lowStockThreshold, true)}
                                    className="input"
                                    type="number"
                                    min={0}
                                    step={1}
                                    inputMode="numeric"
                                    value={form.lowStockThreshold}
                                    onChange={set("lowStockThreshold")}
                                    onBlur={() => v.check("lowStockThreshold")}
                                />
                            </Field>
                        </div>
                    </div>
                    <div className="card-foot od-row" style={gap(8, { justifyContent: "flex-end" })}>
                        <Link className="btn btn-secondary" to={product ? `/produits/${product.id}` : "/produits"}>Annuler</Link>
                        <button type="submit" className={`btn btn-primary${saving ? " is-loading" : ""}`}>
                            {editing ? "Enregistrer les modifications" : "Créer le produit"}
                        </button>
                    </div>
                </form>
            </section>
        </>
    );
}

export default function ProductFormPage() {
    const { id: idParam } = useParams();
    const editing = idParam !== undefined;
    const id = Number(idParam);
    const [reloads, setReloads] = useState(0);

    const categories = useQuery("categories", (signal) => categoriesApi.list(signal));
    const product = useQuery(`product-${id}`, (signal) => productsApi.get(id, signal), { enabled: editing && id > 0 });

    // Set here rather than only in NotFoundPage: a parent's effect runs after its child's and would win.
    const notFound = editing && (!(id > 0) || (product.error instanceof ApiError && product.error.status === 404));
    usePageTitle(notFound ? "Page introuvable" : editing ? "Modifier le produit" : "Nouveau produit");

    if (notFound) return <NotFoundPage />;

    const p = product.data;
    const head = (
        <PageHead
            title={editing ? "Modifier le produit" : "Nouveau produit"}
            lede={editing ? p?.name : "Les champs marqués d’un astérisque sont obligatoires."}
            crumbs={
                <>
                    <Crumb to="/produits">Produits</Crumb>
                    {editing && p && <Crumb to={`/produits/${p.id}`}>{p.name}</Crumb>}
                    <span>{editing ? "Modifier" : "Nouveau"}</span>
                </>
            }
        />
    );

    if (editing && product.error) return <>{head}<ErrorBanner error={product.error} title="Impossible de charger le produit." onRetry={product.reload} /></>;
    if (editing && !p) return <><SkeletonHead /><span className="skeleton sk-block" style={{ display: "block", maxWidth: 760, height: 360, borderRadius: 8 }} /></>;

    return (
        <>
            {head}
            {/* Remount on reload (409) so the fields show the latest version. */}
            <ProductForm
                key={`${reloads}-${p ? JSON.stringify(p) : "new"}`}
                product={p}
                categories={categories.data}
                onReload={() => {
                    setReloads((r) => r + 1);
                    product.reload();
                }}
            />
        </>
    );
}
