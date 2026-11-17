import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium, type Page } from "playwright";

// Isolated UI fixture: no application server, account, backend or API keys.
const webDir = resolve(import.meta.dir, "..");
const bundle = await Bun.build({
    entrypoints: [resolve(webDir, "test/fixtures/modern-web.tsx")],
    target: "browser",
    define: { "process.env.NODE_ENV": JSON.stringify("development") },
    plugins: [
        {
            name: "fixture-user-features",
            setup(build) {
                build.onLoad({ filter: /[\\/]stores[\\/]use-user-store\.ts$/ }, () => ({
                    contents: "export const useUserStore = select => select({ features: { shortDramaEnabled: false, taskCenterEnabled: false, creditsEnabled: false } });",
                    loader: "js",
                }));
            },
        },
    ],
});
if (!bundle.success) throw new AggregateError(bundle.logs, "UI fixture failed to bundle");

const js = bundle.outputs.find((output) => output.path.endsWith(".js"))!;
const css = (await bundle.outputs.find((output) => output.path.endsWith(".css"))?.text()) ?? "";
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>
    :root { --space-8: 32px; --background: white; }
    .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    dialog { background: white; color: black; border: 1px solid gray; }
    dialog ul { list-style: none; padding: 0; margin: 0; }
    dialog [role=option] { display: block; width: 100%; min-height: 36px; text-align: left; }
    dialog svg { width: 16px; height: 16px; }
    ${css}
    </style><div id="root"></div><script type="module" src="/fixture.js"></script></html>`;
const server = Bun.serve({
    hostname: "127.0.0.1",
    port: 0,
    fetch(request) {
        return new URL(request.url).pathname === "/fixture.js" ? new Response(js, { headers: { "Content-Type": "text/javascript" } }) : new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    },
});

const browser = await chromium.launch({ headless: true }).catch((error) => {
    server.stop(true);
    throw error;
});
let passed = 0;
const errors: string[] = [];
function pass(name: string) {
    passed++;
    console.log(`PASS ${name}`);
}
async function openPalette(page: Page) {
    await page.locator("[data-open]").click();
    await page.waitForFunction(() => document.querySelector("dialog")?.matches(":modal") && document.activeElement?.getAttribute("role") === "combobox");
    // Wait past StrictMode's effect replay and queued native close events.
    await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
    assert.equal(await page.locator("dialog:modal").count(), 1);
}
async function closed(page: Page) {
    await page.waitForFunction(() => !document.querySelector("dialog"));
}

try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
        const state = window as typeof window & { mediaListeners: number };
        state.mediaListeners = 0;
        const add = MediaQueryList.prototype.addEventListener;
        const remove = MediaQueryList.prototype.removeEventListener;
        MediaQueryList.prototype.addEventListener = function (type, ...args) {
            if (type === "change") state.mediaListeners++;
            return add.call(this, type, ...args);
        };
        MediaQueryList.prototype.removeEventListener = function (type, ...args) {
            if (type === "change") state.mediaListeners--;
            return remove.call(this, type, ...args);
        };
    });
    await page.goto(server.url.href);
    await page.locator("[data-open]").waitFor();
    assert.equal(await page.locator("[data-focus]").textContent(), "false");

    await openPalette(page);
    assert.equal(await page.locator("[role=option]").count(), 6);
    const input = page.locator("[role=combobox]");
    const firstActive = await input.getAttribute("aria-activedescendant");
    for (const event of [
        { key: "Enter", keyCode: 13, isComposing: true },
        { key: "Enter", keyCode: 229, isComposing: false },
        { key: "ArrowDown", keyCode: 40, isComposing: true },
    ]) {
        await input.dispatchEvent("keydown", event);
        assert.equal(await page.locator("dialog:modal").count(), 1);
        assert.equal(await page.locator("[data-path]").textContent(), "/");
        assert.equal(await input.getAttribute("aria-activedescendant"), firstActive);
    }
    pass("native modal opens in StrictMode, filters unavailable features and preserves IME confirmation");

    for (let i = 0; i < 6; i++) {
        await page.keyboard.press("Tab");
        assert.equal(await page.evaluate(() => document.activeElement === document.body || Boolean(document.activeElement?.closest("dialog"))), true);
    }
    await page.locator("[data-open]").evaluate((element: HTMLButtonElement) => element.focus());
    assert.equal(await page.locator("[data-open]").evaluate((element) => document.activeElement === element), false);
    await input.focus();
    await page.keyboard.press("Escape");
    await closed(page);
    assert.equal(await page.locator("[data-open]").evaluate((element) => document.activeElement === element), true);
    pass("native focus containment, Escape dismissal and focus restoration");

    await openPalette(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await closed(page);
    assert.equal(await page.locator("[data-path]").textContent(), "/create");
    await openPalette(page);
    await page.getByRole("button", { name: "关闭搜索", exact: true }).click();
    await closed(page);
    assert.equal(await page.locator("[data-path]").textContent(), "/create");
    pass("arrow navigation works and the close button does not execute a selected command");

    await openPalette(page);
    await page.mouse.click(2, 2);
    await closed(page);
    pass("native closedby light dismissal");

    // Exercise the fallback without claiming to emulate all Safari behavior.
    await page.evaluate(() => {
        delete (HTMLDialogElement.prototype as { closedBy?: string }).closedBy;
    });
    await openPalette(page);
    await page.locator("dialog").evaluate((element) => element.removeAttribute("closedby"));
    const rect = (await page.locator("dialog").boundingBox())!;
    await page.mouse.click(rect.x + 2, rect.y + 2);
    assert.equal(await page.locator("dialog:modal").count(), 1);
    await page.mouse.move(rect.x + 4, rect.y + 4);
    await page.mouse.down();
    await page.mouse.move(2, 2);
    await page.mouse.up();
    assert.equal(await page.locator("dialog:modal").count(), 1);
    await page.mouse.click(2, 2);
    await closed(page);
    pass("fallback ignores dialog padding and selection drags, closes on an outside press and release");

    for (const [width, narrow, focus] of [
        [767, true, true],
        [768, false, true],
        [1023, false, true],
        [1024, false, false],
    ] as const) {
        await page.setViewportSize({ width, height: 640 });
        await page.waitForFunction(({ narrow, focus }) => document.querySelector("[data-narrow]")?.textContent === String(narrow) && document.querySelector("[data-focus]")?.textContent === String(focus), { narrow, focus });
    }
    await page.locator("[data-toggle-focus]").click();
    for (const width of [500, 1280]) {
        await page.setViewportSize({ width, height: 640 });
        assert.equal(await page.locator("[data-focus]").textContent(), "true");
    }
    await page.reload();
    await page.waitForFunction(() => document.querySelector("[data-focus]")?.textContent === "true");
    await page.evaluate(() => localStorage.clear());
    await page.setViewportSize({ width: 360, height: 640 });
    await page.reload();
    await page.waitForFunction(() => document.querySelector("[data-focus]")?.textContent === "true");
    await page.setViewportSize({ width: 1280, height: 640 });
    await page.waitForFunction(() => document.querySelector("[data-focus]")?.textContent === "false");
    pass("exact media breakpoints, persisted choices and temporary narrow-screen focus mode");

    await page.locator("[data-unmount]").click();
    await page.waitForFunction(() => (window as typeof window & { mediaListeners: number }).mediaListeners === 0);
    await page.locator("[data-unmount]").click();
    await page.waitForFunction(() => (window as typeof window & { mediaListeners: number }).mediaListeners === 2);
    pass("media subscriptions clean up under StrictMode and remount");

    await page.setViewportSize({ width: 360, height: 640 });
    await openPalette(page);
    const smallRect = (await page.locator("dialog").boundingBox())!;
    assert.ok(smallRect.x >= 0 && smallRect.x + smallRect.width <= 360 && smallRect.y + smallRect.height <= 640);
    await input.fill("没有匹配的页面");
    assert.equal(await page.locator("dialog [role=status]").count(), 1);
    assert.equal(await input.getAttribute("aria-activedescendant"), null);
    await page.keyboard.press("Enter");
    assert.equal(await page.locator("dialog:modal").count(), 1);
    await page.keyboard.press("Escape");
    await closed(page);
    pass("narrow-screen modal bounds and accessible empty results");

    const restricted = await browser.newPage();
    restricted.on("pageerror", (error) => errors.push(error.message));
    await restricted.addInitScript(() => {
        Storage.prototype.getItem = () => {
            throw new DOMException("Storage blocked", "SecurityError");
        };
        Storage.prototype.setItem = () => {
            throw new DOMException("Storage blocked", "SecurityError");
        };
    });
    await restricted.goto(server.url.href);
    await restricted.locator("[data-toggle-focus]").click();
    assert.equal(await restricted.locator("[data-focus]").textContent(), "true");
    assert.deepEqual(errors, []);
    pass("blocked storage leaves focus controls usable without runtime errors");
    console.log(`${passed} browser checks passed.`);
} finally {
    await browser.close();
    await server.stop(true);
}
