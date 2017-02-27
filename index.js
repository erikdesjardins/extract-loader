const vm = require("vm");
const path = require("path");
const loaderUtils = require("loader-utils");

const rndPlaceholder = "__EXTRICATE_LOADER_PLACEHOLDER_" + String(Math.random()).slice(2) + "__";

// Executes the given module's src in a fake context in order to get the resulting string.
function extricateLoader(content) {
    const callback = this.async();

    const query = loaderUtils.getOptions(this) || {};
    const nodeRequireRegex = query.resolve && new RegExp(query.resolve, "i");

    const dependencies = [];
    const rootModule = runScript(content, this.resourcePath, {
        require: (resourcePath) => {
            if (nodeRequireRegex && nodeRequireRegex.test(resourcePath)) {
                // evaluate the required file with node's require
                const absPath = path.resolve(path.dirname(this.resourcePath), resourcePath);
                return require(absPath);
            } else {
                // evaluate the required file with webpack's require, interpolate the result later
                dependencies.push(new Promise((resolve, reject) => {
                    this.loadModule(resourcePath, (err, src) => {
                        if (err) {
                            reject(err);
                        } else {
                            try {
                                const result = runScript(src, resourcePath, {
                                    __webpack_public_path__: this.options.output.publicPath || ''
                                });
                                resolve(result);
                            } catch (e) {
                                reject(e);
                            }
                        }
                    });
                }));
                return rndPlaceholder;
            }
        }
    });

    Promise.all(dependencies)
        .then(results => rootModule.replace(new RegExp(rndPlaceholder, "g"), () => results.shift()))
        .then(
            content => callback(null, content),
            err => callback(err)
        );
}

// Executes the given CommonJS module in a fake context to get the exported string.
// The given module is expected to just return a string without requiring further modules.
function runScript(src, filename, context) {
    const script = new vm.Script(src, {
        filename: filename,
        displayErrors: true
    });

    const sandbox = Object.assign({
        module: {},
        exports: {},
    }, context);
    sandbox.module.exports = sandbox.exports;

    script.runInNewContext(sandbox);

    return sandbox.module.exports.toString();
}

module.exports = extricateLoader;
