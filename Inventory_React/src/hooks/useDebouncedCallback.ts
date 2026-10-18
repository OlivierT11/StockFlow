import { useEffect, useMemo, useRef } from "react";

/**
 * Returns a stable function that calls the latest `fn` once `ms` have passed without a new call.
 * Its `cancel()` drops a call that has not run yet.
 */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const latest = useRef(fn);

    useEffect(() => {
        latest.current = fn;
    });
    useEffect(() => () => clearTimeout(timer.current), []);

    return useMemo(() => {
        const debounced = (...args: A) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => latest.current(...args), ms);
        };
        debounced.cancel = () => clearTimeout(timer.current);
        return debounced;
    }, [ms]);
}
