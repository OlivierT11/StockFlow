import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Icon } from "../components/Icon";
import { Field, FormSummary, PasswordInput } from "../components/ui/Form";
import { useAuth } from "../context/auth";
import { useToast } from "../context/toast";
import { useValidation } from "../hooks/useValidation";
import { ApiError, errorMessage } from "../lib/api";
import { EMAIL_RE, fieldProps } from "../lib/forms";

function AuthLayout({ children }: { children: ReactNode }) {
    return (
        <div className="auth">
            <aside className="auth-side">
                <div className="brand">
                    <span className="brand-mark"><Icon name="package" /></span>
                    <span className="brand-name">Inventory</span>
                </div>
                <div>
                    <h1>Le stock de l’atelier, à jour et sous contrôle.</h1>
                    <p>Produits, seuils d’alerte, entrées et sorties par entrepôt : une seule application pour toute l’équipe.</p>
                    <ul>
                        <li><Icon name="check-circle" />Tableau de bord des stocks sous seuil</li>
                        <li><Icon name="check-circle" />Journal des mouvements horodaté</li>
                        <li><Icon name="check-circle" />Rôles User et Admin</li>
                    </ul>
                </div>
                <span className="side-foot">Application interne · API ASP.NET Core</span>
            </aside>
            <div className="auth-main">
                <div className="auth-card">{children}</div>
            </div>
        </div>
    );
}

function FormError({ children }: { children: ReactNode }) {
    return (
        <div className="form-error" role="alert">
            <Icon name="alert-circle" />
            <span>{children}</span>
        </div>
    );
}

const emailError = (v: string) =>
    !v.trim()
        ? "Saisissez votre adresse e-mail."
        : !EMAIL_RE.test(v.trim())
            ? "Le format de l’adresse n’est pas valide (ex. prenom.nom@inventory.fr)."
            : "";

export function LoginPage() {
    const { login } = useAuth();
    const toast = useToast();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState<ReactNode>(null);
    const [lockedUntil, setLockedUntil] = useState(0);
    const v = useValidation({
        email: () => emailError(email),
        password: () => (password ? "" : "Saisissez votre mot de passe."),
    });

    useEffect(() => {
        document.title = "Connexion — Inventory";
    }, []);

    const lockMessage = (until: number) => (
        <><strong>Trop de tentatives (429).</strong> Réessayez dans {Math.max(1, Math.ceil((until - Date.now()) / 1000))} s.</>
    );

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setFormError(null);
        if (!v.checkAll()) return;
        if (lockedUntil > Date.now()) {
            setFormError(lockMessage(lockedUntil));
            return;
        }
        setLoading(true);
        try {
            const user = await login(email.trim(), password);
            // The PublicOnly guard now redirects to the requested page.
            setTimeout(() => toast("success", "Bienvenue", `Connecté en tant que ${user.email}.`), 400);
        } catch (err) {
            setLoading(false);
            if (err instanceof ApiError && err.status === 401) {
                setFormError("Email ou mot de passe incorrect.");
            } else if (err instanceof ApiError && err.status === 429) {
                const until = Date.now() + (err.retryAfter ?? 60) * 1000;
                setLockedUntil(until);
                setFormError(lockMessage(until));
            } else if (err instanceof ApiError && err.status === 400 && Object.keys(err.fieldErrors).length) {
                v.setServerErrors(err.fieldErrors);
            } else {
                setFormError(errorMessage(err));
            }
        }
    }

    return (
        <AuthLayout>
            <div>
                <h2>Connexion</h2>
                <p className="lede">Accédez à votre espace de gestion d’inventaire.</p>
            </div>
            {formError && <FormError>{formError}</FormError>}
            <form onSubmit={onSubmit} noValidate>
                <Field name="email" label="Adresse e-mail" required error={v.errors.email}>
                    <input
                        {...fieldProps("email", v.errors.email)}
                        className="input"
                        type="email"
                        autoComplete="username"
                        autoFocus
                        placeholder="prenom.nom@inventory.fr"
                        value={email}
                        onChange={(e) => {
                            setEmail(e.target.value);
                            v.changed("email");
                        }}
                        onBlur={() => v.check("email")}
                    />
                </Field>
                <Field name="password" label="Mot de passe" required error={v.errors.password}>
                    <PasswordInput
                        {...fieldProps("password", v.errors.password)}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => {
                            setPassword(e.target.value);
                            v.changed("password");
                        }}
                    />
                </Field>
                <button type="submit" className={`btn btn-primary btn-lg btn-block${loading ? " is-loading" : ""}`} aria-busy={loading || undefined}>
                    Se connecter
                </button>
            </form>
            <p className="auth-foot">Pas encore de compte ? <Link to="/inscription">Créer un compte</Link></p>
        </AuthLayout>
    );
}

function passwordStrength(pw: string): number {
    return [pw.length >= 8, /[A-Z]/.test(pw), /\d/.test(pw), /[^\w]/.test(pw)].filter(Boolean).length;
}

export function RegisterPage() {
    const { register } = useAuth();
    const toast = useToast();
    const [form, setForm] = useState({ username: "", email: "", password: "", confirm: "" });
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState<ReactNode>(null);
    const v = useValidation({
        username: () => (form.username.trim().length < 3 ? "Le nom d’utilisateur doit contenir au moins 3 caractères." : ""),
        email: () => (!EMAIL_RE.test(form.email.trim()) ? "Le format de l’adresse n’est pas valide." : ""),
        password: () => (form.password.length < 8 ? "Le mot de passe doit contenir au moins 8 caractères." : ""),
        confirm: () => (form.confirm !== form.password ? "Les deux mots de passe ne correspondent pas." : ""),
    });
    const strength = passwordStrength(form.password);

    useEffect(() => {
        document.title = "Créer un compte — Inventory";
    }, []);

    const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
        setForm((f) => ({ ...f, [key]: e.target.value }));
        v.changed(key);
    };

    async function onSubmit(e: FormEvent) {
        e.preventDefault();
        setFormError(null);
        if (!v.checkAll()) return;
        setLoading(true);
        const username = form.username.trim();
        try {
            await register(username, form.email.trim().toLowerCase(), form.password);
            setTimeout(() => toast("success", "Compte créé", `Bienvenue ${username}. Vous avez le rôle User.`), 400);
        } catch (err) {
            setLoading(false);
            if (err instanceof ApiError && err.status === 400 && Object.keys(err.fieldErrors).length) {
                v.setServerErrors(err.fieldErrors);
            } else if (err instanceof ApiError && err.status === 400) {
                // "This user already exists."
                v.setServerErrors({ email: "Cette adresse est déjà utilisée. Connectez-vous ou utilisez une autre adresse." });
            } else if (err instanceof ApiError && err.status === 429) {
                setFormError(<><strong>Trop de tentatives (429).</strong> Réessayez dans {err.retryAfter ?? 60} s.</>);
            } else {
                setFormError(errorMessage(err));
            }
        }
    }

    return (
        <AuthLayout>
            <div>
                <h2>Créer un compte</h2>
                <p className="lede">Un nouveau compte reçoit le rôle User. Un administrateur pourra l’élever ensuite.</p>
            </div>
            {formError && <FormError>{formError}</FormError>}
            <FormSummary errors={v.summary} />
            <form onSubmit={onSubmit} noValidate>
                <Field name="username" label="Nom d’utilisateur" required error={v.errors.username}>
                    <input
                        {...fieldProps("username", v.errors.username)}
                        className="input"
                        autoComplete="username"
                        autoFocus
                        maxLength={50}
                        value={form.username}
                        onChange={set("username")}
                        onBlur={() => v.check("username")}
                    />
                </Field>
                <Field name="email" label="Adresse e-mail" required error={v.errors.email}>
                    <input
                        {...fieldProps("email", v.errors.email)}
                        className="input"
                        type="email"
                        autoComplete="email"
                        value={form.email}
                        onChange={set("email")}
                        onBlur={() => v.check("email")}
                    />
                </Field>
                <Field
                    name="password"
                    label="Mot de passe"
                    required
                    hint="8 caractères minimum."
                    error={v.errors.password}
                    extra={
                        <span className="pw-strength" aria-hidden="true">
                            {[0, 1, 2, 3].map((i) => <i key={i} className={i < strength ? "on" : undefined} />)}
                        </span>
                    }
                >
                    <PasswordInput
                        {...fieldProps("password", v.errors.password, true)}
                        autoComplete="new-password"
                        value={form.password}
                        onChange={set("password")}
                        onBlur={() => v.check("password")}
                    />
                </Field>
                <Field name="confirm" label="Confirmation du mot de passe" required error={v.errors.confirm}>
                    <input
                        {...fieldProps("confirm", v.errors.confirm)}
                        className="input"
                        type="password"
                        autoComplete="new-password"
                        value={form.confirm}
                        onChange={set("confirm")}
                        onBlur={() => v.check("confirm")}
                    />
                </Field>
                <button type="submit" className={`btn btn-primary btn-lg btn-block${loading ? " is-loading" : ""}`} aria-busy={loading || undefined}>
                    Créer le compte
                </button>
            </form>
            <p className="auth-foot">Déjà un compte ? <Link to="/login">Se connecter</Link></p>
        </AuthLayout>
    );
}
