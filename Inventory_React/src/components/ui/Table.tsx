import { Icon } from "../Icon";
import type { SortDirection } from "../../lib/types";

type SortHeaderProps<K extends string> = {
    sortKey: K;
    label: string;
    sort: K;
    dir: SortDirection;
    numeric?: boolean;
    onSort: (key: K) => void;
};

export function SortHeader<K extends string>({ sortKey, label, sort, dir, numeric, onSort }: SortHeaderProps<K>) {
    const ariaSort = sort === sortKey ? (dir === "desc" ? "descending" : "ascending") : "none";
    return (
        <th className={numeric ? "num" : undefined} scope="col" aria-sort={ariaSort}>
            <button type="button" className="th-sort" onClick={() => onSort(sortKey)}>
                {label}
                <Icon name="arrow-up" />
            </button>
        </th>
    );
}
