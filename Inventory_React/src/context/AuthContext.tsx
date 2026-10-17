import { useCallback, useEffect, useMemo, useState, type PropsWithChildren } from "react";
import { AuthContext, type AuthContextValue, type AuthStatus, type SessionUser } from "./auth";
import { authApi, onSessionExpired, tokens } from "../lib/api";
import type { Profile } from "../lib/types";

function toSessionUser(profile: Profile): SessionUser {
    return {
        id: Number(profile.userId),
        email: profile.email ?? "",
        role: profile.role === "Admin" ? "Admin" : "User",
    };
}

export function AuthProvider({ children }: PropsWithChildren) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [status, setStatus] = useState<AuthStatus>(() => (tokens.access ? "loading" : "anonymous"));
    const [sessionExpired, setSessionExpired] = useState(false);

    // Validate the stored session once, on load (the request refreshes an expired access token).
    useEffect(() => {
        if (!tokens.access) return;
        const controller = new AbortController();
        authApi
            .profile(controller.signal)
            .then((profile) => {
                setUser(toSessionUser(profile));
                setStatus("authenticated");
            })
            .catch(() => {
                if (controller.signal.aborted) return;
                tokens.clear();
                setStatus("anonymous");
            });
        return () => controller.abort();
    }, []);

    useEffect(() => {
        onSessionExpired(() => setSessionExpired(true));
        return () => onSessionExpired(null);
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const res = await authApi.login(email, password);
        tokens.set(res.access_token, res.refresh_token);
        const sessionUser = toSessionUser(await authApi.profile());
        setUser(sessionUser);
        setSessionExpired(false);
        setStatus("authenticated");
        return sessionUser;
    }, []);

    const register = useCallback(
        async (username: string, email: string, password: string) => {
            await authApi.register(username, email, password);
            return login(email, password);
        },
        [login],
    );

    const logout = useCallback(async () => {
        const refreshToken = tokens.refresh;
        try {
            if (refreshToken && tokens.access) await authApi.logout(refreshToken);
        } catch {
            // The session is closed locally even if the API could not revoke the tokens.
        } finally {
            tokens.clear();
            setUser(null);
            setSessionExpired(false);
            setStatus("anonymous");
        }
    }, []);

    const value = useMemo<AuthContextValue>(
        () => ({ status, user, isAdmin: user?.role === "Admin", sessionExpired, login, register, logout }),
        [status, user, sessionExpired, login, register, logout],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
