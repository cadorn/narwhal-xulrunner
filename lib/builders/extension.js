

function dump(obj) { print(require('test/jsdump').jsDump.parse(obj)) };

var BUILDER = require("builder/program", "http://registry.pinf.org/cadorn.org/github/pinf/packages/common/");
var FILE = require("file");
var OS = require("os");
var UTIL = require("util");
var JSON = require("json");


var ProgramBuilder = exports.ProgramBuilder = function() {
    if (!(this instanceof exports.ProgramBuilder))
        return new exports.ProgramBuilder();
}

ProgramBuilder.prototype = BUILDER.ProgramBuilder();

ProgramBuilder.prototype.build = function(options) {

    var rawPath = this.rawPackage.getPath(),
        buildPath = this.targetPackage.getPath(),
        program = this.sourcePackage,
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
        buildPath,
        [
            "chrome.manifest",
            "install.rdf",
            "components"
        ]
    );

    // update version in install.rdf
    sourcePath = buildPath.join("install.rdf");
    var installRDF = sourcePath.read();
    installRDF = installRDF.replace(/<em:version>([^<]*)<\/em:version>/, "<em:version>" + descriptor.version + "</em:version>");
    sourcePath.write(installRDF);

    // link content
    sourcePath = programPath.join("content");
    targetPath = buildPath.join("content");
    targetPath.mkdirs();
    sourcePath.listPaths().forEach(function(path) {
        path.symlink(targetPath.join(path.basename()));
    });

    // link narwhal
    sourcePath = rawPath.join("using", program.getDescriptor().getUsingLocatorForName("narwhal").getTopLevelId());
    targetPath = buildPath.join("content", "narwhal");
    [
        "narwhal.js",
        "package.json",
        "lib",
        "engines/default"
    ].forEach(function(path) {
        targetPath.join(path).dirname().mkdirs();
        sourcePath.join(path).symlink(targetPath.join(path));
    });

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
            // TODO: Refactor to not use rsync
            OS.command([
                'rsync -rv',
                itemFilter,
                sourcePath.join(item),
                targetPath.join(item).dirname()
            ].join(" "));
        });
    }
}