import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterAll, afterEach, beforeAll } from "vitest";
import { db } from "./db";
import { server } from "./server";

// jsdom does not implement scrolling.
window.scrollTo = () => {};

beforeAll(() => server.listen({ onUnhandledFrame: "error" }));

afterEach(() => {
    cleanup();
    server.resetHandlers();
    db.reset();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
    document.title = "";
});

afterAll(() => server.close());
