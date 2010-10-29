

function dump(obj) { print(require('test/jsdump').jsDump.parse(obj)) };


var BUILDER = require("builder/program", "http://registry.pinf.org/cadorn.org/github/pinf/packages/common/");
var LOCATOR = require("package/locator", "http://registry.pinf.org/cadorn.org/github/pinf/packages/common/");
var PINF = require("pinf", "http://registry.pinf.org/cadorn.org/github/pinf/packages/common/");
var UTIL = require("util");
var OS = require("os");


var ProgramBuilder = exports.ProgramBuilder = function() {
    if (!(this instanceof exports.ProgramBuilder))
        return new exports.ProgramBuilder();
}

ProgramBuilder.prototype = BUILDER.ProgramBuilder();


ProgramBuilder.prototype.build = function(buildOptions) {

    var targetBasePath = this.targetPackage.getPath();

    this.buildSource(
        this.programPackage.getBuildPath().join("extension"),
        targetBasePath.join("source")
    );
/*    
    this.buildJarred(
        targetBasePath.join("source"),
        targetBasePath.join("jarred")
    );
*/    
    this.buildXpi(
        targetBasePath.join("source"),
        targetBasePath
    );
}

ProgramBuilder.prototype.buildSource = function(sourceBasePath, targetBasePath) {

    var command;

    // write exclusion file
    var exclusionFile = targetBasePath.dirname().join(".tmp_rsync-exclude~");
    exclusionFile.dirname().mkdirs();
    exclusionFile.write([
        ".DS_Store",
        ".git/",
        ".tmp_*",

        ""
    ].join("\n"));

    targetBasePath.mkdirs();
    command = "rsync -r --copy-links --exclude-from " + exclusionFile + " " + sourceBasePath + "/* " + targetBasePath;
    print(command);
    OS.command(command);

    exclusionFile.remove();
}


ProgramBuilder.prototype.buildJarred = function(sourceBasePath, targetBasePath) {

    targetBasePath.mkdirs();
    OS.command("cp -Rf " + sourceBasePath + "/* " + targetBasePath);

    // package jars
    packageJar(targetBasePath.join("content"));
    
    // use jarred manifest
    targetBasePath.join("chrome.jarred.manifest").rename("chrome.manifest");
}


ProgramBuilder.prototype.buildXpi = function(sourceBasePath, targetBasePath) {
    var targetPath = targetBasePath.join(this.getFileVersionPrefix() + "-" + "narwhal.xpi");
    OS.command("cd " + sourceBasePath + "; zip -r " + targetPath + " ./");
}




function packageJar(path) {
    if(!path.exists()) {
        throw "Directory not found! Cannot package jar for path: " + path;
    }
    var command = "cd " + path + "; zip -r " + path.valueOf() + ".jar ./";
    print(command);
    var result = OS.command(command);
    print(result);
    path.rmtree();
}
