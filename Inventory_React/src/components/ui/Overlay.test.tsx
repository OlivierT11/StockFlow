import { act, fireEvent, render, screen, waitFor, waitForElementToBeRemoved } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Overlay } from "./Overlay";

type HarnessProps = {
    persistent?: boolean;
    drawer?: boolean;
    onClosed?: () => void;
    content?: (close: () => void) => ReactNode;
};

const defaultContent = (close: () => void) => (
    <div role="dialog" aria-label="Fenêtre">
        <button type="button">Premier</button>
        <input aria-label="Champ" />
        <button type="button" onClick={close}>Dernier</button>
        <button type="button" disabled>Désactivé</button>
    </div>
);

/** A button that opens an Overlay, which unmounts once onClose is called. */
function Harness({ persistent, drawer, onClosed, content = defaultContent }: HarnessProps) {
    const [open, setOpen] = useState(false);
    return (
        <>
            <button type="button" onClick={() => setOpen(true)}>Ouvrir</button>
            <button type="button">Ailleurs</button>
            {open && (
                <Overlay
                    persistent={persistent}
                    drawer={drawer}
                    onClose={() => {
                        setOpen(false);
                        onClosed?.();
                    }}
                >
                    {content}
                </Overlay>
            )}
        </>
    );
}

async function open(props: HarnessProps = {}) {
    const user = userEvent.setup();
    const onClosed = vi.fn();
    render(<Harness onClosed={onClosed} {...props} />);
    await user.click(screen.getByRole("button", { name: "Ouvrir" }));
    const scrim = screen.getByRole("presentation");
    return { user, onClosed, scrim };
}

/** Opens the default dialog and waits for the focus to move into it (Escape is handled by the overlay). */
async function openFocused(props: HarnessProps = {}) {
    const opened = await open(props);
    await waitFor(() => expect(screen.getByRole("button", { name: "Premier" })).toHaveFocus());
    return opened;
}

describe("Overlay", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("moves the focus into the dialog", async () => {
        await open();
        expect(screen.getByRole("button", { name: "Ouvrir" })).toHaveFocus();
        await waitFor(() => expect(screen.getByRole("button", { name: "Premier" })).toHaveFocus());
    });

    it("keeps the focus on an element of the dialog that already has it", async () => {
        await open({
            content: () => (
                <div role="dialog" aria-label="Fenêtre">
                    <button type="button">Premier</button>
                    <input aria-label="Champ" autoFocus />
                </div>
            ),
        });
        const input = screen.getByRole("textbox", { name: "Champ" });
        expect(input).toHaveFocus();
        // Let the 60 ms focus timer run: it must not move the focus to the first button.
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(input).toHaveFocus();
    });

    it("leaves the focus alone when the dialog has nothing focusable", async () => {
        await open({ content: () => <div role="dialog" aria-label="Fenêtre"><p>Rien à faire</p></div> });
        const opener = screen.getByRole("button", { name: "Ouvrir" });
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(opener).toHaveFocus();
    });

    it("wraps Tab from the last enabled element to the first", async () => {
        const { user } = await openFocused();
        const first = screen.getByRole("button", { name: "Premier" });

        await user.tab();
        expect(screen.getByRole("textbox", { name: "Champ" })).toHaveFocus();
        await user.tab();
        expect(screen.getByRole("button", { name: "Dernier" })).toHaveFocus();
        await user.tab();
        expect(first).toHaveFocus();
    });

    it("wraps Shift+Tab from the first element to the last enabled one", async () => {
        // openFocused() leaves the focus on "Premier", the first element.
        const { user } = await openFocused();

        await user.tab({ shift: true });
        expect(screen.getByRole("button", { name: "Dernier" })).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByRole("textbox", { name: "Champ" })).toHaveFocus();
    });

    it("lets Tab through when there is nothing focusable to trap", async () => {
        const { user } = await open({ content: () => <div role="dialog" aria-label="Fenêtre"><p>Rien</p></div> });
        // tabindex="-1" makes the paragraph focusable by script only: the trap has no element to cycle through.
        const p = screen.getByText("Rien");
        p.tabIndex = -1;
        act(() => p.focus());
        const event = fireEvent.keyDown(p, { key: "Tab" });
        expect(event).toBe(true);
        await user.keyboard("{Escape}");
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
    });

    it("does not trap Tab for content without a dialog role", async () => {
        await open({ content: () => <button type="button">Seul</button> });
        const button = screen.getByRole("button", { name: "Seul" });
        act(() => button.focus());
        // Not prevented: the browser moves the focus as usual.
        expect(fireEvent.keyDown(button, { key: "Tab" })).toBe(true);
    });

    it("ignores other keys", async () => {
        const { onClosed } = await openFocused();
        const first = screen.getByRole("button", { name: "Premier" });
        expect(fireEvent.keyDown(first, { key: "Enter" })).toBe(true);
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(onClosed).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("closes on Escape", async () => {
        const { user, onClosed } = await openFocused();
        await user.keyboard("{Escape}");
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it("prevents the default action of Escape", async () => {
        await open();
        expect(fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" })).toBe(false);
    });

    it("closes on a mousedown on the scrim", async () => {
        const { user, onClosed, scrim } = await open();
        await user.click(scrim);
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it("stays open on a mousedown inside the dialog", async () => {
        const { user, onClosed } = await open();
        await user.click(screen.getByRole("dialog"));
        await user.click(screen.getByRole("textbox", { name: "Champ" }));
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(onClosed).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("stays open on a scrim mousedown when persistent, but still closes on Escape", async () => {
        const { user, onClosed, scrim } = await open({ persistent: true });
        await user.click(scrim);
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(onClosed).not.toHaveBeenCalled();
        expect(scrim).not.toHaveClass("is-closing");

        await user.keyboard("{Escape}");
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it("closes through the function given to its children", async () => {
        const { user, onClosed } = await open();
        await user.click(screen.getByRole("button", { name: "Dernier" }));
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(onClosed).toHaveBeenCalledTimes(1);
    });

    it("calls onClose only once the 160 ms closing animation is over", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        const onClosed = vi.fn();
        render(<Harness onClosed={onClosed} />);
        await user.click(screen.getByRole("button", { name: "Ouvrir" }));
        const scrim = screen.getByRole("presentation");

        // Synchronous from here: the fake clock only moves when told to.
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(scrim).toHaveClass("is-closing");
        act(() => vi.advanceTimersByTime(159));
        expect(onClosed).not.toHaveBeenCalled();
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        act(() => vi.advanceTimersByTime(1));
        expect(onClosed).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("plays the opening transition after two animation frames", async () => {
        const { scrim } = await open();
        expect(scrim).toHaveClass("overlay");
        await waitFor(() => expect(scrim).toHaveClass("is-open"));
        expect(scrim).not.toHaveClass("drawer-overlay");
    });

    it("keeps the closing state when the opening frames come late", async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true });
        const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
        render(<Harness />);
        await user.click(screen.getByRole("button", { name: "Ouvrir" }));
        const scrim = screen.getByRole("presentation");
        // Closed before the two frames of the opening transition have run.
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        act(() => vi.advanceTimersByTime(40));
        expect(scrim).toHaveClass("is-closing");
        expect(scrim).not.toHaveClass("is-open");
    });

    it("renders as a side drawer", async () => {
        const { scrim } = await open({ drawer: true });
        expect(scrim).toHaveClass("overlay", "drawer-overlay");
    });

    it("locks the page scroll while open and restores it after", async () => {
        const { user } = await openFocused();
        expect(document.body.style.overflow).toBe("hidden");
        await user.keyboard("{Escape}");
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        expect(document.body.style.overflow).toBe("");
    });

    it("gives the focus back to the element that opened it", async () => {
        const { user } = await openFocused();
        const opener = screen.getByRole("button", { name: "Ouvrir" });
        await user.keyboard("{Escape}");
        await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));
        // The focus is restored by the unmount cleanup, which React runs just after removing the DOM.
        await waitFor(() => expect(opener).toHaveFocus());
    });

    it("does not call onClose when unmounted during the closing animation", async () => {
        const onClose = vi.fn();
        const user = userEvent.setup();
        const { unmount } = render(<Overlay onClose={onClose}>{(close) => <div role="dialog" aria-label="Fenêtre"><button type="button" onClick={close}>Fermer</button></div>}</Overlay>);
        await user.click(screen.getByRole("button", { name: "Fermer" }));
        unmount();
        await new Promise((resolve) => setTimeout(resolve, 200));
        expect(onClose).not.toHaveBeenCalled();
        expect(document.body.style.overflow).toBe("");
    });
});
