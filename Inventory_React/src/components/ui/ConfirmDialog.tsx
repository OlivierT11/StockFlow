import { useCallback, useState, type PropsWithChildren } from "react";
import { Icon } from "../Icon";
import { Overlay } from "./Overlay";
import { ConfirmContext, type ConfirmOptions } from "./confirmContext";

function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onClose }: ConfirmOptions & { onClose: () => void }) {
    return (
        <Overlay onClose={onClose}>
            {(close) => (
                <div className="modal" role="dialog" aria-modal="true" aria-labelledby="dlg-title">
                    <div className="modal-head">
                        {danger && <span className="modal-icon danger"><Icon name="alert" /></span>}
                        <h2 id="dlg-title">{title}</h2>
                    </div>
                    <div className="modal-body">{body}</div>
                    <div className="modal-foot">
                        <button type="button" className="btn btn-secondary" onClick={close} autoFocus={danger}>
                            Annuler
                        </button>
                        <button
                            type="button"
                            className={`btn ${danger ? "btn-danger" : "btn-primary"}`}
                            autoFocus={!danger}
                            onClick={() => {
                                close();
                                onConfirm();
                            }}
                        >
                            {confirmLabel ?? "Confirmer"}
                        </button>
                    </div>
                </div>
            )}
        </Overlay>
    );
}

export function ConfirmProvider({ children }: PropsWithChildren) {
    const [current, setCurrent] = useState<(ConfirmOptions & { key: number }) | null>(null);
    const confirm = useCallback((options: ConfirmOptions) => setCurrent({ ...options, key: Date.now() }), []);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            {current && <ConfirmDialog {...current} key={current.key} onClose={() => setCurrent(null)} />}
        </ConfirmContext.Provider>
    );
}
