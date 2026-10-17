import { createContext, useContext } from "react";

export type DataContextValue = {
    /** Bumped after every successful write; queries depend on it to refetch. */
    version: number;
    invalidate: () => void;
};

export const DataContext = createContext<DataContextValue | undefined>(undefined);

export function useData(): DataContextValue {
    const context = useContext(DataContext);
    if (!context) throw new Error("useData doit être utilisé dans un DataProvider");
    return context;
}
