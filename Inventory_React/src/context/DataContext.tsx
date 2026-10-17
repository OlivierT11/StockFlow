import { useCallback, useMemo, useState, type PropsWithChildren } from "react";
import { DataContext } from "./data";

export function DataProvider({ children }: PropsWithChildren) {
    const [version, setVersion] = useState(0);
    const invalidate = useCallback(() => setVersion((v) => v + 1), []);
    const value = useMemo(() => ({ version, invalidate }), [version, invalidate]);
    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
