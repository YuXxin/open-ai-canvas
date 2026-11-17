import { useCallback, useMemo, useSyncExternalStore } from "react";

const getServerSnapshot = () => false;

export function useMediaQuery(query: string): boolean {
    const media = useMemo(() => (typeof window === "undefined" ? null : window.matchMedia(query)), [query]);
    const subscribe = useCallback(
        (onChange: () => void) => {
            media?.addEventListener("change", onChange);
            return () => media?.removeEventListener("change", onChange);
        },
        [media],
    );
    const getSnapshot = useCallback(() => media?.matches ?? false, [media]);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
