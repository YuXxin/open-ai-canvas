import { Command, Home, Search, X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentType, type PointerEvent } from "react";
import { useNavigate } from "react-router";

import { navigationTools } from "@/constant/navigation-tools";
import { cn } from "@/lib/utils";
import { isComposingKeyEvent } from "@/lib/keyboard";
import { useUserStore } from "@/stores/use-user-store";
import "./workspace-command-palette.css";

type PaletteEntry = {
    id: string;
    title: string;
    icon: ComponentType<{ className?: string; strokeWidth?: number }>;
    to: string;
};

/** 顶栏搜索 / ⌘K 命令面板：按功能开关过滤当前可用页面入口。 */
export function WorkspaceCommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
    return open ? <WorkspaceCommandPaletteDialog onClose={onClose} /> : null;
}

function WorkspaceCommandPaletteDialog({ onClose }: { onClose: () => void }) {
    const navigate = useNavigate();
    const features = useUserStore((state) => state.features);
    const [query, setQuery] = useState("");
    const [highlight, setHighlight] = useState(0);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const outsidePointerRef = useRef<number | null>(null);
    const titleId = useId();
    const listId = useId();

    const entries = useMemo<PaletteEntry[]>(() => {
        const toolEntry = (slug: string, to: string): PaletteEntry => {
            const tool = navigationTools.find((item) => item.slug === slug);
            return { id: slug, title: tool?.label ?? slug, icon: tool?.icon ?? Home, to };
        };
        return [
            { id: "home", title: "首页", icon: Home, to: "/home" },
            toolEntry("create", "/create"),
            ...(features.shortDramaEnabled ? [toolEntry("projects", "/projects")] : []),
            toolEntry("canvas", "/canvas"),
            ...(features.taskCenterEnabled ? [toolEntry("tasks", "/tasks")] : []),
            toolEntry("assets", "/assets"),
            toolEntry("skills", "/skills"),
            ...(features.creditsEnabled ? [toolEntry("wallet", "/wallet")] : []),
            toolEntry("settings", "/settings"),
        ];
    }, [features]);

    const filtered = useMemo(() => {
        const keyword = query.trim().toLowerCase();
        if (!keyword) return entries;
        return entries.filter((entry) => entry.title.toLowerCase().includes(keyword));
    }, [entries, query]);
    const activeIndex = Math.min(highlight, Math.max(filtered.length - 1, 0));

    useLayoutEffect(() => {
        const dialog = dialogRef.current;
        dialog?.showModal();
        return () => dialog?.close();
    }, []);

    useEffect(() => {
        listRef.current?.querySelector<HTMLElement>("[aria-selected='true']")?.scrollIntoView({ block: "nearest" });
    }, [activeIndex, query]);

    const isOutside = (event: PointerEvent<HTMLDialogElement>) => {
        const rect = event.currentTarget.getBoundingClientRect();
        return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    };

    return (
        <dialog
            ref={dialogRef}
            closedby="any"
            aria-labelledby={titleId}
            data-canvas-no-zoom
            className="workspace-command-palette rounded-[var(--r-xl)] border border-[var(--workspace-border)] bg-[var(--workspace-surface-strong)] text-foreground shadow-[var(--elevation-overlay)]"
            onClose={(event) => {
                // A StrictMode effect replay may reopen before a queued close event.
                if (!event.currentTarget.open) onClose();
            }}
            onPointerDown={(event) => {
                if (!("closedBy" in event.currentTarget)) outsidePointerRef.current = isOutside(event) ? event.pointerId : null;
            }}
            onPointerUp={(event) => {
                const pointerId = outsidePointerRef.current;
                outsidePointerRef.current = null;
                if (pointerId === event.pointerId && isOutside(event)) event.currentTarget.close();
            }}
            onPointerCancel={() => {
                outsidePointerRef.current = null;
            }}
        >
            <h2 id={titleId} className="sr-only">
                搜索页面或操作
            </h2>
            <div className="p-3 pb-2">
                <div className="flex h-10 items-center gap-2 rounded-[var(--r-md)] border border-[var(--workspace-border)] bg-foreground/5 px-3 transition-colors hover:border-[var(--workspace-border-strong)] focus-within:border-[var(--workspace-border-strong)] focus-within:bg-foreground/[.06]">
                    <Search className="size-4 shrink-0 text-foreground/45" strokeWidth={1.6} />
                    <input
                        autoFocus
                        value={query}
                        onChange={(event) => {
                            setQuery(event.target.value);
                            setHighlight(0);
                        }}
                        onKeyDown={(event) => {
                            if (isComposingKeyEvent(event.nativeEvent)) return;
                            if (event.key === "ArrowDown") {
                                event.preventDefault();
                                setHighlight(Math.min(activeIndex + 1, Math.max(filtered.length - 1, 0)));
                            } else if (event.key === "ArrowUp") {
                                event.preventDefault();
                                setHighlight(Math.max(activeIndex - 1, 0));
                            } else if (event.key === "Enter" && filtered[activeIndex]) {
                                event.preventDefault();
                                dialogRef.current?.close();
                                navigate(filtered[activeIndex].to);
                            }
                        }}
                        role="combobox"
                        aria-label="搜索页面或操作"
                        aria-autocomplete="list"
                        aria-expanded="true"
                        aria-controls={listId}
                        aria-activedescendant={filtered[activeIndex] ? `${listId}-${filtered[activeIndex].id}` : undefined}
                        className="min-w-0 flex-1 bg-transparent text-[var(--fs-body)] outline-none placeholder:text-foreground/45"
                        placeholder="搜索页面或操作…"
                    />
                    <button
                        type="button"
                        onClick={() => dialogRef.current?.close()}
                        aria-label="关闭搜索（Ctrl+K 或 ⌘K）"
                        className="hidden h-5 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-[var(--workspace-border)] bg-background/60 px-1.5 font-mono text-[var(--fs-tiny)] font-medium text-foreground/60 transition-colors hover:bg-surface-hover hover:text-foreground sm:inline-flex"
                    >
                        <kbd aria-hidden="true">⌘K</kbd>
                    </button>
                    <button type="button" onClick={() => dialogRef.current?.close()} className="ml-0.5 shrink-0 rounded-md p-1 text-foreground/50 transition-colors hover:bg-surface-hover hover:text-foreground" aria-label="关闭搜索">
                        <X className="size-4" strokeWidth={1.6} />
                    </button>
                </div>
            </div>

            <div className="workspace-command-palette-results overflow-y-auto overscroll-contain p-2">
                <ul ref={listRef} id={listId} role="listbox" aria-label="匹配的页面或操作" className="flex flex-col gap-0.5">
                    {filtered.map((entry, index) => {
                        const Icon = entry.icon;
                        return (
                            <li key={entry.id} role="none">
                                <button
                                    type="button"
                                    id={`${listId}-${entry.id}`}
                                    role="option"
                                    aria-selected={index === activeIndex}
                                    tabIndex={-1}
                                    onPointerDown={(event) => event.preventDefault()}
                                    onMouseEnter={() => setHighlight(index)}
                                    onClick={() => {
                                        dialogRef.current?.close();
                                        navigate(entry.to);
                                    }}
                                    className={cn("flex w-full items-center gap-2.5 rounded-[var(--r-sm)] px-3 py-2.5 text-left text-[var(--fs-body)] transition-colors", index === activeIndex ? "bg-surface-hover text-foreground" : "text-foreground/65")}
                                >
                                    <Icon className={cn("size-4 shrink-0", index === activeIndex ? "text-foreground" : "text-foreground/55")} strokeWidth={1.6} />
                                    <span className="truncate">{entry.title}</span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
                {!filtered.length && (
                    <div role="status" className="flex flex-col items-center justify-center py-8">
                        <Command className="mb-2 size-6 text-foreground/30" strokeWidth={1.5} />
                        <p className="text-[var(--fs-caption)] font-medium text-foreground/55">未找到「{query}」相关页面</p>
                    </div>
                )}
            </div>
        </dialog>
    );
}
