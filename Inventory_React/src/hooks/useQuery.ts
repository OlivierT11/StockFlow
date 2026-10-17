import { useEffect, useEffectEvent, useState } from "react";
import { isAbort } from "../lib/api";
import { useData } from "../context/data";

type QueryState<T> = {
    data?: T;
    dataKey?: string;
    error?: unknown;
    /** Identifies the request that produced data / error (key + write version + reload count). */
    requestId?: string;
};

export type QueryResult<T> = {
    data: T | undefined;
    error: unknown;
    /** First load (or a new key without keepPrevious): show a skeleton. */
    loading: boolean;
    /** Refetch with data already on screen: dim it. */
    refreshing: boolean;
    reload: () => void;
};

/**
 * Fetches when `key` changes, when reload() is called, and after any write (DataContext version).
 * With keepPrevious, the previous key's data stays visible while the next one loads (filters, pages).
 */
export function useQuery<T>(
    key: string,
    fetcher: (signal: AbortSignal) => Promise<T>,
    options: { keepPrevious?: boolean; enabled?: boolean } = {},
): QueryResult<T> {
    const { keepPrevious = false, enabled = true } = options;
    const { version } = useData();
    const [nonce, setNonce] = useState(0);
    const [state, setState] = useState<QueryState<T>>({});
    const run = useEffectEvent((signal: AbortSignal) => fetcher(signal));
    const requestId = `${key}#${version}#${nonce}`;

    useEffect(() => {
        if (!enabled) return;
        const controller = new AbortController();
        run(controller.signal).then(
            (data) => setState({ data, dataKey: key, requestId }),
            (error: unknown) => {
                if (isAbort(error) || controller.signal.aborted) return;
                setState((s) => ({ ...s, error, dataKey: key, requestId }));
            },
        );
        return () => controller.abort();
    }, [key, requestId, enabled]);

    const sameKey = state.dataKey === key;
    const data = sameKey || keepPrevious ? state.data : undefined;
    const error = sameKey ? state.error : undefined;
    return {
        data,
        error,
        loading: data === undefined && error === undefined,
        refreshing: enabled && state.requestId !== requestId && data !== undefined,
        reload: () => setNonce((n) => n + 1),
    };
}
