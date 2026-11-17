import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router";

import { WorkspaceCommandPalette } from "../../src/components/layout/workspace-command-palette";
import { useFocusMode } from "../../src/hooks/use-focus-mode";
import { useMediaQuery } from "../../src/hooks/use-media-query";

function Fixture() {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(true);
    const { pathname } = useLocation();
    return (
        <>
            <button data-open onClick={() => setOpen(true)}>
                打开搜索
            </button>
            <output data-path>{pathname}</output>
            <button data-unmount onClick={() => setMounted((current) => !current)}>
                切换探针
            </button>
            {mounted && <MediaProbe />}
            <WorkspaceCommandPalette open={open} onClose={() => setOpen(false)} />
        </>
    );
}

function MediaProbe() {
    const narrow = useMediaQuery("(width < 768px)");
    const { focusMode, toggleFocusMode } = useFocusMode();
    return (
        <>
            <output data-narrow>{String(narrow)}</output>
            <output data-focus>{String(focusMode)}</output>
            <button data-toggle-focus onClick={toggleFocusMode}>
                切换专注
            </button>
        </>
    );
}

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <MemoryRouter>
            <Fixture />
        </MemoryRouter>
    </StrictMode>,
);
