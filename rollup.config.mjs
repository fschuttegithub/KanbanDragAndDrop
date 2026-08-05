import MagicString from "magic-string";

/**
 * Mendix's pluggable-widgets-tools runs Babel over the *bundled* output (see `getBabelOutputPlugin`
 * in configs/rollup.config.mjs). Babel hoists the helpers it generates to the top of the program,
 * which for the AMD bundle means *outside* the `define(...)` call:
 *
 *     const _excluded = ["initMapStateToProps", ...], _excluded2 = ["reactReduxForwardedRef"];
 *     function _objectWithoutProperties(...) { ... }
 *     define([...], function (...) { ... });
 *
 * The AMD file is loaded as a classic script, so those top-level `const`s land in the *shared*
 * global lexical scope. As soon as a second pluggable widget on the same page ships the same
 * Babel helper (anything bundling react-redux / @hello-pangea/dnd does), whichever script loads
 * second dies with "SyntaxError: Identifier '_excluded' has already been declared", its factory
 * never registers, and the Mendix loader reports `factoryThrew` / "Loading module ... failed!".
 * That is why the failure is page-dependent rather than constant.
 *
 * Wrapping the AMD chunk in an IIFE keeps the helpers function-scoped. `define()` is still called
 * synchronously while the script evaluates, so the dojo loader still attributes the module to this
 * script. The ESM output (.mjs) already has module scope and must not be wrapped.
 */
function scopeBabelHelpers() {
    return {
        name: "scope-babel-helpers",
        renderChunk(code) {
            const wrapped = new MagicString(code).prepend("(function(){").append("\n})();");

            return {
                code: wrapped.toString(),
                map: wrapped.generateMap({ hires: true })
            };
        }
    };
}

export default args => {
    const configs = args.configDefaultConfig;

    for (const config of configs) {
        for (const output of [config.output].flat()) {
            if (output?.format !== "amd") {
                continue;
            }

            output.plugins = [...(output.plugins ?? []), scopeBabelHelpers()];
        }
    }

    return configs;
};
