import { useCallback, useEffect, useRef } from "react";

/** Returns a stable function that calls the latest `fn` once `ms` have passed without a new call. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const latest = useRef(fn);

    useEffect(() => {
        latest.current = fn;
    });
    useEffect(() => () => clearTimeout(timer.current), []);

    return useCallback(
        (...args: A) => {
            clearTimeout(timer.current);
            timer.current = setTimeout(() => latest.current(...args), ms);
        },
        [ms],
    );
}
