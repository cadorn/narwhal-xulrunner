

function dump(obj) { print(require('test/jsdump').jsDump.parse(obj)) };

var BUILDER = require("builder", "http://registry.pinf.org/cadorn.org/github/pinf/packages/common/");
var FILE = require("file");
var OS = require("os");
var UTIL = require("util");
var JSON = require("json");


var Builder = exports.Builder = function(pkg, options) {
    if (!(this instanceof exports.Builder))
        return new exports.Builder(pkg, options);
    this.construct(pkg, options);
}

Builder.prototype = BUILDER.Builder();



Builder.prototype.build = function(program, options) {

    var rawPath = program.getBuildPath().join("raw"),
        buildPath = program.getBuildPath().join("extension"),
        programPath = program.getPath(),
        filter = '--exclude ".git/" --exclude "/.DS_Store"',
        sourcePath,
        targetPath;

    buildPath.mkdirs();

    var version = program.getVersion();
    if(!version) {
        // if no version is supplied we date stamp the archive
        var time = new Date()
        version = [
            "0.0.0" + program.getLocator().getRevision(),
            (""+time.getFullYear()).substr(2,2),
            UTIL.padBegin(time.getMonth()+1, 2),
            UTIL.padBegin(time.getDate(), 2),
            UTIL.padBegin(time.getHours(), 2),
            UTIL.padBegin(time.getMinutes(), 2)
        ].join("");
    }

    // take package.json from raw directory (instead of program directory)
    rawPath.join("package.json").copy(buildPath.join("package.json"));

    sourcePath = rawPath.join("package.json");
    targetPath = buildPath.join("package.json");
    var descriptor = JSON.decode(sourcePath.read());
    descriptor.version = version;
    targetPath.write(JSON.encode(descriptor, null, "    "));


    // copy extension files
    copy(
        programPath,
        buildPath.join("content"),
        [
            "bootstrap.js",
            "embed.js",
            "sandbox.js"
        ]
    );
    copy(
        programPath,
        buildPath,
        [
            "chrome.manifest",
            "install.rdf",
            ["lib", {
                "exclude": [
                    "/lib/builders/"
                ]
            }],
            "components"
        ]
    );

    // copy narwhal
    copy(
        rawPath.join("using", program.getDescriptor().getUsingLocatorForName("narwhal").getTopLevelId()),
        buildPath.join("content", "narwhal"),
        [
            "narwhal.js",
            "package.json",
            "lib",
            "engines/default"
        ]
    );

    // copy jack
/*
    copy(
        rawPath.join("packages", "jack"),
        buildPath.join("narwhal", "packages", "jack"),
        [
            "package.json",
            "lib"
        ]
    );
*/
    
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