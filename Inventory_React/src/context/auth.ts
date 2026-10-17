import { createContext, useContext } from "react";
import type { Role } from "../lib/types";

export type SessionUser = {
    id: number;
    email: string;
    role: Role;
};

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
    status: AuthStatus;
    user: SessionUser | null;
    isAdmin: boolean;
    /** Set when a token refresh failed: writes are refused until the user logs in again. */
    sessionExpired: boolean;
    login: (email: string, password: string) => Promise<SessionUser>;
    register: (username: string, email: string, password: string) => Promise<SessionUser>;
    logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth doit être utilisé dans un AuthProvider");
    return context;
}
