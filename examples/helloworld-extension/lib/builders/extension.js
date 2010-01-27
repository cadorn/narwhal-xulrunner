

function dump(obj) { print(require('test/jsdump').jsDump.parse(obj)) };

var BUILDER = require("builder", "http://registry.pinf.org/cadorn.org/github/pinf/packages/common/");
var FILE = require("file");
var OS = require("os");
var UTIL = require("util");

var Builder = exports.Builder = function(pkg, options) {
    if (!(this instanceof exports.Builder))
        return new exports.Builder(pkg, options);
    this.construct(pkg, options);
}

Builder.prototype = BUILDER.Builder();



Builder.prototype.build = function(program, options) {

    var rawPath = options.path.join("raw"),
        buildPath = options.path.join("extension"),
        programPath = program.getPath(),
        filter = '--exclude ".git/" --exclude "/.DS_Store"';
    
    // copy extension files
    copy(
        programPath,
        buildPath,
        [
            "package.json",
            "chrome.manifest",
            "install.rdf",
            ["lib", {
                "exclude": [
                    "/lib/builders/"
                ]
            }]
        ]
    );

    // TODO: Add version to XPI filename
    var archivePath = buildPath.join( program.getName() + ".xpi");
    
    OS.command("cd " + buildPath + "; zip -r " + archivePath + " ./ ; mv " + archivePath + " ../");

    
    function copy(sourcePath, targetPath, items) {
        items.forEach(function(instructions) {
            var item = instructions,
                itemFilter = ""+filter;
            if(UTIL.isArrayLike(instructions)) {
                item = instructions[0];
                if(instructions[1].exclude) {
                    instructions[1].exclude.forEach(function(rule) {
                        itemFilter += ' --exclude "'+rule+'"';
                    });
                }
            }
            targetPath.join(item).dirname().mkdirs();
            OS.command([
                'rsync -rv',
                itemFilter,
                sourcePath.join(item),
                targetPath.join(item).dirname()
            ].join(" "));
        });
    }
}