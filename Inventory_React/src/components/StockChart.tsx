import { useRef, useState, type CSSProperties } from "react";
import { fmtDate, plural } from "../lib/format";

export type ChartDay = { date: Date; in: number; out: number };

const W = 640;
const H = 220;
const PAD_L = 28;
const PAD_R = 8;
const PAD_T = 12;
const PAD_B = 28;

const longDay = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const shortDay = (d: Date) => d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", "");

/** Grouped columns: number of In and Out movements per day (prototype: renderChart / mountChart). */
export function StockChart({ days, labelledBy }: { days: ChartDay[]; labelledBy: string }) {
    const chart = useRef<HTMLDivElement>(null);
    const [tip, setTip] = useState<{ i: number; style: CSSProperties } | null>(null);

    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;
    const max = Math.max(4, ...days.map((d) => Math.max(d.in, d.out)));
    const yMax = Math.ceil(max / 4) * 4; // four whole-number ticks
    const slotW = innerW / days.length;
    const barW = Math.min(24, (slotW - 16) / 2);
    const barGap = 2;
    const y = (v: number) => PAD_T + innerH - (v / yMax) * innerH;
    const ticks = [0, 1, 2, 3, 4].map((k) => (yMax / 4) * k);

    const bar = (x: number, v: number, cls: string) => {
        if (!v) return null;
        const h = y(0) - y(v);
        const r = Math.min(4, h);
        return (
            <path
                className={`bar ${cls}`}
                d={`M${x} ${y(0)} v${-(h - r)} a${r} ${r} 0 0 1 ${r} ${-r} h${barW - 2 * r} a${r} ${r} 0 0 1 ${r} ${r} v${h - r} z`}
            />
        );
    };

    function show(i: number, slot: SVGGElement) {
        const r = slot.getBoundingClientRect();
        const cr = chart.current?.getBoundingClientRect();
        if (!cr) return;
        const right = i < 4;
        setTip({
            i,
            style: {
                left: `${right ? r.right - cr.left + 4 : r.left - cr.left - 4}px`,
                top: "4px",
                transform: right ? "none" : "translateX(-100%)",
            },
        });
    }
    const hide = () => setTip(null);
    const tipDay = tip ? days[tip.i] : null;

    return (
        <div className="chart" ref={chart}>
            <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={labelledBy}>
                <g className="grid">
                    {ticks.map((v) => <line key={v} x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} />)}
                </g>
                <g className="axis">
                    {ticks.map((v) => (
                        <text key={v} x={PAD_L - 8} y={y(v) + 4} textAnchor="end">{v}</text>
                    ))}
                    {days.map((d, i) => (
                        <text key={i} x={PAD_L + slotW * i + slotW / 2} y={H - 8} textAnchor="middle">
                            {shortDay(d.date)} {d.date.getDate()}
                        </text>
                    ))}
                </g>
                {days.map((d, i) => {
                    const x0 = PAD_L + slotW * i + slotW / 2 - barW - barGap / 2;
                    return (
                        <g
                            key={i}
                            className="slot"
                            tabIndex={0}
                            aria-label={`${longDay(d.date)} : ${d.in} ${plural(d.in, "entrée")}, ${d.out} ${plural(d.out, "sortie")}`}
                            onPointerEnter={(e) => show(i, e.currentTarget)}
                            onPointerLeave={hide}
                            onFocus={(e) => show(i, e.currentTarget)}
                            onBlur={hide}
                        >
                            <rect className="hit" x={PAD_L + slotW * i} y={PAD_T} width={slotW} height={innerH} />
                            <rect className="focus-ring" x={PAD_L + slotW * i + 4} y={PAD_T} width={slotW - 8} height={innerH} rx={4} />
                            {bar(x0, d.in, "in")}
                            {bar(x0 + barW + barGap, d.out, "out")}
                        </g>
                    );
                })}
            </svg>
            <div className={`chart-tip${tipDay ? " is-visible" : ""}`} role="tooltip" aria-hidden={!tipDay} style={tip?.style}>
                {tipDay && (
                    <>
                        <span className="tip-date">{longDay(tipDay.date)}</span>
                        <span className="tip-row"><i className="key in" />Entrées<b>{tipDay.in}</b></span>
                        <span className="tip-row"><i className="key out" />Sorties<b>{tipDay.out}</b></span>
                    </>
                )}
            </div>
        </div>
    );
}

export function ChartTable({ days }: { days: ChartDay[] }) {
    return (
        <div className="table-wrap">
            <table className="table chart-table">
                <caption className="sr-only">Entrées et sorties par jour</caption>
                <thead>
                    <tr>
                        <th scope="col">Jour</th>
                        <th scope="col" className="num">Entrées</th>
                        <th scope="col" className="num">Sorties</th>
                    </tr>
                </thead>
                <tbody>
                    {days.map((d) => (
                        <tr key={d.date.getTime()}>
                            <td>{fmtDate(d.date)}</td>
                            <td className="num">{d.in}</td>
                            <td className="num">{d.out}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
