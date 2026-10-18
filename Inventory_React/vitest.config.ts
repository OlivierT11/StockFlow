import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

// Dates are shown in local time: pin the zone so expected strings do not depend on the machine.
process.env.TZ = "Europe/Paris";

export default mergeConfig(
    viteConfig,
    defineConfig({
        test: {
            environment: "jsdom",
            setupFiles: ["./src/test/setup.ts"],
            // Base URL of the fake API served by MSW (src/test/handlers.ts).
            env: { VITE_API_URL: "http://api.test" },
            restoreMocks: true,
            unstubGlobals: true,
            coverage: {
                provider: "v8",
                include: ["src/**/*.{ts,tsx}"],
                exclude: ["src/test/**", "src/**/*.test.{ts,tsx}", "src/main.tsx", "src/lib/types.ts", "src/components/iconSprite.ts"],
                reporter: ["text", "html", "lcov"],
                // Fails `npm run coverage` if a change leaves code untested.
                thresholds: { statements: 95, branches: 95, functions: 95, lines: 95 },
            },
        },
    }),
);
