// Render helpers: the whole app on a URL, or one component inside the app's providers.
import { render, type RenderOptions } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactElement, ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import { MovementDrawerProvider } from "../components/MovementDrawer";
import { ConfirmProvider } from "../components/ui/ConfirmDialog";
import { AuthProvider } from "../context/AuthContext";
import { DataProvider } from "../context/DataContext";
import { ToastProvider } from "../context/ToastContext";
import { tokens } from "../lib/api";
import { ADMIN, USER, db } from "./db";

export type As = "Admin" | "User" | null;

/** Stores a valid token pair for the seeded Admin or User, as after a login. */
export function signIn(as: Exclude<As, null> = "Admin") {
    const t = db.issueTokens(as === "Admin" ? ADMIN.id : USER.id);
    tokens.set(t.access, t.refresh);
}

/**
 * Renders <App /> on `path`, signed in as the seeded Admin by default (`as: null` for a visitor).
 * The app starts by validating the session: await a findBy… query before interacting.
 */
export function renderApp(path = "/", { as = "Admin" }: { as?: As } = {}) {
    if (as) signIn(as);
    window.history.pushState(null, "", path);
    const user = userEvent.setup();
    return { user, ...render(<App />) };
}

/** The providers of App.tsx around a MemoryRouter, for components rendered on their own. */
export function Providers({ children, route = "/" }: { children: ReactNode; route?: string }) {
    return (
        <MemoryRouter initialEntries={[route]}>
            <ToastProvider>
                <AuthProvider>
                    <DataProvider>
                        <ConfirmProvider>
                            <MovementDrawerProvider>{children}</MovementDrawerProvider>
                        </ConfirmProvider>
                    </DataProvider>
                </AuthProvider>
            </ToastProvider>
        </MemoryRouter>
    );
}

export function renderWithProviders(ui: ReactElement, { route, as = "Admin", ...options }: { route?: string; as?: As } & Omit<RenderOptions, "wrapper"> = {}) {
    if (as) signIn(as);
    const user = userEvent.setup();
    return { user, ...render(ui, { wrapper: ({ children }) => <Providers route={route}>{children}</Providers>, ...options }) };
}
