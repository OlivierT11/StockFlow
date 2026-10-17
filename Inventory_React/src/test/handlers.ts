// Fake Inventory API (/api/v1) for the tests, with the status codes and bodies of Inventory_Api.
// Override one endpoint in a test with server.use(http.get(api("/…"), …)).
import { http, HttpResponse } from "msw";
import { db, type User } from "./db";
import type { MovementType, ProductCreate, StockMovementCreate } from "../lib/types";

export const API_URL = "http://api.test";
export const api = (path: string) => `${API_URL}/api/v1${path}`;

const validation = (errors: Record<string, string[]>) =>
    HttpResponse.json(
        { type: "https://tools.ietf.org/html/rfc9110#section-15.5.1", title: "One or more validation errors occurred.", status: 400, errors },
        { status: 400 },
    );
const problem = (status: number, title: string, detail?: string) => HttpResponse.json({ status, title, detail }, { status });
const notFound = () => problem(404, "Not Found");
const noContent = () => new HttpResponse(null, { status: 204 });

/** The signed-in user, or the 401 / 403 response to return. */
function authorize(request: Request, role?: "Admin"): User | Response {
    const token = request.headers.get("Authorization")?.replace(/^Bearer /, "");
    const user = db.userForAccess(token);
    if (!user) return new HttpResponse(null, { status: 401 });
    if (role && user.role !== role) return new HttpResponse(null, { status: 403 });
    return user;
}

function page<T>(rows: T[], url: URL, defaultSize = 10) {
    const askedPage = Number(url.searchParams.get("askedPage") ?? 1);
    const pageSize = Number(url.searchParams.get("pageSize") ?? defaultSize);
    return {
        items: rows.slice((askedPage - 1) * pageSize, askedPage * pageSize),
        totalItems: rows.length,
        totalPages: Math.ceil(rows.length / pageSize),
    };
}

const byDateDesc = (a: { date: string }, b: { date: string }) => b.date.localeCompare(a.date);

function productErrors(dto: Partial<ProductCreate>) {
    const errors: Record<string, string[]> = {};
    if (!dto.name?.trim()) errors.Name = ["The Name field is required."];
    else if (dto.name.length > 100) errors.Name = ["The field Name must be a string or array type with a maximum length of '100'."];
    if (typeof dto.price !== "number" || dto.price < 0) errors.Price = ["The field Price must be between 0 and 1.7976931348623157E+308."];
    if (typeof dto.stock !== "number" || dto.stock < 0) errors.Stock = ["The field Stock must be between 0 and 2147483647."];
    if (dto.categoryId != null && !db.categories.some((c) => c.id === dto.categoryId)) errors.CategoryId = [`La catégorie ${dto.categoryId} n'existe pas.`];
    return errors;
}

export const handlers = [
    /* ------------------------------ auth ------------------------------ */
    http.post(api("/auth/login"), async ({ request }) => {
        const { email, password } = (await request.json()) as { email: string; password: string };
        const user = db.users.find((u) => u.email === email && u.password === password);
        if (!user) return HttpResponse.json({ message: "Invalid email or password." }, { status: 401 });
        const t = db.issueTokens(user.id);
        return HttpResponse.json({ access_token: t.access, refresh_token: t.refresh });
    }),

    http.post(api("/auth/register"), async ({ request }) => {
        const { username, email, password } = (await request.json()) as { username: string; email: string; password: string };
        if (db.users.some((u) => u.email === email)) return HttpResponse.json({ message: "This user already exists." }, { status: 400 });
        db.users.push({ id: db.nextId(db.users), username, email, password, role: "User" });
        return HttpResponse.json({ message: "User created successfully." });
    }),

    http.post(api("/auth/refresh"), async ({ request }) => {
        const { refreshToken } = (await request.json()) as { refreshToken: string };
        const userId = db.takeRefresh(refreshToken);
        if (userId === undefined) return HttpResponse.json({ message: "Invalid refresh token." }, { status: 401 });
        const t = db.issueTokens(userId);
        return HttpResponse.json({ accessToken: t.access, refreshToken: t.refresh });
    }),

    http.post(api("/auth/logout"), async ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        const { refreshToken } = (await request.json()) as { refreshToken: string };
        db.takeRefresh(refreshToken);
        return HttpResponse.json({ message: "Logged out." });
    }),

    http.get(api("/profile"), ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        return HttpResponse.json({ userId: String(user.id), email: user.email, role: user.role });
    }),

    /* ---------------------------- dashboard ---------------------------- */
    http.get(api("/dashboard"), ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        const low = db.products.filter((p) => p.stock <= p.lowStockThreshold).sort((a, b) => a.stock - b.stock);
        return HttpResponse.json({
            productCount: db.products.length,
            totalStockValue: db.products.reduce((sum, p) => sum + p.price * p.stock, 0),
            lowStockProductCount: low.length,
            lowStockProducts: low.slice(0, 10).map(db.product),
            recentMovements: [...db.movements].sort(byDateDesc).slice(0, 10).map(db.movement),
            generatedAtUtc: new Date().toISOString(),
        });
    }),

    /* ----------------------------- products ----------------------------- */
    http.get(api("/products"), ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        return HttpResponse.json(db.products.map(db.product));
    }),

    http.get(api("/products/paged"), ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        const url = new URL(request.url);
        const q = url.searchParams;
        const name = q.get("name") ?? "";
        if (!/^[a-zA-Z0-9 ]*$/.test(name)) return validation({ Name: ["Search product name can only contain letters, numbers, and spaces."] });
        let rows = db.products.filter((p) => p.name.toLowerCase().includes(name.toLowerCase()));
        if (q.has("minPrice")) rows = rows.filter((p) => p.price >= Number(q.get("minPrice")));
        if (q.has("maxPrice")) rows = rows.filter((p) => p.price <= Number(q.get("maxPrice")));
        if (q.get("lowStockOnly") === "true") rows = rows.filter((p) => p.stock <= p.lowStockThreshold);
        if (q.has("categoryId")) rows = rows.filter((p) => p.categoryId === Number(q.get("categoryId")));
        const sortBy = (q.get("sortBy") ?? "name") as "name" | "price" | "stock";
        const dir = q.get("sortDirection") === "desc" ? -1 : 1;
        rows = [...rows].sort((a, b) => dir * (sortBy === "name" ? a.name.localeCompare(b.name) : a[sortBy] - b[sortBy]));
        const { items, totalItems, totalPages } = page(rows, url);
        return HttpResponse.json({ products: items.map(db.product), totalItems, totalPages });
    }),

    http.get(api("/products/:id"), ({ request, params }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        const product = db.products.find((p) => p.id === Number(params.id));
        return product ? HttpResponse.json(db.product(product)) : notFound();
    }),

    http.post(api("/products"), async ({ request }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const dto = (await request.json()) as ProductCreate;
        const errors = productErrors(dto);
        if (Object.keys(errors).length) return validation(errors);
        const row = { id: db.nextId(db.products), ...dto };
        db.products.push(row);
        return HttpResponse.json(db.product(row), { status: 201 });
    }),

    http.put(api("/products/:id"), async ({ request, params }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const row = db.products.find((p) => p.id === Number(params.id));
        if (!row) return notFound();
        const dto = (await request.json()) as ProductCreate;
        const errors = productErrors(dto);
        if (Object.keys(errors).length) return validation(errors);
        Object.assign(row, { name: dto.name, price: dto.price, stock: dto.stock, lowStockThreshold: dto.lowStockThreshold, categoryId: dto.categoryId });
        return noContent();
    }),

    http.delete(api("/products/:id"), ({ request, params }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const id = Number(params.id);
        const index = db.products.findIndex((p) => p.id === id);
        if (index < 0) return notFound();
        if (db.movements.some((m) => m.productId === id))
            return problem(409, "Conflit avec l'état actuel des données.", `Le produit ${id} a des mouvements de stock : il ne peut pas être supprimé.`);
        db.products.splice(index, 1);
        return noContent();
    }),

    http.get(api("/products/:id/movements"), ({ request, params }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        const id = Number(params.id);
        if (!db.products.some((p) => p.id === id)) return notFound();
        const rows = db.movements.filter((m) => m.productId === id).sort(byDateDesc);
        const { items, totalItems, totalPages } = page(rows, new URL(request.url), 20);
        return HttpResponse.json({ movements: items.map(db.movement), totalItems, totalPages });
    }),

    /* ----------------------------- movements ----------------------------- */
    http.get(api("/stock/movements"), ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        const url = new URL(request.url);
        const q = url.searchParams;
        const time = (d: string) => new Date(d.endsWith("Z") ? d : `${d}Z`).getTime();
        let rows = [...db.movements];
        if (q.has("warehouseId")) rows = rows.filter((m) => m.warehouseId === Number(q.get("warehouseId")));
        if (q.has("from")) rows = rows.filter((m) => time(m.date) >= new Date(q.get("from")!).getTime());
        if (q.has("to")) rows = rows.filter((m) => time(m.date) < new Date(q.get("to")!).getTime());
        const { items, totalItems, totalPages } = page(rows.sort(byDateDesc), url, 20);
        return HttpResponse.json({ movements: items.map(db.movement), totalItems, totalPages });
    }),

    // Like the API, any signed-in user may record a movement (the UI restricts it to Admin).
    http.post(api("/stock/movements"), async ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        const dto = (await request.json()) as StockMovementCreate;
        const product = db.products.find((p) => p.id === dto.productId);
        if (!product) return validation({ ProductId: [`Le produit ${dto.productId} n'existe pas.`] });
        if (!db.warehouses.some((w) => w.id === dto.warehouseId)) return validation({ WarehouseId: [`L'entrepôt ${dto.warehouseId} n'existe pas.`] });
        const delta = (dto.type as MovementType) === "Out" ? -dto.quantity : dto.quantity;
        if (product.stock + delta < 0)
            return problem(422, "Règle métier non respectée.", `Stock insuffisant : ce mouvement rendrait le stock du produit ${dto.productId} négatif.`);
        product.stock += delta;
        const row = { id: db.nextId(db.movements), ...dto, delta, date: new Date().toISOString(), userId: user.id };
        db.movements.push(row);
        return HttpResponse.json(db.movement(row), { status: 201 });
    }),

    /* ---------------------- categories and warehouses ---------------------- */
    http.get(api("/categories"), ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        return HttpResponse.json(db.categories);
    }),
    http.post(api("/categories"), async ({ request }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const { name } = (await request.json()) as { name: string };
        if (!name?.trim()) return validation({ Name: ["The Name field is required."] });
        const row = { id: db.nextId(db.categories), name };
        db.categories.push(row);
        return HttpResponse.json(row, { status: 201 });
    }),
    http.put(api("/categories/:id"), async ({ request, params }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const row = db.categories.find((c) => c.id === Number(params.id));
        if (!row) return notFound();
        const { name } = (await request.json()) as { name: string };
        if (!name?.trim()) return validation({ Name: ["The Name field is required."] });
        row.name = name;
        return noContent();
    }),
    http.delete(api("/categories/:id"), ({ request, params }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const id = Number(params.id);
        const index = db.categories.findIndex((c) => c.id === id);
        if (index < 0) return notFound();
        if (db.products.some((p) => p.categoryId === id))
            return problem(409, "Conflit avec l'état actuel des données.", `La catégorie ${id} contient des produits : réaffectez-les avant de la supprimer.`);
        db.categories.splice(index, 1);
        return noContent();
    }),

    http.get(api("/warehouses"), ({ request }) => {
        const user = authorize(request);
        if (user instanceof Response) return user;
        return HttpResponse.json(db.warehouses);
    }),
    http.post(api("/warehouses"), async ({ request }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const { name, address } = (await request.json()) as { name: string; address: string | null };
        if (!name?.trim()) return validation({ Name: ["The Name field is required."] });
        const row = { id: db.nextId(db.warehouses), name, address };
        db.warehouses.push(row);
        return HttpResponse.json(row, { status: 201 });
    }),
    http.put(api("/warehouses/:id"), async ({ request, params }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const row = db.warehouses.find((w) => w.id === Number(params.id));
        if (!row) return notFound();
        const { name, address } = (await request.json()) as { name: string; address: string | null };
        if (!name?.trim()) return validation({ Name: ["The Name field is required."] });
        Object.assign(row, { name, address });
        return noContent();
    }),
    http.delete(api("/warehouses/:id"), ({ request, params }) => {
        const user = authorize(request, "Admin");
        if (user instanceof Response) return user;
        const id = Number(params.id);
        const index = db.warehouses.findIndex((w) => w.id === id);
        if (index < 0) return notFound();
        if (db.movements.some((m) => m.warehouseId === id))
            return problem(409, "Conflit avec l'état actuel des données.", `L'entrepôt ${id} a des mouvements de stock : il ne peut pas être supprimé.`);
        db.warehouses.splice(index, 1);
        return noContent();
    }),
];
