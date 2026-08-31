"use strict";

// Story 8.1's `theme.extend.borderRadius` (tailwind.config.ts) defines a
// design-token radius scale under `rounded-storefront-*`, deliberately
// namespaced so it doesn't override Tailwind's own default `rounded-sm`/
// `rounded-md`/`rounded-lg`/`rounded-xl` scale (code review round 1: the
// original implementation used the bare names, which silently reskinned
// admin/dashboard pages sitewide). That namespacing removed the collision,
// but left a typo risk in the other direction: a later storefront-facing
// story typing the more natural `rounded-lg` instead of
// `rounded-storefront-lg` compiles clean and lints clean, rendering a
// plausible-but-wrong 8px radius instead of the canonical 18px, with
// nothing to catch it (code review round 2, deferred finding). This rule
// closes that gap for the files it's scoped to (see .eslintrc.json's
// overrides) - `rounded-full` is exempt since it's identical in both
// scales (9999px), so there's no wrong-value risk from using it bare.
const BARE_RADIUS_PATTERN = /(?:^|\s)(rounded(?:-(?:sm|md|lg|xl))?)(?=\s|$)/g;

function checkClassString(context, node, text) {
  if (typeof text !== "string") return;
  BARE_RADIUS_PATTERN.lastIndex = 0;
  let match;
  while ((match = BARE_RADIUS_PATTERN.exec(text)) !== null) {
    context.report({
      node,
      message:
        `Bare Tailwind class "${match[1]}" is ambiguous here - this codebase's ` +
        `design-token radius scale (tailwind.config.ts, DESIGN.md#Shapes) lives under ` +
        `"rounded-storefront-*", a separate scale from Tailwind's own default. Use the ` +
        `storefront-prefixed class if you want the design-token radius, or add an ` +
        `eslint-disable-next-line comment if Tailwind's own default radius is genuinely intended.`,
    });
  }
}

module.exports = {
  "storefront-radius-tokens": {
    meta: {
      type: "problem",
      docs: {
        description:
          "Disallow bare rounded/rounded-sm/rounded-md/rounded-lg/rounded-xl Tailwind " +
          "classes in storefront-facing files, since this codebase also defines a " +
          "same-shape-different-name rounded-storefront-* design-token scale that's easy " +
          "to mistype as the bare Tailwind default.",
      },
      schema: [],
    },
    create(context) {
      return {
        JSXAttribute(node) {
          if (node.name.type !== "JSXIdentifier" || node.name.name !== "className") {
            return;
          }
          const value = node.value;
          if (!value) return;

          if (value.type === "Literal" && typeof value.value === "string") {
            checkClassString(context, value, value.value);
            return;
          }

          if (
            value.type === "JSXExpressionContainer" &&
            value.expression.type === "TemplateLiteral"
          ) {
            for (const quasi of value.expression.quasis) {
              checkClassString(context, quasi, quasi.value.raw);
            }
          }
        },
      };
    },
  },
};
