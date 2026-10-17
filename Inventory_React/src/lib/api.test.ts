import { delay, http, HttpResponse } from "msw";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    ApiError,
    authApi,
    categoriesApi,
    dashboardApi,
    errorMessage,
    isAbort,
    movementsApi,
    onSessionExpired,
    productsApi,
    request,
    tokens,
    warehousesApi,
} from "./api";
import { ADMIN, apiDate, db } from "../test/db";
import { api } from "../test/handlers";
import { signIn } from "../test/render";
import { server } from "../test/server";

type Method = "get" | "post" | "put" | "delete";

/** Records the requests made to `path`, then lets them through to the fake API. */
function record(method: Method, path: string) {
    const seen: Request[] = [];
    server.use(
        http[method](api(path), ({ request }) => {
            seen.push(request.clone());
        }),
    );
    return seen;
}

/** The rejection of `promise` (fails the test if it resolves). */
async function rejection(promise: Promise<unknown>): Promise<ApiError> {
    try {
        await promise;
    } catch (e) {
        return e as ApiError;
    }
    throw new Error("The promise was expected to reject.");
}

afterEach(() => {
    onSessionExpired(null);
    vi.unstubAllEnvs();
});

describe("tokens", () => {
    it("stores, reads and clears the token pair", () => {
        tokens.set("acc", "ref");
        expect(localStorage.getItem("access_token")).toBe("acc");
        expect(localStorage.getItem("refresh_token")).toBe("ref");
        expect(tokens.access).toBe("acc");
        expect(tokens.refresh).toBe("ref");

        tokens.clear();
        expect(tokens.access).toBeNull();
        expect(tokens.refresh).toBeNull();
        expect(localStorage.length).toBe(0);
    });

    it("reads no token when the storage cannot be read", () => {
        tokens.set("acc", "ref");
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new DOMException("The operation is insecure.", "SecurityError");
        });
        expect(tokens.access).toBeNull();
        expect(tokens.refresh).toBeNull();
    });

    it("lets a storage write error through, so a login cannot pretend to succeed", () => {
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
        });
        expect(() => tokens.set("acc", "ref")).toThrow("The quota has been exceeded.");
    });
});

describe("ApiError", () => {
    it("defaults its message to the HTTP status", () => {
        const e = new ApiError(404, {});
        expect(e).toBeInstanceOf(Error);
        expect(e.name).toBe("ApiError");
        expect(e.message).toBe("HTTP 404");
        expect(e.status).toBe(404);
        expect(e.fieldErrors).toEqual({});
        expect(e.title).toBeUndefined();
        expect(e.detail).toBeUndefined();
        expect(e.retryAfter).toBeUndefined();
    });

    it("takes its message from the message, then the detail, then the title", () => {
        expect(new ApiError(400, { title: "Titre", detail: "Détail", message: "Message" }).message).toBe("Message");
        expect(new ApiError(400, { title: "Titre", detail: "Détail" }).message).toBe("Détail");
        expect(new ApiError(400, { title: "Titre" }).message).toBe("Titre");
    });

    it("keeps the title, detail, field errors and Retry-After", () => {
        const e = new ApiError(429, { title: "Titre", detail: "Détail", fieldErrors: { name: "Requis" }, retryAfter: 12 });
        expect(e).toMatchObject({ status: 429, title: "Titre", detail: "Détail", fieldErrors: { name: "Requis" }, retryAfter: 12 });
    });
});

describe("isAbort", () => {
    it("recognizes only an AbortError", () => {
        expect(isAbort(new DOMException("Aborted", "AbortError"))).toBe(true);
        expect(isAbort(new DOMException("Timed out", "TimeoutError"))).toBe(false);
        expect(isAbort(new Error("AbortError"))).toBe(false);
        expect(isAbort(new ApiError(0, {}))).toBe(false);
    });
});

describe("errorMessage", () => {
    it("has a generic message for anything that is not an ApiError", () => {
        expect(errorMessage(new Error("boom"))).toBe("Une erreur inattendue est survenue.");
        expect(errorMessage("boom")).toBe("Une erreur inattendue est survenue.");
        expect(errorMessage(undefined)).toBe("Une erreur inattendue est survenue.");
    });

    it("has a fixed message for network errors, 401, 403 and 404", () => {
        expect(errorMessage(new ApiError(0, { message: "Network error" }))).toBe("Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
        expect(errorMessage(new ApiError(401, { detail: "ignored" }))).toBe("Votre session a expiré (401). Reconnectez-vous.");
        expect(errorMessage(new ApiError(403, { detail: "ignored" }))).toBe("Cette action est interdite pour votre rôle (403).");
        expect(errorMessage(new ApiError(404, { detail: "ignored" }))).toBe("L’élément demandé est introuvable (404).");
    });

    it("gives the Retry-After delay of a 429 when there is one", () => {
        expect(errorMessage(new ApiError(429, { retryAfter: 30 }))).toBe("Trop de requêtes (429). Réessayez dans 30 s.");
        expect(errorMessage(new ApiError(429, {}))).toBe("Trop de requêtes (429). Réessayez dans quelques instants.");
    });

    it("hides the details of a server error", () => {
        expect(errorMessage(new ApiError(500, { detail: "NullReferenceException" }))).toBe("Une erreur interne est survenue côté serveur.");
        expect(errorMessage(new ApiError(503, {}))).toBe("Une erreur interne est survenue côté serveur.");
    });

    it("shows the detail, then the title, then the status of other errors", () => {
        expect(errorMessage(new ApiError(409, { title: "Conflit", detail: "La catégorie contient des produits." }))).toBe("La catégorie contient des produits.");
        expect(errorMessage(new ApiError(400, { title: "One or more validation errors occurred." }))).toBe("One or more validation errors occurred.");
        expect(errorMessage(new ApiError(422, {}))).toBe("La requête a échoué (422).");
    });
});

describe("request", () => {
    it("sends the bearer token and parses the JSON response", async () => {
        signIn("Admin");
        const seen = record("get", "/profile");

        await expect(authApi.profile()).resolves.toEqual({ userId: "1", email: ADMIN.email, role: "Admin" });

        expect(seen).toHaveLength(1);
        expect(seen[0].method).toBe("GET");
        expect(seen[0].headers.get("Authorization")).toBe(`Bearer ${tokens.access}`);
        expect(seen[0].headers.get("Content-Type")).toBeNull();
    });

    it("sends no Authorization header without a token", async () => {
        const seen = record("get", "/profile");
        await rejection(authApi.profile());
        expect(seen[0].headers.get("Authorization")).toBeNull();
    });

    it("sends a JSON body, without the bearer token on a public endpoint", async () => {
        signIn("User");
        const seen = record("post", "/auth/login");

        const res = await authApi.login(ADMIN.email, ADMIN.password);

        expect(res.access_token).toMatch(/^access-1-/);
        expect(res.refresh_token).toMatch(/^refresh-1-/);
        expect(seen[0].method).toBe("POST");
        expect(seen[0].headers.get("Authorization")).toBeNull();
        expect(seen[0].headers.get("Content-Type")).toBe("application/json");
        expect(await seen[0].json()).toEqual({ email: ADMIN.email, password: ADMIN.password });
    });

    it("leaves empty, null and undefined values out of the query string", async () => {
        signIn();
        const seen = record("get", "/products/paged");

        await request("/api/v1/products/paged", {
            query: { name: "", minPrice: 0, lowStockOnly: false, categoryId: null, maxPrice: undefined, sortBy: "price", q: "vis inox" },
        });

        expect([...new URL(seen[0].url).searchParams]).toEqual([
            ["minPrice", "0"],
            ["lowStockOnly", "false"],
            ["sortBy", "price"],
            ["q", "vis inox"],
        ]);
    });

    it("adds no query string when there is nothing to send", async () => {
        signIn();
        const seen = record("get", "/products/paged");
        await productsApi.paged({ name: "", categoryId: undefined });
        expect(seen[0].url).toBe(api("/products/paged"));
    });

    it("resolves to undefined on 204 No Content", async () => {
        signIn();
        await expect(categoriesApi.update(1, { name: "Quincaillerie" })).resolves.toBeUndefined();
        expect(db.categories.find((c) => c.id === 1)?.name).toBe("Quincaillerie");
    });

    it("resolves to undefined on an empty 200 response", async () => {
        signIn();
        server.use(http.get(api("/dashboard"), () => new HttpResponse(null, { status: 200 })));
        await expect(dashboardApi.get()).resolves.toBeUndefined();
    });

    it("turns a network error into an ApiError with status 0", async () => {
        signIn();
        server.use(http.get(api("/dashboard"), () => HttpResponse.error()));

        const e = await rejection(dashboardApi.get());

        expect(e).toBeInstanceOf(ApiError);
        expect(e.status).toBe(0);
        expect(e.message).toBe("Network error");
        expect(errorMessage(e)).toBe("Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.");
    });

    it("rethrows an abort as is", async () => {
        signIn();
        server.use(http.get(api("/dashboard"), () => delay("infinite")));
        const controller = new AbortController();

        const pending = rejection(dashboardApi.get(controller.signal));
        controller.abort();
        const e = await pending;

        expect(isAbort(e)).toBe(true);
        expect(e).not.toBeInstanceOf(ApiError);
        expect(isAbort(await rejection(dashboardApi.get(AbortSignal.abort())))).toBe(true);
    });

    it("calls a URL relative to the page when VITE_API_URL is not set", async () => {
        vi.stubEnv("VITE_API_URL", undefined);
        vi.resetModules();
        const fresh = await import("./api");
        const seen: string[] = [];
        server.use(
            http.get("*/api/v1/dashboard", ({ request }) => {
                seen.push(request.url);
                return HttpResponse.json({ productCount: 0 });
            }),
        );

        await fresh.dashboardApi.get();

        expect(seen).toEqual([new URL("/api/v1/dashboard", window.location.href).href]);
    });
});

describe("error responses", () => {
    it("reads a ProblemDetails body", async () => {
        signIn();
        const e = await rejection(productsApi.remove(1));
        expect(e).toBeInstanceOf(ApiError);
        expect(e).toMatchObject({
            status: 409,
            title: "Conflit avec l'état actuel des données.",
            detail: "Le produit 1 a des mouvements de stock : il ne peut pas être supprimé.",
            message: "Le produit 1 a des mouvements de stock : il ne peut pas être supprimé.",
            fieldErrors: {},
        });
        expect(errorMessage(e)).toBe("Le produit 1 a des mouvements de stock : il ne peut pas être supprimé.");
    });

    it("maps ValidationProblemDetails errors to camelCase fields, keeping the first message", async () => {
        signIn();
        const e = await rejection(productsApi.create({ name: "", price: -1, stock: 2, lowStockThreshold: 0, categoryId: 99 }));
        expect(e.status).toBe(400);
        expect(e.title).toBe("One or more validation errors occurred.");
        expect(e.fieldErrors).toEqual({
            name: "The Name field is required.",
            price: "The field Price must be between 0 and 1.7976931348623157E+308.",
            categoryId: "La catégorie 99 n'existe pas.",
        });
    });

    it("strips the JSON path prefix of System.Text.Json errors and skips empty lists", async () => {
        signIn();
        server.use(
            http.post(api("/stock/movements"), () =>
                HttpResponse.json(
                    {
                        title: "One or more validation errors occurred.",
                        status: 400,
                        errors: { "$.quantity": ["The JSON value could not be converted.", "Second message"], ProductId: ["Le produit 99 n'existe pas."], Notes: [], Type: null },
                    },
                    { status: 400 },
                ),
            ),
        );
        const e = await rejection(movementsApi.create({ productId: 99, warehouseId: 1, type: "In", quantity: 1, notes: null }));
        expect(e.fieldErrors).toEqual({ quantity: "The JSON value could not be converted.", productId: "Le produit 99 n'existe pas." });
    });

    it("reads a { message } body as the detail", async () => {
        const e = await rejection(authApi.login(ADMIN.email, "wrong"));
        expect(e).toMatchObject({ status: 401, detail: "Invalid email or password.", message: "Invalid email or password." });
    });

    it("keeps a plain-text body as the detail", async () => {
        signIn();
        server.use(http.post(api("/auth/logout"), () => HttpResponse.text("Missing refresh token.", { status: 400 })));
        const e = await rejection(authApi.logout(""));
        expect(e.status).toBe(400);
        expect(e.detail).toBe("Missing refresh token.");
        expect(errorMessage(e)).toBe("Missing refresh token.");
    });

    it("falls back to the status for an empty body", async () => {
        signIn();
        server.use(http.get(api("/dashboard"), () => new HttpResponse(null, { status: 500 })));
        const e = await rejection(dashboardApi.get());
        expect(e).toMatchObject({ status: 500, title: undefined, detail: undefined, message: "HTTP 500", fieldErrors: {}, retryAfter: undefined });
    });

    it("reads the Retry-After seconds of a 429", async () => {
        server.use(http.post(api("/auth/login"), () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "30" } })));
        const e = await rejection(authApi.login(ADMIN.email, ADMIN.password));
        expect(e.retryAfter).toBe(30);
        expect(errorMessage(e)).toBe("Trop de requêtes (429). Réessayez dans 30 s.");
    });

    it("ignores a Retry-After that is not a number of seconds", async () => {
        server.use(http.post(api("/auth/login"), () => new HttpResponse(null, { status: 429, headers: { "Retry-After": "Sat, 17 Oct 2026 12:00:00 GMT" } })));
        const e = await rejection(authApi.login(ADMIN.email, ADMIN.password));
        expect(e.retryAfter).toBeUndefined();
        expect(errorMessage(e)).toBe("Trop de requêtes (429). Réessayez dans quelques instants.");
    });
});

describe("401 handling", () => {
    it("refreshes an expired access token, stores the new pair and retries", async () => {
        signIn("Admin");
        const oldAccess = tokens.access;
        const oldRefresh = tokens.refresh;
        db.expireAccessTokens();
        const refreshes = record("post", "/auth/refresh");
        const dashboards = record("get", "/dashboard");
        const expired = vi.fn();
        onSessionExpired(expired);

        const dashboard = await dashboardApi.get();

        expect(dashboard.productCount).toBe(12);
        expect(refreshes).toHaveLength(1);
        expect(await refreshes[0].json()).toEqual({ refreshToken: oldRefresh });
        expect(dashboards).toHaveLength(2);
        expect(dashboards[1].headers.get("Authorization")).toBe(`Bearer ${tokens.access}`);
        expect(tokens.access).not.toBe(oldAccess);
        expect(tokens.refresh).not.toBe(oldRefresh);
        expect(expired).not.toHaveBeenCalled();
    });

    it("shares one refresh between parallel requests", async () => {
        signIn("Admin");
        db.expireAccessTokens();
        let refreshes = 0;
        server.use(
            http.post(api("/auth/refresh"), async () => {
                refreshes += 1;
                await delay(20);
            }),
        );
        const expired = vi.fn();
        onSessionExpired(expired);

        const [dashboard, products, categories] = await Promise.all([dashboardApi.get(), productsApi.all(), categoriesApi.list()]);

        expect(refreshes).toBe(1);
        expect(dashboard.productCount).toBe(12);
        expect(products).toHaveLength(12);
        expect(categories).toHaveLength(3);
        expect(expired).not.toHaveBeenCalled();
    });

    it("refreshes again when the new access token expires in turn", async () => {
        signIn("Admin");
        const refreshes = record("post", "/auth/refresh");

        db.expireAccessTokens();
        await dashboardApi.get();
        db.expireAccessTokens();
        await dashboardApi.get();

        expect(refreshes).toHaveLength(2);
    });

    it("expires the session when the refresh token is refused", async () => {
        signIn("Admin");
        db.expireAccessTokens();
        db.expireRefreshTokens();
        const expired = vi.fn();
        onSessionExpired(expired);

        const e = await rejection(dashboardApi.get());

        expect(e.status).toBe(401);
        expect(errorMessage(e)).toBe("Votre session a expiré (401). Reconnectez-vous.");
        expect(expired).toHaveBeenCalledTimes(1);
    });

    it("expires the session without trying to refresh when there is no refresh token", async () => {
        localStorage.setItem("access_token", "stale");
        const refreshes = record("post", "/auth/refresh");
        const expired = vi.fn();
        onSessionExpired(expired);

        expect((await rejection(dashboardApi.get())).status).toBe(401);
        expect(refreshes).toHaveLength(0);
        expect(expired).toHaveBeenCalledTimes(1);
    });

    it("treats a network error during the refresh as a failed refresh", async () => {
        signIn("Admin");
        db.expireAccessTokens();
        server.use(http.post(api("/auth/refresh"), () => HttpResponse.error()));
        const expired = vi.fn();
        onSessionExpired(expired);

        expect((await rejection(dashboardApi.get())).status).toBe(401);
        expect(expired).toHaveBeenCalledTimes(1);
    });

    it("expires the session when the retried request is refused again", async () => {
        signIn("Admin");
        server.use(http.get(api("/dashboard"), () => new HttpResponse(null, { status: 401 })));
        const refreshes = record("post", "/auth/refresh");
        const expired = vi.fn();
        onSessionExpired(expired);

        expect((await rejection(dashboardApi.get())).status).toBe(401);
        expect(refreshes).toHaveLength(1);
        expect(expired).toHaveBeenCalledTimes(1);
    });

    it("neither refreshes nor expires the session on a 401 from a public endpoint", async () => {
        signIn("Admin");
        const refreshes = record("post", "/auth/refresh");
        const expired = vi.fn();
        onSessionExpired(expired);

        expect((await rejection(authApi.login(ADMIN.email, "wrong"))).status).toBe(401);
        expect(refreshes).toHaveLength(0);
        expect(expired).not.toHaveBeenCalled();
    });

    it("still rejects with a 401 when no session-expired handler is registered", async () => {
        signIn("Admin");
        db.expireAccessTokens();
        db.expireRefreshTokens();
        onSessionExpired(null);
        expect((await rejection(dashboardApi.get())).status).toBe(401);
    });
});

describe("movementsApi.all", () => {
    const DAY = 86_400_000;

    it("gets a period that fits in one page with a single request", async () => {
        signIn();
        const seen = record("get", "/stock/movements");

        const movements = await movementsApi.all({ warehouseId: 1 });

        expect(movements.map((m) => m.id)).toEqual([1, 3, 5]);
        expect(seen).toHaveLength(1);
        expect(Object.fromEntries(new URL(seen[0].url).searchParams)).toEqual({ warehouseId: "1", askedPage: "1", pageSize: "100" });
    });

    it("follows the pages, 100 movements at a time, in order", async () => {
        signIn();
        for (let i = 0; i < 230; i++) {
            db.movements.push({ id: 100 + i, productId: 8, warehouseId: 2, type: "In", quantity: 1, delta: 1, date: apiDate(20 * DAY + i * 60_000), userId: 1, notes: null });
        }
        const from = new Date(Date.now() - 365 * DAY).toISOString();
        const seen = record("get", "/stock/movements");

        const movements = await movementsApi.all({ from });

        expect(movements).toHaveLength(235);
        expect(movements.slice(0, 5).map((m) => m.id)).toEqual([1, 2, 3, 4, 5]);
        expect(movements.slice(5).map((m) => m.id)).toEqual(Array.from({ length: 230 }, (_, i) => 100 + i));
        const pages = seen.map((r) => Object.fromEntries(new URL(r.url).searchParams));
        expect(pages.sort((a, b) => Number(a.askedPage) - Number(b.askedPage))).toEqual([
            { from, askedPage: "1", pageSize: "100" },
            { from, askedPage: "2", pageSize: "100" },
            { from, askedPage: "3", pageSize: "100" },
        ]);
    });

    it("returns an empty list for an empty period", async () => {
        signIn();
        expect(await movementsApi.all({ warehouseId: 3 })).toEqual([]);
    });
});

describe("endpoints", () => {
    it("authApi registers a user and revokes a refresh token on logout", async () => {
        await expect(authApi.register("jdupont", "jean.dupont@inventory.fr", "Secret123!")).resolves.toEqual({ message: "User created successfully." });
        expect(db.users.find((u) => u.email === "jean.dupont@inventory.fr")).toMatchObject({ username: "jdupont", role: "User" });

        signIn("User");
        const refresh = tokens.refresh as string;
        await authApi.logout(refresh);
        expect(db.takeRefresh(refresh)).toBeUndefined();
    });

    it("dashboardApi gets the dashboard", async () => {
        signIn();
        expect(await dashboardApi.get()).toMatchObject({ productCount: 12, lowStockProductCount: 6 });
    });

    it("productsApi reads products, pages and movements", async () => {
        signIn("User");
        expect(await productsApi.all()).toHaveLength(12);
        expect(await productsApi.get(1)).toMatchObject({ id: 1, name: "Vis inox A2 M6 × 40", categoryName: "Visserie" });
        expect(await productsApi.paged({ askedPage: 2, sortBy: "price", sortDirection: "desc" })).toMatchObject({ totalItems: 12, totalPages: 2 });
        expect((await productsApi.movements(1, { askedPage: 1, pageSize: 20 })).movements.map((m) => m.id)).toEqual([1, 4]);
    });

    it("productsApi creates, updates and deletes a product", async () => {
        signIn("Admin");
        const created = await productsApi.create({ name: "Cheville nylon 8 mm", price: 4.5, stock: 100, lowStockThreshold: 20, categoryId: 1 });
        expect(created).toMatchObject({ id: 13, name: "Cheville nylon 8 mm", categoryName: "Visserie" });

        await productsApi.update({ id: 13, name: "Cheville nylon 10 mm", price: 5, stock: 90, lowStockThreshold: 20, categoryId: null });
        expect(db.products.find((p) => p.id === 13)).toMatchObject({ name: "Cheville nylon 10 mm", price: 5, stock: 90, categoryId: null });

        await productsApi.remove(13);
        expect(db.products.some((p) => p.id === 13)).toBe(false);
    });

    it("movementsApi lists and records movements", async () => {
        signIn("Admin");
        expect((await movementsApi.list({ warehouseId: 2 })).movements.map((m) => m.id)).toEqual([2, 4]);
        const created = await movementsApi.create({ productId: 2, warehouseId: 1, type: "In", quantity: 4, notes: "Réassort" });
        expect(created).toMatchObject({ productId: 2, delta: 4, productName: "Vis à bois 4 × 50", warehouseName: "Entrepôt Nord" });
        expect(db.products.find((p) => p.id === 2)?.stock).toBe(10);
    });

    it("categoriesApi lists, creates, renames and deletes", async () => {
        signIn("Admin");
        expect(await categoriesApi.list()).toHaveLength(3);
        expect(await categoriesApi.create({ name: "Plomberie" })).toEqual({ id: 4, name: "Plomberie" });
        await categoriesApi.update(4, { name: "Sanitaire" });
        await categoriesApi.remove(3);
        expect(db.categories.map((c) => c.name)).toEqual(["Visserie", "Outillage", "Sanitaire"]);
    });

    it("warehousesApi lists, creates, updates and deletes", async () => {
        signIn("Admin");
        expect(await warehousesApi.list()).toHaveLength(3);
        expect(await warehousesApi.create({ name: "Entrepôt Est", address: null })).toEqual({ id: 4, name: "Entrepôt Est", address: null });
        await warehousesApi.update(4, { name: "Entrepôt Est", address: "1 quai Kléber, 67000 Strasbourg" });
        await warehousesApi.remove(3);
        expect(db.warehouses.map((w) => w.id)).toEqual([1, 2, 4]);
        expect(db.warehouses[2].address).toBe("1 quai Kléber, 67000 Strasbourg");
    });
});
