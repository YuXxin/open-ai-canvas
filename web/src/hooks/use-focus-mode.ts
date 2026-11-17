import { useCallback, useState } from "react";

import { useMediaQuery } from "@/hooks/use-media-query";

const FOCUS_MODE_KEY = "canvas-focus-mode-v2";

// 默认策略：小屏自动沉浸（不可在顶栏手动切换），宽屏由用户偏好决定。
// 自动沉浸不写入用户偏好；回到宽屏时恢复用户选择。
function readInitialPreference(): boolean {
    if (typeof window === "undefined") return false;
    try {
        return window.localStorage.getItem(FOCUS_MODE_KEY) === "true";
    } catch {
        return false;
    }
}

export function useFocusMode() {
    const [userPreference, setUserPreference] = useState<boolean>(readInitialPreference);
    const smallScreen = useMediaQuery("(width < 1024px)");

    const focusMode = smallScreen || userPreference;

    const persist = useCallback((next: boolean) => {
        setUserPreference(next);
        try {
            window.localStorage.setItem(FOCUS_MODE_KEY, String(next));
        } catch {
            // 忽略 localStorage 不可用场景，专注模式仍可在本次会话生效。
        }
    }, []);

    const enterFocusMode = useCallback(() => persist(true), [persist]);
    const exitFocusMode = useCallback(() => persist(false), [persist]);
    const toggleFocusMode = useCallback(() => persist(!(smallScreen || userPreference)), [persist, smallScreen, userPreference]);

    return {
        focusMode,
        enterFocusMode,
        exitFocusMode,
        toggleFocusMode,
    };
}
