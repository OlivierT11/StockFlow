import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebouncedCallback } from "./useDebouncedCallback";

describe("useDebouncedCallback", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    function renderDebounced(fn: (value: string) => void, ms = 300) {
        return renderHook(({ fn, ms }) => useDebouncedCallback(fn, ms), { initialProps: { fn, ms } });
    }

    it("calls the function once, with the last arguments, after the delay", () => {
        const fn = vi.fn();
        const { result } = renderDebounced(fn);

        act(() => {
            result.current("v");
            result.current("vi");
            result.current("vis");
        });
        act(() => vi.advanceTimersByTime(299));
        expect(fn).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(1));
        expect(fn).toHaveBeenCalledTimes(1);
        expect(fn).toHaveBeenCalledWith("vis");
    });

    it("restarts the delay on every call", () => {
        const fn = vi.fn();
        const { result } = renderDebounced(fn);

        act(() => result.current("a"));
        act(() => vi.advanceTimersByTime(200));
        act(() => result.current("ab"));
        act(() => vi.advanceTimersByTime(200));
        expect(fn).not.toHaveBeenCalled();

        act(() => vi.advanceTimersByTime(100));
        expect(fn).toHaveBeenCalledExactlyOnceWith("ab");
    });

    it("calls again for calls made after the previous one fired", () => {
        const fn = vi.fn();
        const { result } = renderDebounced(fn);

        act(() => result.current("a"));
        act(() => vi.advanceTimersByTime(300));
        act(() => result.current("b"));
        act(() => vi.advanceTimersByTime(300));

        expect(fn.mock.calls).toEqual([["a"], ["b"]]);
    });

    it("returns the same function across renders and calls the latest one given", () => {
        const first = vi.fn();
        const latest = vi.fn();
        const { result, rerender } = renderDebounced(first);
        const debounced = result.current;

        act(() => result.current("vis"));
        rerender({ fn: latest, ms: 300 });
        expect(result.current).toBe(debounced);
        act(() => vi.advanceTimersByTime(300));

        expect(first).not.toHaveBeenCalled();
        expect(latest).toHaveBeenCalledExactlyOnceWith("vis");
    });

    it("uses the new delay when it changes", () => {
        const fn = vi.fn();
        const { result, rerender } = renderDebounced(fn, 300);

        rerender({ fn, ms: 1000 });
        act(() => result.current("vis"));
        act(() => vi.advanceTimersByTime(999));
        expect(fn).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it("drops the pending call on cancel(), and still debounces later calls", () => {
        const fn = vi.fn();
        const { result } = renderDebounced(fn);

        act(() => result.current("vis"));
        act(() => result.current.cancel());
        act(() => vi.advanceTimersByTime(1000));
        expect(fn).not.toHaveBeenCalled();

        act(() => result.current("ecrou"));
        act(() => vi.advanceTimersByTime(300));
        expect(fn).toHaveBeenCalledExactlyOnceWith("ecrou");
    });

    it("drops the pending call on unmount", () => {
        const fn = vi.fn();
        const { result, unmount } = renderDebounced(fn);

        act(() => result.current("vis"));
        unmount();
        vi.advanceTimersByTime(1000);

        expect(fn).not.toHaveBeenCalled();
    });
});
