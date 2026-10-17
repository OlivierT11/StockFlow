import { Navigate, Outlet, useLocation, type Location } from "react-router-dom";
import { Icon } from "./Icon";
import { useAuth } from "../context/auth";
import { ForbiddenPage } from "../pages/ErrorPages";

function Boot() {
    return (
        <div className="boot" aria-busy="true">
            <span className="od-stack" style={{ justifyItems: "center", textAlign: "center" }}>
                <Icon name="package" />
                <span>Vérification de la session…</span>
            </span>
        </div>
    );
}

/** Signed-in area: redirects to /login and comes back to the requested page afterwards. */
export function RequireAuth() {
    const { status } = useAuth();
    const location = useLocation();
    if (status === "loading") return <Boot />;
    if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;
    return <Outlet />;
}

/** Admin-only pages render the 403 page inside the shell for a User. */
export function RequireAdmin() {
    const { isAdmin } = useAuth();
    return isAdmin ? <Outlet /> : <ForbiddenPage />;
}

/** Login and registration: a signed-in user goes straight to the app. */
export function PublicOnly() {
    const { status } = useAuth();
    const location = useLocation();
    if (status === "loading") return <Boot />;
    if (status === "authenticated") {
        const from = (location.state as { from?: Location } | null)?.from;
        return <Navigate to={from ? `${from.pathname}${from.search}` : "/"} replace />;
    }
    return <Outlet />;
}
