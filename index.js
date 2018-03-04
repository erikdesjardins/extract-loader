var vm = require('vm');
var path = require('path');
var loaderUtils = require('loader-utils');

var placeholder = '__EXTRICATE_LOADER_PLACEHOLDER_' + String(Math.random()).slice(2) + '__';

// Executes the given module's src in a fake context in order to get the resulting string.
function extricateLoader(content) {
    var callback = this.async();

    var query = loaderUtils.getOptions(this) || {};
    var nodeRequireRegex = query.resolve && new RegExp(query.resolve, 'i');

    var dependencies = [];
    // run root module, importing some resources synchronously with node require
    // and returning the placeholder for others
    var moduleWithPlaceholders = runScript(content, this.resourcePath, {
        require: function(resourcePath) {
            if (nodeRequireRegex && nodeRequireRegex.test(resourcePath)) {
                // evaluate the required file with node's require
                var absPath = path.resolve(path.dirname(this.resourcePath), resourcePath);
                return require(absPath);
            } else {
                // evaluate the required file with webpack's require, interpolate the result later
                dependencies.push(new Promise(function(resolve, reject) {
                    // load the module with webpack's internal module loader
                    this.loadModule(resourcePath, function(err, src) {
                        if (err) {
                            return reject(err);
                        }
                        try {
                            // run the imported module to get its (string) export
                            var result = runScript(src, resourcePath, {
                                __webpack_public_path__: this._compilation.options.output.publicPath || ''
                            });
                            resolve(result);
                        } catch (e) {
                            reject(e);
                        }
                    }.bind(this));
                }.bind(this)));

                return placeholder;
            }
        }.bind(this)
    });

    Promise.all(dependencies)
        .then(function(results) {
            // interpolate the results into the root module's placeholders
            return moduleWithPlaceholders.replace(new RegExp(placeholder, 'g'), function() {
                return results.shift();
            });
        })
        .then(function(content) {
            callback(null, content);
        }, function(err) {
            callback(err);
        });
}

// Executes the given CommonJS module in a fake context to get the exported string.
// The given module is expected to just return a string without requiring further modules.
function runScript(src, filename, context) {
    var script = new vm.Script(src, {
        filename: filename,
        displayErrors: true
    });

    var sandbox = Object.assign({
        module: {},
        exports: {},
    }, context);
    sandbox.module.exports = sandbox.exports;

    script.runInNewContext(sandbox);

    return sandbox.module.exports.toString();
}

module.exports = extricateLoader;
