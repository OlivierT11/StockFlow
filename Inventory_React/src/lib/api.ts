import type {
    Category,
    Dashboard,
    MovementQuery,
    Product,
    ProductCreate,
    ProductList,
    ProductQuery,
    ProductUpdate,
    Profile,
    StockMovement,
    StockMovementCreate,
    StockMovementList,
    Warehouse,
} from "./types";

const API_URL: string = import.meta.env.VITE_API_URL ?? "";

/* ---------------------------------------------------------------------
   Tokens: the access token is short-lived (15 min), the refresh token rotates.
   --------------------------------------------------------------------- */
const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

export const tokens = {
    get access() {
        return readStorage(ACCESS_KEY);
    },
    get refresh() {
        return readStorage(REFRESH_KEY);
    },
    set(access: string, refresh: string) {
        localStorage.setItem(ACCESS_KEY, access);
        localStorage.setItem(REFRESH_KEY, refresh);
    },
    clear() {
        localStorage.removeItem(ACCESS_KEY);
        localStorage.removeItem(REFRESH_KEY);
    },
};

/* ---------------------------------------------------------------------
   Errors: ProblemDetails, ValidationProblemDetails and { message } bodies.
   --------------------------------------------------------------------- */
export class ApiError extends Error {
    readonly status: number;
    readonly title?: string;
    readonly detail?: string;
    /** Validation errors keyed by camelCase field name. */
    readonly fieldErrors: Record<string, string>;
    /** Seconds, from the Retry-After header of a 429. */
    readonly retryAfter?: number;

    constructor(status: number, init: { title?: string; detail?: string; fieldErrors?: Record<string, string>; retryAfter?: number; message?: string }) {
        super(init.message ?? init.detail ?? init.title ?? `HTTP ${status}`);
        this.name = "ApiError";
        this.status = status;
        this.title = init.title;
        this.detail = init.detail;
        this.fieldErrors = init.fieldErrors ?? {};
        this.retryAfter = init.retryAfter;
    }
}

// By name rather than instanceof DOMException: the error can come from another realm (fetch polyfills, jsdom).
export const isAbort = (e: unknown) => typeof e === "object" && e !== null && (e as { name?: unknown }).name === "AbortError";

/** "Name", "$.price" or "ProductId" → "name", "price", "productId". */
function fieldKey(key: string): string {
    const k = key.replace(/^\$\.?/, "");
    return k.charAt(0).toLowerCase() + k.slice(1);
}

/** JSON when it parses, the raw text otherwise (e.g. BadRequest("Missing refresh token.") is text/plain). */
async function readBody(res: Response): Promise<unknown> {
    let text: string;
    try {
        text = await res.text();
    } catch {
        return null;
    }
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
}

async function toApiError(res: Response): Promise<ApiError> {
    const retryHeader = res.headers.get("Retry-After");
    const retryAfter = retryHeader ? Number(retryHeader) || undefined : undefined;
    const body = await readBody(res);
    const b = (typeof body === "string" ? { message: body } : (body ?? {})) as { title?: string; detail?: string; message?: string; errors?: Record<string, string[]> };
    const fieldErrors: Record<string, string> = {};
    if (b.errors) {
        for (const [key, messages] of Object.entries(b.errors)) {
            if (messages?.length) fieldErrors[fieldKey(key)] = messages[0];
        }
    }
    return new ApiError(res.status, { title: b.title, detail: b.detail ?? b.message, fieldErrors, retryAfter });
}

/** A French, user-facing message for any error thrown by request(). */
export function errorMessage(e: unknown): string {
    if (!(e instanceof ApiError)) return "Une erreur inattendue est survenue.";
    switch (e.status) {
        case 0:
            return "Impossible de joindre le serveur. Vérifiez votre connexion puis réessayez.";
        case 401:
            return "Votre session a expiré (401). Reconnectez-vous.";
        case 403:
            return "Cette action est interdite pour votre rôle (403).";
        case 404:
            return "L’élément demandé est introuvable (404).";
        case 429:
            return `Trop de requêtes (429).${e.retryAfter ? ` Réessayez dans ${e.retryAfter} s.` : " Réessayez dans quelques instants."}`;
        default:
            if (e.status >= 500) return "Une erreur interne est survenue côté serveur.";
            return e.detail ?? e.title ?? `La requête a échoué (${e.status}).`;
    }
}

/* ---------------------------------------------------------------------
   Request: bearer token, one shared refresh on 401, then session expiry.
   --------------------------------------------------------------------- */
type Query = Record<string, string | number | boolean | null | undefined>;

type RequestOptions = {
    method?: "GET" | "POST" | "PUT" | "DELETE";
    body?: unknown;
    query?: Query;
    /** false for login/register/refresh: no bearer, no refresh attempt. */
    auth?: boolean;
    signal?: AbortSignal;
};

let sessionExpiredHandler: (() => void) | null = null;
export function onSessionExpired(handler: (() => void) | null) {
    sessionExpiredHandler = handler;
}

let pendingRefresh: Promise<boolean> | null = null;

function refreshTokens(): Promise<boolean> {
    const refreshToken = tokens.refresh;
    if (!refreshToken) return Promise.resolve(false);
    pendingRefresh ??= (async () => {
        try {
            const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ refreshToken }),
            });
            if (!res.ok) return false;
            const data = (await res.json()) as { accessToken: string; refreshToken: string };
            tokens.set(data.accessToken, data.refreshToken);
            return true;
        } catch {
            return false;
        } finally {
            pendingRefresh = null;
        }
    })();
    return pendingRefresh;
}

function buildUrl(path: string, query?: Query): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query ?? {})) {
        if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
    }
    const qs = params.toString();
    return `${API_URL}${path}${qs ? `?${qs}` : ""}`;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, query, auth = true, signal } = options;
    const url = buildUrl(path, query);

    const send = () => {
        const headers: Record<string, string> = {};
        if (body !== undefined) headers["Content-Type"] = "application/json";
        const access = auth ? tokens.access : null;
        if (access) headers.Authorization = `Bearer ${access}`;
        return fetch(url, { method, headers, signal, body: body !== undefined ? JSON.stringify(body) : undefined });
    };

    let res: Response;
    try {
        res = await send();
        if (res.status === 401 && auth) {
            if (await refreshTokens()) res = await send();
            if (res.status === 401) sessionExpiredHandler?.();
        }
    } catch (e) {
        if (isAbort(e)) throw e;
        throw new ApiError(0, { message: "Network error" });
    }

    if (!res.ok) throw await toApiError(res);
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
}

/* ---------------------------------------------------------------------
   Endpoints (api/v1)
   --------------------------------------------------------------------- */
export const authApi = {
    login: (email: string, password: string) =>
        request<{ access_token: string; refresh_token: string }>("/api/v1/auth/login", { method: "POST", body: { email, password }, auth: false }),
    register: (username: string, email: string, password: string) =>
        request<{ message: string }>("/api/v1/auth/register", { method: "POST", body: { username, email, password }, auth: false }),
    logout: (refreshToken: string) => request<void>("/api/v1/auth/logout", { method: "POST", body: { refreshToken } }),
    profile: (signal?: AbortSignal) => request<Profile>("/api/v1/profile", { signal }),
};

export const dashboardApi = {
    get: (signal?: AbortSignal) => request<Dashboard>("/api/v1/dashboard", { signal }),
};

export const productsApi = {
    all: (signal?: AbortSignal) => request<Product[]>("/api/v1/products", { signal }),
    paged: (query: ProductQuery, signal?: AbortSignal) => request<ProductList>("/api/v1/products/paged", { query, signal }),
    get: (id: number, signal?: AbortSignal) => request<Product>(`/api/v1/products/${id}`, { signal }),
    create: (dto: ProductCreate) => request<Product>("/api/v1/products", { method: "POST", body: dto }),
    update: (dto: ProductUpdate) => request<void>(`/api/v1/products/${dto.id}`, { method: "PUT", body: dto }),
    remove: (id: number) => request<void>(`/api/v1/products/${id}`, { method: "DELETE" }),
    movements: (id: number, query: MovementQuery, signal?: AbortSignal) =>
        request<StockMovementList>(`/api/v1/products/${id}/movements`, { query, signal }),
};

export const movementsApi = {
    list: (query: MovementQuery, signal?: AbortSignal) => request<StockMovementList>("/api/v1/stock/movements", { query, signal }),
    create: (dto: StockMovementCreate) => request<StockMovement>("/api/v1/stock/movements", { method: "POST", body: dto }),
    /** Every movement of a period, following the pages (100 per page, the API maximum). */
    async all(query: Omit<MovementQuery, "askedPage" | "pageSize">, signal?: AbortSignal): Promise<StockMovement[]> {
        const first = await movementsApi.list({ ...query, askedPage: 1, pageSize: 100 }, signal);
        const rest = await Promise.all(
            Array.from({ length: Math.max(0, first.totalPages - 1) }, (_, i) =>
                movementsApi.list({ ...query, askedPage: i + 2, pageSize: 100 }, signal),
            ),
        );
        return first.movements.concat(...rest.map((r) => r.movements));
    },
};

function crud<T, TRequest>(base: string) {
    return {
        list: (signal?: AbortSignal) => request<T[]>(base, { signal }),
        create: (dto: TRequest) => request<T>(base, { method: "POST", body: dto }),
        update: (id: number, dto: TRequest) => request<void>(`${base}/${id}`, { method: "PUT", body: dto }),
        remove: (id: number) => request<void>(`${base}/${id}`, { method: "DELETE" }),
    };
}

export const categoriesApi = crud<Category, { name: string }>("/api/v1/categories");
export const warehousesApi = crud<Warehouse, { name: string; address: string | null }>("/api/v1/warehouses");
