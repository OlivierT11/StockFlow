import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { usePageTitle } from "../components/layout/shellContext";
import { useAuth } from "../context/auth";
import { gap } from "../lib/style";

export function ForbiddenPage() {
    const { user } = useAuth();
    usePageTitle("Accès refusé");
    return (
        <div className="error-page">
            <div className="error-inner">
                <span className="error-icon"><Icon name="lock" /></span>
                <span className="code">403</span>
                <h2>Accès refusé</h2>
                <p>
                    Cette page est réservée aux administrateurs. Votre rôle actuel est <strong>{user?.role}</strong>.
                    Demandez à un administrateur de modifier votre rôle si nécessaire.
                </p>
                <Link className="btn btn-primary" to="/">Retour au tableau de bord</Link>
            </div>
        </div>
    );
}

/** Inside the shell; also used when a product id does not exist. */
export function NotFoundPage() {
    usePageTitle("Page introuvable");
    return (
        <div className="error-page">
            <div className="error-inner">
                <span className="code">404</span>
                <h2>Page introuvable</h2>
                <p>L’adresse demandée n’existe pas ou l’élément a été supprimé.</p>
                <div className="od-row" style={gap(8)}>
                    <Link className="btn btn-primary" to="/">Tableau de bord</Link>
                    <Link className="btn btn-secondary" to="/produits">Liste des produits</Link>
                </div>
            </div>
        </div>
    );
}
