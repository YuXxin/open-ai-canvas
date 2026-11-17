import { expect, test } from "bun:test";
import { renderToString } from "react-dom/server";

import { useMediaQuery } from "../src/hooks/use-media-query";
import { useFocusMode } from "../src/hooks/use-focus-mode";

test("media query and focus hooks render without browser globals", () => {
    function Probe() {
        const narrow = useMediaQuery("(width < 768px)");
        const { focusMode } = useFocusMode();
        return <output>{`${narrow}:${focusMode}`}</output>;
    }

    expect(renderToString(<Probe />)).toBe("<output>false:false</output>");
});
