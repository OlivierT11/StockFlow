import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChartTable, StockChart, type ChartDay } from "./StockChart";

/** Seven days from Monday 12 October 2026, with the given In / Out counts. */
function week(counts: [number, number][]): ChartDay[] {
    return counts.map(([inCount, outCount], i) => ({ date: new Date(2026, 9, 12 + i), in: inCount, out: outCount }));
}

const DAYS = week([
    [2, 1],
    [0, 0],
    [3, 0],
    [0, 4],
    [1, 1],
    [0, 2],
    [5, 0],
]);

function renderChart(days = DAYS) {
    const user = userEvent.setup();
    const result = render(
        <>
            <h2 id="chart-title">Mouvements des 7 derniers jours</h2>
            <StockChart days={days} labelledBy="chart-title" />
        </>,
    );
    const tooltip = () => screen.getByRole("tooltip", { hidden: true });
    return { user, tooltip, ...result };
}

const yTicks = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('text[text-anchor="end"]')).map((t) => t.textContent);

const rect = (left: number, right: number) => ({ left, right, top: 0, bottom: 0, width: right - left, height: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect;

describe("StockChart", () => {
    it("is an image named by its heading", () => {
        renderChart();
        expect(screen.getByRole("img", { name: "Mouvements des 7 derniers jours" })).toBeInTheDocument();
    });

    it("describes every day for keyboard and screen reader users", () => {
        renderChart();
        expect(screen.getByLabelText("lundi 12 octobre : 2 entrées, 1 sortie")).toHaveAttribute("tabindex", "0");
        expect(screen.getByLabelText("mardi 13 octobre : 0 entrée, 0 sortie")).toBeInTheDocument();
        expect(screen.getByLabelText("jeudi 15 octobre : 0 entrée, 4 sorties")).toBeInTheDocument();
        expect(screen.getByLabelText("dimanche 18 octobre : 5 entrées, 0 sortie")).toBeInTheDocument();
    });

    it("labels the x axis with the short day name and the day of the month", () => {
        const { container } = renderChart();
        const labels = Array.from(container.querySelectorAll('text[text-anchor="middle"]')).map((t) => t.textContent);
        expect(labels).toEqual(["lun 12", "mar 13", "mer 14", "jeu 15", "ven 16", "sam 17", "dim 18"]);
    });

    it("draws one bar per non-zero count", () => {
        renderChart();
        const bars = (label: string) => ({
            in: screen.getByLabelText(label).querySelectorAll(".bar.in").length,
            out: screen.getByLabelText(label).querySelectorAll(".bar.out").length,
        });
        expect(bars("lundi 12 octobre : 2 entrées, 1 sortie")).toEqual({ in: 1, out: 1 });
        expect(bars("mardi 13 octobre : 0 entrée, 0 sortie")).toEqual({ in: 0, out: 0 });
        expect(bars("mercredi 14 octobre : 3 entrées, 0 sortie")).toEqual({ in: 1, out: 0 });
        expect(bars("jeudi 15 octobre : 0 entrée, 4 sorties")).toEqual({ in: 0, out: 1 });
    });

    it("draws taller bars for bigger counts", () => {
        const { container } = renderChart(week([[1, 4], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]));
        // Path: "M{x} {baseline} v{-(h - r)} …": the first relative move is the bar height minus its radius.
        const rise = (path: Element) => Number(/ v(-?[\d.]+)/.exec(path.getAttribute("d")!)![1]);
        const small = container.querySelector(".bar.in")!;
        const big = container.querySelector(".bar.out")!;
        expect(rise(big)).toBeLessThan(rise(small));
    });

    it.each([
        { name: "a quiet week", counts: [[0, 0], [1, 0], [0, 2], [0, 0], [0, 0], [0, 0], [0, 0]], ticks: ["0", "1", "2", "3", "4"] },
        { name: "a peak of 5", counts: [[5, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], ticks: ["0", "2", "4", "6", "8"] },
        { name: "a peak of 13", counts: [[0, 13], [3, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], ticks: ["0", "4", "8", "12", "16"] },
        { name: "a peak of 8", counts: [[8, 8], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], ticks: ["0", "2", "4", "6", "8"] },
    ] as { name: string; counts: [number, number][]; ticks: string[] }[])("uses five whole-number y ticks for $name", ({ counts, ticks }) => {
        const { container } = renderChart(week(counts));
        const values = yTicks(container);
        expect(values).toEqual(ticks);
        values.forEach((v) => expect(Number.isInteger(Number(v))).toBe(true));
    });

    it("hides the tooltip until a day is pointed at", () => {
        const { tooltip } = renderChart();
        expect(tooltip()).toHaveAttribute("aria-hidden", "true");
        expect(tooltip()).not.toHaveClass("is-visible");
        expect(tooltip()).toBeEmptyDOMElement();
    });

    it("shows the counts of the hovered day and hides them on leave", async () => {
        const { user, tooltip } = renderChart();
        const slot = screen.getByLabelText("lundi 12 octobre : 2 entrées, 1 sortie");

        await user.hover(slot);
        expect(tooltip()).toHaveAttribute("aria-hidden", "false");
        expect(tooltip()).toHaveClass("is-visible");
        expect(within(tooltip()).getByText("lundi 12 octobre")).toBeInTheDocument();
        expect(within(tooltip()).getByText("Entrées")).toHaveTextContent("Entrées2");
        expect(within(tooltip()).getByText("Sorties")).toHaveTextContent("Sorties1");

        await user.unhover(slot);
        expect(tooltip()).toHaveAttribute("aria-hidden", "true");
        expect(tooltip()).toBeEmptyDOMElement();
    });

    it("follows the pointer from one day to the next", async () => {
        const { user, tooltip } = renderChart();
        await user.hover(screen.getByLabelText("lundi 12 octobre : 2 entrées, 1 sortie"));
        await user.hover(screen.getByLabelText("jeudi 15 octobre : 0 entrée, 4 sorties"));
        expect(within(tooltip()).getByText("jeudi 15 octobre")).toBeInTheDocument();
        expect(within(tooltip()).getByText("Sorties")).toHaveTextContent("Sorties4");
    });

    it("shows the tooltip of the focused day and hides it on blur", async () => {
        const { user, tooltip } = renderChart();
        await user.tab();
        const first = screen.getByLabelText("lundi 12 octobre : 2 entrées, 1 sortie");
        expect(first).toHaveFocus();
        expect(within(tooltip()).getByText("lundi 12 octobre")).toBeInTheDocument();

        await user.tab();
        expect(within(tooltip()).getByText("mardi 13 octobre")).toBeInTheDocument();
        expect(within(tooltip()).getByText("Entrées")).toHaveTextContent("Entrées0");

        act(() => (document.activeElement as SVGElement).blur());
        expect(tooltip()).toHaveAttribute("aria-hidden", "true");
    });

    it("places the tooltip right of the first four days", async () => {
        const { user, tooltip, container } = renderChart();
        vi.spyOn(container.querySelector(".chart")!, "getBoundingClientRect").mockReturnValue(rect(10, 650));
        const slot = screen.getByLabelText("jeudi 15 octobre : 0 entrée, 4 sorties");
        vi.spyOn(slot, "getBoundingClientRect").mockReturnValue(rect(280, 370));

        await user.hover(slot);
        expect(tooltip()).toHaveStyle({ left: "364px", top: "4px", transform: "none" });
    });

    it("places the tooltip left of the last three days", async () => {
        const { user, tooltip, container } = renderChart();
        vi.spyOn(container.querySelector(".chart")!, "getBoundingClientRect").mockReturnValue(rect(10, 650));
        const slot = screen.getByLabelText("vendredi 16 octobre : 1 entrée, 1 sortie");
        vi.spyOn(slot, "getBoundingClientRect").mockReturnValue(rect(370, 460));

        await user.hover(slot);
        expect(tooltip()).toHaveStyle({ left: "356px", top: "4px", transform: "translateX(-100%)" });
    });
});

describe("ChartTable", () => {
    it("lists the In and Out counts per day", () => {
        render(<ChartTable days={DAYS.slice(0, 3)} />);
        const table = screen.getByRole("table", { name: "Entrées et sorties par jour" });
        expect(within(table).getAllByRole("columnheader").map((th) => th.textContent)).toEqual(["Jour", "Entrées", "Sorties"]);
        const rows = within(table)
            .getAllByRole("row")
            .slice(1)
            .map((row) => within(row).getAllByRole("cell").map((td) => td.textContent));
        expect(rows).toEqual([
            ["12/10/2026", "2", "1"],
            ["13/10/2026", "0", "0"],
            ["14/10/2026", "3", "0"],
        ]);
    });
});
