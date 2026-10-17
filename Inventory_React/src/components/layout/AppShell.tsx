import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "../Icon";
import { RoleBadge } from "../ui/Badges";
import { ShellContext } from "./shellContext";
import { useAuth } from "../../context/auth";
import { useQuery } from "../../hooks/useQuery";
import { dashboardApi } from "../../lib/api";
import { initials } from "../../lib/format";

type NavItem = { to: string; label: string; icon: IconName; end?: boolean; count?: number | null };

function UserMenu() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const wrap = useRef<HTMLDivElement>(null);
    const firstItem = useRef<HTMLButtonElement>(null);
    const button = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (!open) return;
        firstItem.current?.focus();
        const onDocClick = (e: MouseEvent) => {
            if (!wrap.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("click", onDocClick);
        return () => document.removeEventListener("click", onDocClick);
    }, [open]);

    if (!user) return null;
    return (
        <div className="user-menu-wrap" ref={wrap}>
            <button
                ref={button}
                type="button"
                className="user-btn"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls="user-menu"
                onClick={() => setOpen((o) => !o)}
            >
                <span className="user-chip">
                    <span className="avatar" aria-hidden="true">{initials(user.email)}</span>
                    <span className="user-meta">
                        <span className="user-email od-truncate">{user.email}</span>
                        <span className="user-role">{user.role === "Admin" ? "Administrateur" : "Utilisateur"}</span>
                    </span>
                </span>
                <Icon name="chevron-down" />
            </button>
            {open && (
                <div
                    className="menu"
                    id="user-menu"
                    role="menu"
                    onKeyDown={(e) => {
                        if (e.key === "Escape") {
                            setOpen(false);
                            button.current?.focus();
                        }
                    }}
                >
                    <div className="menu-head">
                        Connecté en tant que<br />
                        <strong>{user.email}</strong> · <RoleBadge role={user.role} />
                    </div>
                    <div className="menu-sep" />
                    <button
                        ref={firstItem}
                        type="button"
                        className="menu-item danger"
                        role="menuitem"
                        onClick={async () => {
                            await logout();
                            navigate("/login", { replace: true });
                        }}
                    >
                        <Icon name="logout" />Déconnexion
                    </button>
                </div>
            )}
        </div>
    );
}

function SessionBanner() {
    const { sessionExpired, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    if (!sessionExpired) return null;
    return (
        <div className="banner banner-warning session-banner" role="alert">
            <Icon name="alert" />
            <span className="banner-text">
                <strong>Session expirée.</strong> Reconnectez-vous pour continuer : les actions d’écriture sont suspendues.
            </span>
            <button
                type="button"
                className="btn btn-sm btn-secondary"
                onClick={async () => {
                    await logout();
                    navigate("/login", { replace: true, state: { from: location } });
                }}
            >
                Se reconnecter
            </button>
        </div>
    );
}

export default function AppShell() {
    const [title, setTitle] = useState("");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [scrimVisible, setScrimVisible] = useState(false);

    // Product counters for the nav badge and the products lede; refetched after every write.
    const stats = useQuery("shell-stats", (signal) => dashboardApi.get(signal), { keepPrevious: true });
    const lowStockCount = stats.data?.lowStockProductCount ?? null;
    const productCount = stats.data?.productCount ?? null;

    useEffect(() => {
        const raf = requestAnimationFrame(() => setScrimVisible(sidebarOpen));
        if (!sidebarOpen) return () => cancelAnimationFrame(raf);
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSidebarOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => {
            cancelAnimationFrame(raf);
            document.removeEventListener("keydown", onKey);
        };
    }, [sidebarOpen]);

    const shell = useMemo(() => ({ setTitle, lowStockCount, productCount }), [lowStockCount, productCount]);

    const items: NavItem[] = [
        { to: "/", label: "Tableau de bord", icon: "dashboard", end: true },
        { to: "/produits", label: "Produits", icon: "package", count: lowStockCount },
        { to: "/mouvements", label: "Mouvements", icon: "moves" },
        { to: "/categories", label: "Catégories", icon: "tag" },
        { to: "/entrepots", label: "Entrepôts", icon: "warehouse" },
    ];

    const link = (it: NavItem) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="nav-link" title={it.label} onClick={() => setSidebarOpen(false)}>
            <Icon name={it.icon} />
            <span className="nav-label">{it.label}</span>
            {!!it.count && <span className="nav-count" aria-label={`${it.count} produits à surveiller`}>{it.count}</span>}
        </NavLink>
    );

    return (
        <ShellContext.Provider value={shell}>
            <div className="app">
                <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`} id="sidebar" aria-label="Navigation principale">
                    <div className="brand">
                        <span className="brand-mark"><Icon name="package" /></span>
                        <span className="brand-name">Inventory</span>
                    </div>
                    <nav className="nav">
                        <span className="nav-section">Gestion</span>
                        {items.map(link)}
                    </nav>
                    <div className="sidebar-foot">Inventory · v0.1</div>
                </aside>
                {sidebarOpen && (
                    <div className={`scrim${scrimVisible ? " is-open" : ""}`} onClick={() => setSidebarOpen(false)} />
                )}
                <div className="main">
                    <header className="topbar">
                        <button
                            type="button"
                            className="btn btn-ghost btn-icon menu-btn"
                            aria-label={sidebarOpen ? "Fermer la navigation" : "Ouvrir la navigation"}
                            aria-controls="sidebar"
                            aria-expanded={sidebarOpen}
                            onClick={() => setSidebarOpen((o) => !o)}
                        >
                            <Icon name="menu" />
                        </button>
                        <span className="topbar-title">{title}</span>
                        <UserMenu />
                    </header>
                    <SessionBanner />
                    <main className="page" tabIndex={-1}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </ShellContext.Provider>
    );
}
