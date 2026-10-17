import { act, renderHook, waitFor } from "@testing-library/react";
import { delay, http, HttpResponse } from "msw";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "./auth";
import { dashboardApi, tokens } from "../lib/api";
import { ADMIN, USER, db } from "../test/db";
import { api } from "../test/handlers";
import { signIn } from "../test/render";
import { server } from "../test/server";

/** Counts the requests made to `path`, then lets them through to the fake API. */
function count(method: "get" | "post", path: string) {
    const counter = { calls: 0 };
    server.use(
        http[method](api(path), () => {
            counter.calls += 1;
        }),
    );
    return counter;
}

function renderAuth() {
    return renderHook(() => useAuth(), { wrapper: AuthProvider });
}

/** Renders the provider and waits for the stored session to be validated. */
async function renderSignedIn(as: "Admin" | "User" = "Admin") {
    signIn(as);
    const rendered = renderAuth();
    await waitFor(() => expect(rendered.result.current.status).toBe("authenticated"));
    return rendered;
}

describe("AuthProvider", () => {
    describe("on load", () => {
        it("is anonymous at once without a stored token", async () => {
            const profile = count("get", "/profile");
            const { result } = renderAuth();

            expect(result.current).toMatchObject({ status: "anonymous", user: null, isAdmin: false, sessionExpired: false });
            await act(async () => {});
            expect(profile.calls).toBe(0);
        });

        it("validates a stored Admin session", async () => {
            signIn("Admin");
            const { result } = renderAuth();

            expect(result.current.status).toBe("loading");
            await waitFor(() => expect(result.current.status).toBe("authenticated"));
            expect(result.current.user).toEqual({ id: ADMIN.id, email: ADMIN.email, role: "Admin" });
            expect(result.current.isAdmin).toBe(true);
        });

        it("validates a stored User session, without admin rights", async () => {
            const { result } = await renderSignedIn("User");
            expect(result.current.user).toEqual({ id: USER.id, email: USER.email, role: "User" });
            expect(result.current.isAdmin).toBe(false);
        });

        it("refreshes an expired access token", async () => {
            signIn("Admin");
            const stale = tokens.access;
            db.expireAccessTokens();

            const { result } = renderAuth();

            await waitFor(() => expect(result.current.status).toBe("authenticated"));
            expect(tokens.access).not.toBe(stale);
            expect(db.userForAccess(tokens.access ?? undefined)?.id).toBe(ADMIN.id);
        });

        it("clears a session that can no longer be refreshed", async () => {
            signIn("Admin");
            db.expireAccessTokens();
            db.expireRefreshTokens();

            const { result } = renderAuth();

            await waitFor(() => expect(result.current.status).toBe("anonymous"));
            expect(result.current.user).toBeNull();
            expect(tokens.access).toBeNull();
            expect(tokens.refresh).toBeNull();
        });

        it("clears an unknown token", async () => {
            localStorage.setItem("access_token", "not-a-token");
            const { result } = renderAuth();

            expect(result.current.status).toBe("loading");
            await waitFor(() => expect(result.current.status).toBe("anonymous"));
            expect(tokens.access).toBeNull();
        });

        it("defaults the email and the role of an incomplete profile", async () => {
            server.use(http.get(api("/profile"), () => HttpResponse.json({ userId: "7", email: null, role: null })));
            const { result } = await renderSignedIn();

            expect(result.current.user).toEqual({ id: 7, email: "", role: "User" });
            expect(result.current.isAdmin).toBe(false);
        });

        it("keeps the stored tokens when unmounted before the check ends", async () => {
            signIn("Admin");
            const stored = { access: tokens.access, refresh: tokens.refresh };
            let requested = false;
            let aborted = false;
            server.use(
                http.get(api("/profile"), async ({ request }) => {
                    requested = true;
                    request.signal.addEventListener("abort", () => {
                        aborted = true;
                    });
                    await delay("infinite");
                }),
            );
            const { unmount } = renderAuth();
            await waitFor(() => expect(requested).toBe(true));

            unmount();
            await waitFor(() => expect(aborted).toBe(true));
            await new Promise((resolve) => setTimeout(resolve, 20));

            expect({ access: tokens.access, refresh: tokens.refresh }).toEqual(stored);
        });
    });

    describe("login", () => {
        it("stores the tokens, loads the profile and returns the user", async () => {
            const { result } = renderAuth();

            let user: unknown;
            await act(async () => {
                user = await result.current.login(ADMIN.email, ADMIN.password);
            });

            expect(user).toEqual({ id: ADMIN.id, email: ADMIN.email, role: "Admin" });
            expect(result.current).toMatchObject({ status: "authenticated", user, isAdmin: true, sessionExpired: false });
            expect(db.userForAccess(tokens.access ?? undefined)?.id).toBe(ADMIN.id);
            expect(tokens.refresh).toMatch(/^refresh-1-/);
        });

        it("rejects wrong credentials and stays anonymous", async () => {
            const { result } = renderAuth();

            await act(async () => {
                await expect(result.current.login(ADMIN.email, "wrong")).rejects.toMatchObject({ status: 401, detail: "Invalid email or password." });
            });

            expect(result.current).toMatchObject({ status: "anonymous", user: null });
            expect(tokens.access).toBeNull();
        });
    });

    describe("register", () => {
        it("creates the account, then logs in with it", async () => {
            const { result } = renderAuth();

            let user: unknown;
            await act(async () => {
                user = await result.current.register("jdupont", "jean.dupont@inventory.fr", "Secret123!");
            });

            expect(db.users.find((u) => u.email === "jean.dupont@inventory.fr")).toMatchObject({ username: "jdupont", role: "User" });
            expect(user).toEqual({ id: 3, email: "jean.dupont@inventory.fr", role: "User" });
            expect(result.current).toMatchObject({ status: "authenticated", isAdmin: false });
        });

        it("rejects an email already in use, without logging in", async () => {
            const login = count("post", "/auth/login");
            const { result } = renderAuth();

            await act(async () => {
                await expect(result.current.register("claire", USER.email, "User1234!")).rejects.toMatchObject({ status: 400, detail: "This user already exists." });
            });

            expect(login.calls).toBe(0);
            expect(result.current.status).toBe("anonymous");
        });
    });

    describe("logout", () => {
        it("revokes the refresh token and signs out", async () => {
            const { result } = await renderSignedIn();
            const refresh = tokens.refresh as string;

            await act(() => result.current.logout());

            expect(result.current).toMatchObject({ status: "anonymous", user: null, isAdmin: false, sessionExpired: false });
            expect(tokens.access).toBeNull();
            expect(tokens.refresh).toBeNull();
            expect(db.takeRefresh(refresh)).toBeUndefined();
        });

        it("signs out locally even when the API cannot be reached", async () => {
            const { result } = await renderSignedIn();
            server.use(http.post(api("/auth/logout"), () => HttpResponse.error()));

            await act(() => result.current.logout());

            expect(result.current).toMatchObject({ status: "anonymous", user: null });
            expect(tokens.access).toBeNull();
        });

        it("does not call the API without a session", async () => {
            const logout = count("post", "/auth/logout");
            const { result } = renderAuth();

            await act(() => result.current.logout());

            expect(logout.calls).toBe(0);
            expect(result.current.status).toBe("anonymous");
        });
    });

    describe("session expiry", () => {
        async function expireSession() {
            const rendered = await renderSignedIn();
            db.expireAccessTokens();
            db.expireRefreshTokens();
            await act(async () => {
                await expect(dashboardApi.get()).rejects.toMatchObject({ status: 401 });
            });
            return rendered;
        }

        it("flags the session as expired when a refresh fails, keeping the user", async () => {
            const { result } = await expireSession();
            expect(result.current).toMatchObject({ sessionExpired: true, status: "authenticated", user: { id: ADMIN.id } });
        });

        it("clears the flag on the next login", async () => {
            const { result } = await expireSession();

            await act(async () => {
                await result.current.login(ADMIN.email, ADMIN.password);
            });

            expect(result.current).toMatchObject({ sessionExpired: false, status: "authenticated" });
        });

        it("clears the flag on logout", async () => {
            const { result } = await expireSession();

            await act(() => result.current.logout());

            expect(result.current).toMatchObject({ sessionExpired: false, status: "anonymous" });
        });
    });
});

describe("useAuth", () => {
    it("throws outside an AuthProvider", () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => renderHook(() => useAuth())).toThrow("useAuth doit être utilisé dans un AuthProvider");
    });
});
