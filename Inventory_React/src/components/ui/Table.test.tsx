import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SortHeader } from "./Table";
import type { SortDirection } from "../../lib/types";

type Key = "name" | "price";

function renderHeader(props: { sortKey: Key; sort: Key; dir: SortDirection; numeric?: boolean; onSort?: (key: Key) => void }) {
    const onSort = props.onSort ?? vi.fn();
    render(
        <table>
            <thead>
                <tr>
                    <SortHeader label="Prix" {...props} onSort={onSort} />
                </tr>
            </thead>
        </table>,
    );
    return { header: screen.getByRole("columnheader", { name: "Prix" }), onSort };
}

describe("SortHeader", () => {
    it("is ascending when its column is sorted ascending", () => {
        const { header } = renderHeader({ sortKey: "price", sort: "price", dir: "asc" });
        expect(header).toHaveAttribute("aria-sort", "ascending");
    });

    it("is descending when its column is sorted descending", () => {
        const { header } = renderHeader({ sortKey: "price", sort: "price", dir: "desc" });
        expect(header).toHaveAttribute("aria-sort", "descending");
    });

    it("is not sorted when another column is", () => {
        const { header } = renderHeader({ sortKey: "price", sort: "name", dir: "desc" });
        expect(header).toHaveAttribute("aria-sort", "none");
    });

    it("is a column header with a right-aligned numeric variant", () => {
        const { header } = renderHeader({ sortKey: "price", sort: "name", dir: "asc", numeric: true });
        expect(header).toHaveAttribute("scope", "col");
        expect(header).toHaveClass("num");
    });

    it("has no class for a text column", () => {
        const { header } = renderHeader({ sortKey: "price", sort: "name", dir: "asc" });
        expect(header).not.toHaveAttribute("class");
    });

    it("asks to sort by its key when its button is clicked", async () => {
        const user = userEvent.setup();
        const { onSort } = renderHeader({ sortKey: "price", sort: "name", dir: "asc" });
        await user.click(screen.getByRole("button", { name: "Prix" }));
        expect(onSort).toHaveBeenCalledTimes(1);
        expect(onSort).toHaveBeenCalledWith("price");
    });
});
