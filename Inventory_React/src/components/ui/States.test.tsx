import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EmptyState, ErrorBanner, SkeletonHead, SkeletonPage, SkeletonRows, SkeletonTable } from "./States";
import { ApiError } from "../../lib/api";

const rowsIn = (el: Element) => el.querySelectorAll(":scope > .sk-row");

describe("EmptyState", () => {
    it("shows an icon, a title and a text", () => {
        const { container } = render(<EmptyState icon="history" title="Aucun mouvement" text="Les mouvements apparaîtront ici." />);
        expect(screen.getByRole("heading", { level: 3, name: "Aucun mouvement" })).toBeInTheDocument();
        expect(screen.getByText("Les mouvements apparaîtront ici.")).toBeInTheDocument();
        expect(container.querySelector("use")).toHaveAttribute("href", "#i-history");
        expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("shows its actions", () => {
        render(<EmptyState icon="search" title="Aucun produit" text="Modifiez les filtres." actions={<button type="button">Réinitialiser les filtres</button>} />);
        expect(screen.getByRole("button", { name: "Réinitialiser les filtres" })).toBeInTheDocument();
    });
});

describe("ErrorBanner", () => {
    it("announces the default title and the French message of the error", () => {
        render(<ErrorBanner error={new ApiError(404, {})} />);
        expect(screen.getByRole("alert")).toHaveTextContent("Chargement impossible. L’élément demandé est introuvable (404).");
        expect(screen.queryByRole("button", { name: "Réessayer" })).not.toBeInTheDocument();
    });

    it("uses a custom title and a generic message for an unknown error", () => {
        render(<ErrorBanner error={new Error("boom")} title="Tableau de bord indisponible." />);
        expect(screen.getByRole("alert")).toHaveTextContent("Tableau de bord indisponible. Une erreur inattendue est survenue.");
    });

    it("retries when asked", async () => {
        const user = userEvent.setup();
        const onRetry = vi.fn();
        render(<ErrorBanner error={new ApiError(500, {})} onRetry={onRetry} />);
        expect(screen.getByRole("alert")).toHaveTextContent("Une erreur interne est survenue côté serveur.");
        await user.click(screen.getByRole("button", { name: "Réessayer" }));
        expect(onRetry).toHaveBeenCalledTimes(1);
    });
});

describe("skeletons", () => {
    it("SkeletonTable shows a toolbar and ten rows by default", () => {
        render(<SkeletonTable />);
        const table = screen.getByLabelText("Chargement");
        expect(table).toHaveAttribute("aria-busy", "true");
        // The toolbar is one more row.
        expect(rowsIn(table)).toHaveLength(11);
    });

    it("SkeletonTable can drop the toolbar and change the row count", () => {
        render(<SkeletonTable rows={3} toolbar={false} />);
        expect(rowsIn(screen.getByLabelText("Chargement"))).toHaveLength(3);
    });

    it("SkeletonRows shows the requested number of rows", () => {
        render(<SkeletonRows rows={4} />);
        const rows = screen.getByLabelText("Chargement");
        expect(rows).toHaveAttribute("aria-busy", "true");
        expect(rowsIn(rows)).toHaveLength(4);
    });

    it("SkeletonHead draws a title line and a lede line", () => {
        const { container } = render(<SkeletonHead />);
        const lines = container.querySelectorAll(".sk-line");
        expect(lines).toHaveLength(2);
        expect(lines[0]).toHaveStyle({ height: "28px" });
        expect(lines[1]).not.toHaveAttribute("style");
    });

    it("SkeletonPage combines a head and a table", () => {
        const { container } = render(<SkeletonPage rows={2} />);
        const page = container.firstElementChild!;
        expect(page).toHaveAttribute("aria-busy", "true");
        expect(page).toHaveAttribute("aria-label", "Chargement");
        expect(rowsIn(page.querySelector(".card")!)).toHaveLength(3);
    });

    it("SkeletonPage shows ten rows by default", () => {
        const { container } = render(<SkeletonPage />);
        expect(rowsIn(container.querySelector(".card")!)).toHaveLength(11);
    });
});
