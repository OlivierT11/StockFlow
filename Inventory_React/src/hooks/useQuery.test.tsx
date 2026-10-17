import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataProvider } from "../context/DataContext";
import { useData } from "../context/data";
import { ApiError, productsApi } from "../lib/api";
import { signIn } from "../test/render";
import { useQuery } from "./useQuery";

type Call<T> = { signal: AbortSignal; resolve: (value: T) => void; reject: (error: unknown) => void };

/** A fetcher whose calls stay pending until the test resolves or rejects them. */
function controlledFetcher<T = string>() {
    const calls: Call<T>[] = [];
    const fetcher = vi.fn(
        (signal: AbortSignal) =>
            new Promise<T>((resolve, reject) => {
                calls.push({ signal, resolve, reject });
            }),
    );
    return { fetcher, calls };
}

type Props<T> = { key: string; fetcher: (signal: AbortSignal) => Promise<T>; keepPrevious?: boolean; enabled?: boolean };

const wrapper = ({ children }: { children: ReactNode }) => <DataProvider>{children}</DataProvider>;

/** useQuery next to useData (for invalidate), with props that can change on rerender. */
function renderQuery<T>(initialProps: Props<T>) {
    return renderHook(
        ({ key, fetcher, keepPrevious, enabled }: Props<T>) => ({ query: useQuery(key, fetcher, { keepPrevious, enabled }), data: useData() }),
        { initialProps, wrapper },
    );
}

describe("useQuery", () => {
    it("is loading until the first response, then holds the data", async () => {
        const { fetcher, calls } = controlledFetcher();
        const { result } = renderQuery({ key: "a", fetcher });

        expect(result.current.query).toMatchObject({ data: undefined, error: undefined, loading: true, refreshing: false });
        expect(fetcher).toHaveBeenCalledTimes(1);

        await act(async () => calls[0].resolve("A"));

        expect(result.current.query).toMatchObject({ data: "A", error: undefined, loading: false, refreshing: false });
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("exposes the error of a failed request", async () => {
        const { fetcher, calls } = controlledFetcher();
        const { result } = renderQuery({ key: "a", fetcher });
        const error = new ApiError(500, {});

        await act(async () => calls[0].reject(error));

        expect(result.current.query).toMatchObject({ data: undefined, error, loading: false, refreshing: false });
    });

    it("works with the API client", async () => {
        signIn("User");
        const { result } = renderHook(() => useQuery("product-1", (signal) => productsApi.get(1, signal)), { wrapper });
        await waitFor(() => expect(result.current.data?.name).toBe("Vis inox A2 M6 × 40"));

        const missing = renderHook(() => useQuery("product-999", (signal) => productsApi.get(999, signal)), { wrapper });
        await waitFor(() => expect(missing.result.current.error).toBeInstanceOf(ApiError));
        expect((missing.result.current.error as ApiError).status).toBe(404);
        expect(missing.result.current.loading).toBe(false);
    });

    describe("refetching", () => {
        it("reload() refetches, keeping the data on screen while flagged as refreshing", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].resolve("A"));

            act(() => result.current.query.reload());

            expect(fetcher).toHaveBeenCalledTimes(2);
            expect(result.current.query).toMatchObject({ data: "A", loading: false, refreshing: true });

            await act(async () => calls[1].resolve("A2"));

            expect(result.current.query).toMatchObject({ data: "A2", loading: false, refreshing: false });
        });

        it("refetches after a write invalidates the data", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].resolve("A"));

            act(() => result.current.data.invalidate());

            expect(fetcher).toHaveBeenCalledTimes(2);
            expect(result.current.query).toMatchObject({ data: "A", refreshing: true });

            await act(async () => calls[1].resolve("A2"));

            expect(result.current.query).toMatchObject({ data: "A2", refreshing: false });
        });

        it("keeps the data and shows the error when a refetch fails", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].resolve("A"));
            const error = new ApiError(0, { message: "Network error" });

            act(() => result.current.query.reload());
            await act(async () => calls[1].reject(error));

            expect(result.current.query).toMatchObject({ data: "A", error, loading: false, refreshing: false });
        });

        it("clears the error once a reload succeeds", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].reject(new ApiError(503, {})));

            act(() => result.current.query.reload());
            expect(result.current.query).toMatchObject({ data: undefined, loading: false, refreshing: false });
            expect(result.current.query.error).toBeInstanceOf(ApiError);

            await act(async () => calls[1].resolve("A"));

            expect(result.current.query).toMatchObject({ data: "A", error: undefined, loading: false });
        });
    });

    describe("key changes", () => {
        it("shows the loading state for a new key, without the previous key's data", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result, rerender } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].resolve("A"));

            rerender({ key: "b", fetcher });

            expect(fetcher).toHaveBeenCalledTimes(2);
            expect(result.current.query).toMatchObject({ data: undefined, error: undefined, loading: true, refreshing: false });

            await act(async () => calls[1].resolve("B"));

            expect(result.current.query).toMatchObject({ data: "B", loading: false });
        });

        it("keeps the previous key's data on screen with keepPrevious", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result, rerender } = renderQuery({ key: "page-1", fetcher, keepPrevious: true });
            await act(async () => calls[0].resolve("page 1"));

            rerender({ key: "page-2", fetcher, keepPrevious: true });

            expect(result.current.query).toMatchObject({ data: "page 1", loading: false, refreshing: true });

            await act(async () => calls[1].resolve("page 2"));

            expect(result.current.query).toMatchObject({ data: "page 2", loading: false, refreshing: false });
        });

        it("does not report the previous key's error", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result, rerender } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].reject(new ApiError(404, {})));

            rerender({ key: "b", fetcher });

            expect(result.current.query).toMatchObject({ data: undefined, error: undefined, loading: true });
        });

        it("does not show the previous key's data when the new key fails", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result, rerender } = renderQuery({ key: "product-1", fetcher });
            await act(async () => calls[0].resolve("produit 1"));
            const error = new ApiError(500, {});

            rerender({ key: "product-2", fetcher });
            await act(async () => calls[1].reject(error));

            expect(result.current.query.error).toBe(error);
            expect(result.current.query.data).toBeUndefined();
        });
    });

    describe("enabled", () => {
        it("does not fetch while disabled, then fetches once enabled", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result, rerender } = renderQuery({ key: "a", fetcher, enabled: false });

            expect(fetcher).not.toHaveBeenCalled();
            expect(result.current.query).toMatchObject({ data: undefined, error: undefined, refreshing: false });

            rerender({ key: "a", fetcher, enabled: true });
            expect(fetcher).toHaveBeenCalledTimes(1);
            await act(async () => calls[0].resolve("A"));

            expect(result.current.query.data).toBe("A");
        });

        it("ignores reloads and writes while disabled, keeping the data it has", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result, rerender } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].resolve("A"));

            rerender({ key: "a", fetcher, enabled: false });
            act(() => result.current.data.invalidate());
            act(() => result.current.query.reload());

            expect(fetcher).toHaveBeenCalledTimes(1);
            expect(result.current.query).toMatchObject({ data: "A", loading: false, refreshing: false });
        });
    });

    describe("cancellation", () => {
        it("aborts the request on unmount", () => {
            const { fetcher, calls } = controlledFetcher();
            const { unmount } = renderQuery({ key: "a", fetcher });

            expect(calls[0].signal.aborted).toBe(false);
            unmount();
            expect(calls[0].signal.aborted).toBe(true);
        });

        it("aborts the previous request when the key changes", () => {
            const { fetcher, calls } = controlledFetcher();
            const { rerender } = renderQuery({ key: "a", fetcher });

            rerender({ key: "b", fetcher });

            expect(calls[0].signal.aborted).toBe(true);
            expect(calls[1].signal.aborted).toBe(false);
        });

        it("ignores the failure of a request it aborted", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result } = renderQuery({ key: "a", fetcher });
            await act(async () => calls[0].resolve("A"));

            act(() => result.current.query.reload());
            act(() => result.current.query.reload());
            expect(calls[1].signal.aborted).toBe(true);
            await act(async () => calls[1].reject(new ApiError(0, { message: "Network error" })));

            expect(result.current.query.error).toBeUndefined();

            await act(async () => calls[2].resolve("A3"));

            expect(result.current.query).toMatchObject({ data: "A3", error: undefined, refreshing: false });
        });

        it("ignores an AbortError", async () => {
            const { fetcher, calls } = controlledFetcher();
            const { result } = renderQuery({ key: "a", fetcher });

            await act(async () => calls[0].reject(new DOMException("The operation was aborted.", "AbortError")));

            expect(result.current.query).toMatchObject({ data: undefined, error: undefined, loading: true });
        });
    });
});
