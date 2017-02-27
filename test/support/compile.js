import webpack from "webpack";
import path from "path";

export default function ({ testModule, publicPath }) {
    return new Promise((resolve, reject) => {
        webpack({
            entry: path.join(__dirname, "../modules", testModule),
            bail: true, // report build errors to our test
            output: {
                path: path.join(__dirname, "../dist"),
                filename: "bundle.js",
                publicPath
            },
            module: {
                rules: [
                    {
                        test: /\.entry\.js$/,
                        use: [
                            { loader: "file-loader", options: { name: "[name]-dist.[ext]" } }
                        ]
                    },
                    {
                        test: /\.js$/,
                        use: [
                            // appending -dist so we can check if url rewriting is working
                            { loader: "file-loader", options: { name: "[name]-dist.[ext]" } },
                            { loader: path.join(__dirname, "../../lib/extractLoader.js") },
                        ]
                    },
                    {
                        test: /\.html$/,
                        use: [
                            { loader: "file-loader", options: { name: "[name]-dist.[ext]" } },
                            { loader: path.join(__dirname, "../../lib/extractLoader.js"), options: {
                                // nonsense that should never match, ensures that merely the existence of regex
                                // is not enough to cause the usage of Node's native `require()`
                                resolve: "$^foobar^$"
                            } },
                            { loader: "html-loader", options: { attrs: ["img:src", "link:href", "script:src"] } }
                        ]
                    },
                    {
                        test: /\.css$/,
                        use: [
                            { loader: "file-loader", options: { name: "[name]-dist.[ext]" } },
                            { loader: path.join(__dirname, "../../lib/extractLoader.js"), options: {
                                resolve: "\\.js$"
                            } },
                            { loader: "css-loader" }
                        ]
                    },
                    {
                        test: /\.jpg$/,
                        use: [
                            { loader: "file-loader", options: { name: "[name]-dist.[ext]" } }
                        ]
                    }
                ]
            }
        }, (err, stats) => {
            err ? reject(err) : resolve(stats);
        });
    });
}
