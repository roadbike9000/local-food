import { describe, expect, it } from "vitest";
import { mergeIconProps } from "./icon-props";

// mergeIconProps is the shared prop-merge behind every icon in
// src/components/Icons.tsx (Story 8.1). Review round 1 found two latent
// bugs in the plain `{...baseProps} {...props}` spread it replaced: an
// explicit `undefined` caller prop could silently delete a base default,
// and icons had no intrinsic size. Both fixes are pure object logic,
// testable directly without rendering a component.
describe("mergeIconProps", () => {
  it("returns the shared defaults unchanged when called with no overrides", () => {
    const merged = mergeIconProps({});
    expect(merged.viewBox).toBe("0 0 24 24");
    expect(merged.fill).toBe("none");
    expect(merged.stroke).toBe("currentColor");
    expect(merged.strokeWidth).toBe(1.5);
    expect(merged.strokeLinecap).toBe("round");
    expect(merged.strokeLinejoin).toBe("round");
    expect(merged["aria-hidden"]).toBe("true");
  });

  it("defaults to a 1em intrinsic size so an icon used with no sizing className doesn't fall back to the browser's 300x150 replaced-element default", () => {
    const merged = mergeIconProps({});
    expect(merged.width).toBe("1em");
    expect(merged.height).toBe("1em");
  });

  it("lets a caller override a default with a real value", () => {
    const merged = mergeIconProps({ strokeWidth: 1.6, width: 16, height: 16 });
    expect(merged.strokeWidth).toBe(1.6);
    expect(merged.width).toBe(16);
    expect(merged.height).toBe(16);
  });

  it("does not let an explicit undefined caller prop delete a base default", () => {
    // Plain object-spread (`{...baseProps, ...props}`) would let this
    // `stroke: undefined` clobber the base default, since spread copies
    // undefined-valued keys too - this is the exact bug the function fixes.
    const merged = mergeIconProps({ stroke: undefined, "aria-hidden": undefined });
    expect(merged.stroke).toBe("currentColor");
    expect(merged["aria-hidden"]).toBe("true");
  });

  it("still applies a caller's explicit false-y-but-defined override", () => {
    const merged = mergeIconProps({ strokeWidth: 0 });
    expect(merged.strokeWidth).toBe(0);
  });
});
