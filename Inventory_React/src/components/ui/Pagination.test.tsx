import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pagination } from "./Pagination";

type Props = Partial<Parameters<typeof Pagination>[0]>;

function renderPagination(props: Props = {}) {
    const onPage = vi.fn();
    render(<Pagination page={1} pages={1} total={5} size={10} noun="produit" onPage={onPage} {...props} />);
    return { onPage };
}

/** The page buttons and ellipses, in order, e.g. ["1", "2", "…", "9", "10"]. */
function sequence() {
    const pages = screen.getByRole("button", { name: "Page précédente" }).parentElement!;
    return Array.from(pages.children)
        .filter((el) => !["Page précédente", "Page suivante"].includes(el.getAttribute("aria-label") ?? ""))
        .map((el) => el.textContent);
}

describe("Pagination", () => {
    it("is a navigation landmark", () => {
        renderPagination();
        expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
    });

    it.each([
        { page: 1, pages: 1, expected: ["1"] },
        { page: 1, pages: 4, expected: ["1", "2", "3", "4"] },
        { page: 3, pages: 5, expected: ["1", "2", "3", "4", "5"] },
        { page: 1, pages: 10, expected: ["1", "2", "…", "9", "10"] },
        { page: 4, pages: 10, expected: ["1", "2", "3", "4", "5", "…", "9", "10"] },
        { page: 5, pages: 10, expected: ["1", "2", "…", "4", "5", "6", "…", "9", "10"] },
        { page: 10, pages: 10, expected: ["1", "2", "…", "9", "10"] },
        { page: 8, pages: 20, expected: ["1", "2", "…", "7", "8", "9", "…", "19", "20"] },
    ])("shows $expected on page $page of $pages", ({ page, pages, expected }) => {
        renderPagination({ page, pages, total: pages * 10 });
        expect(sequence()).toEqual(expected);
    });

    it("hides the ellipses from assistive technologies", () => {
        const { container } = render(<Pagination page={5} pages={10} total={100} size={10} noun="produit" onPage={() => {}} />);
        const ellipses = container.querySelectorAll(".pg-ellipsis");
        expect(ellipses).toHaveLength(2);
        ellipses.forEach((el) => expect(el).toHaveAttribute("aria-hidden", "true"));
    });

    it("marks the current page only", () => {
        renderPagination({ page: 2, pages: 3, total: 30 });
        expect(screen.getByRole("button", { name: "Page 2" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("button", { name: "Page 1" })).not.toHaveAttribute("aria-current");
        expect(screen.getByRole("button", { name: "Page 3" })).not.toHaveAttribute("aria-current");
    });

    it("disables Previous on the first page", () => {
        renderPagination({ page: 1, pages: 3, total: 30 });
        expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Page suivante" })).toBeEnabled();
    });

    it("disables Next on the last page", () => {
        renderPagination({ page: 3, pages: 3, total: 30 });
        expect(screen.getByRole("button", { name: "Page précédente" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
    });

    it("disables both arrows when there are no pages", () => {
        renderPagination({ page: 1, pages: 0, total: 0 });
        expect(screen.getByRole("button", { name: "Page précédente" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Page suivante" })).toBeDisabled();
        expect(sequence()).toEqual([]);
        expect(screen.getByText("Aucun résultat")).toBeInTheDocument();
    });

    it("goes to the previous, next and chosen page", async () => {
        const user = userEvent.setup();
        const { onPage } = renderPagination({ page: 5, pages: 10, total: 100 });
        await user.click(screen.getByRole("button", { name: "Page précédente" }));
        await user.click(screen.getByRole("button", { name: "Page suivante" }));
        await user.click(screen.getByRole("button", { name: "Page 9" }));
        expect(onPage.mock.calls).toEqual([[4], [6], [9]]);
    });

    it("does not go past the ends", async () => {
        const user = userEvent.setup();
        const { onPage } = renderPagination({ page: 1, pages: 1, total: 3 });
        await user.click(screen.getByRole("button", { name: "Page précédente" }));
        await user.click(screen.getByRole("button", { name: "Page suivante" }));
        expect(onPage).not.toHaveBeenCalled();
    });

    it.each([
        { page: 1, total: 1, size: 10, text: "1–1 sur 1 produit" },
        { page: 2, total: 25, size: 10, text: "11–20 sur 25 produits" },
        { page: 3, total: 25, size: 10, text: "21–25 sur 25 produits" },
        { page: 1, total: 1234, size: 20, text: "1–20 sur 1 234 produits" },
    ])("summarises page $page of $total items as “$text”", ({ page, total, size, text }) => {
        renderPagination({ page, pages: Math.ceil(total / size), total, size });
        expect(screen.getByRole("navigation", { name: "Pagination" }).firstElementChild?.textContent).toBe(text);
    });

    it("has no page size selector without sizes and a handler", () => {
        renderPagination({ sizes: [10, 20] });
        expect(screen.queryByRole("combobox", { name: "Éléments par page" })).not.toBeInTheDocument();
    });

    it("changes the page size", async () => {
        const user = userEvent.setup();
        const onSize = vi.fn();
        renderPagination({ page: 1, pages: 3, total: 50, size: 20, sizes: [10, 20, 50], onSize });
        const select = screen.getByRole("combobox", { name: "Éléments par page" });
        expect(select).toHaveValue("20");
        expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual(["10", "20", "50"]);
        await user.selectOptions(select, "50");
        expect(onSize).toHaveBeenCalledWith(50);
    });
});
