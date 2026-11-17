import { expect, test } from "bun:test";

import { isComposingKeyEvent } from "../src/lib/keyboard";

test("IME confirmation is ignored even when Safari has already ended composition", () => {
    expect(isComposingKeyEvent({ isComposing: true, keyCode: 13 })).toBe(true);
    expect(isComposingKeyEvent({ isComposing: false, keyCode: 229 })).toBe(true);
    expect(isComposingKeyEvent({ isComposing: true, keyCode: 229 })).toBe(true);
});

test("ordinary Enter, navigation and Escape remain available outside composition", () => {
    for (const keyCode of [0, 13, 27, 38, 40]) {
        expect(isComposingKeyEvent({ isComposing: false, keyCode })).toBe(false);
    }
});
