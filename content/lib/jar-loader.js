
/**
 * @author Christoph Dorn
 * 
 * NOTE: This module needs some major love
 * 
 * Objectives:
 *   
 *   * Intercept narwhal related paths (chrome://narwhal-xulrunner/...) to direct them to extension files
 *   * Transparently handle path juggling into jar files
 *   * Correct for windows paths
 *   
 * TODO:
 * 
 *   * The narwhal FILE module is going to undergo some changes. It will allow conversion to a URI and back without
 *     loosing data. Once this is working the logic below can be simplified a lot.
 *   * Need to get a clear idea of how the paths come in on unix and windows and how they need to be converted at minimum.
 *   
 */

function dump(msg)
{
//    Components.utils.reportError(msg);
}

var IO = require("./io").IO;
var UTIL = require("util");

var ENV = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
//const ResourceHandler = Cc['@mozilla.org/network/protocol;1?name=resource'].getService(Ci.nsIResProtocolHandler);
const IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
const ChromeRegistry = Cc['@mozilla.org/chrome/chrome-registry;1'].getService(Ci.nsIChromeRegistry)

const nsINarwhal_NARWHAL_URI = ENV.get("nsINarwhal_NARWHAL_URI");
const nsINarwhal_ENGINE_URI = ENV.get("nsINarwhal_ENGINE_URI");


var NarwhalUriPath = ChromeRegistry.convertChromeURL(IOService.newURI(nsINarwhal_NARWHAL_URI, null, null)).path;
var EngineUriPath = ChromeRegistry.convertChromeURL(IOService.newURI(nsINarwhal_ENGINE_URI, null, null)).path;
EngineUriPath = EngineUriPath.substr(0, EngineUriPath.length-21);

const isWindows = (/\bwindows\b/i.test(system.os) || /\bwinnt\b/i.test(system.os));

var jars = {};

exports.registerJar = function(matchPath, archiveFile, basePath) {
    
    basePath = basePath || "";
    if(basePath=="/") {
        basePath = "";
    } else
    if(basePath.substr(0,1)=="/") {
        basePath = basePath.substr(1);
    }
    basePath = trimTailingSlash(basePath);

    var file = Components.classes["@mozilla.org/file/local;1"].createInstance(Components.interfaces.nsILocalFile);
    file.initWithPath(archiveFile);

    var zipReader = Cc["@mozilla.org/libjar/zip-reader;1"].createInstance(Ci.nsIZipReader);
    zipReader.open(file);
    zipReader.test(null);

    var info = {
        "archiveFile": archiveFile,
        "basePath": basePath,
        "entries": {},
        "isDirectory": function(path) {
            if(path=="") return true;
            if(this.entries[path] && this.entries[path].dir) return true;
            return false;
        },
        "isFile": function(path) {
            if(this.entries[path] && !this.entries[path].dir) return true;
            return false;
        },
        "list": function(path) {
            var parts = path.split("/");
            var entryNames = [];
            UTIL.every(this.entries, function(item) {
                if(path) {
                    if(item[1].parts.length==parts.length+1 && 
                       item[1].parts.slice(0,parts.length).join("/")==path) {
                        entryNames.push(item[1].parts[item[1].parts.length-1]);
                    }
                } else {
                    if(item[1].parts.length==1) {
                        entryNames.push(item[1].parts[0]);
                    }
                }
            });
            return entryNames;       
        },
        "exists": function(path) {
            return (!!this.entries[path]);
        },
        "read": function(path) {
            return new IO(zipReader.getInputStream(path), null);
        },
        "mtime": function(path) {
            new Date(zipReader.getEntry(path).lastModifiedTime);
        }
    }

    entries = zipReader.findEntries(null);
    while (entries.hasMore()) {
        var entry = entries.getNext();
        var dir = (entry.substr(entry.length-1,1)=="/");
        if(dir) {
            entry = entry.substr(0, entry.length-1);
        }
        info.entries[entry] = {
            "parts": entry.split("/"),
            "dir": dir
        }
    }
    
//    zipReader.close();

    jars[matchPath] = info;
}

exports.mapPath = function(method, path) {
    path = fixPathUri(path);

dump("mapPath:path: "+path);
    
    // map chrome:// URIs to filesystem paths if resources are not jarred
    if(EngineUriPath && path.substr(0,nsINarwhal_ENGINE_URI.length)==nsINarwhal_ENGINE_URI) {
        if(isWindows) {
            path = path.replace(/\//g, "\\");
        }
dump("mapPath:EngineUriPath: "+EngineUriPath + "|<->|" + path.substr(nsINarwhal_ENGINE_URI.length));
        return {"path": EngineUriPath + path.substr(nsINarwhal_ENGINE_URI.length)};
    }
    if(NarwhalUriPath && path.substr(0,nsINarwhal_NARWHAL_URI.length)==nsINarwhal_NARWHAL_URI) {
        if(isWindows) {
            path = path.replace(/\//g, "\\");
        }
dump("mapPath:NarwhalUriPath: "+NarwhalUriPath + "|<->|" + path.substr(nsINarwhal_NARWHAL_URI.length));
        return {"path": NarwhalUriPath + path.substr(nsINarwhal_NARWHAL_URI.length)};
    }

    for( var dir in jars ) {
        if(path==jars[dir].archiveFile) {
            return false;
        }
        if(path==dir.replace(/\\/g, "/") || path.substr(0,dir.length+1)==dir.replace(/\\/g, "/")+"/") {
            var usingPath = path.substr(dir.length+1);

            // print for NYI methods
            if(method.substr(0,1)!="!") {
                print("MATCH["+method+"] " + usingPath);
            }

            return {
                "archive": jars[dir],
                "path": ((jars[dir].basePath)?jars[dir].basePath+"/":"") + usingPath
            }
        }
    }
    return false;
}


function fixPathUri(path) {
    path = path.replace(/\\/g, "/");
    if(!/^chrome:\/[^\/].*/.test(path)) {
        return path;
    }
    return "chrome://" + path.substr(8);
}

function trimTailingSlash(subject) {
    if(subject.substr(subject.length-1,1)!="/") {
        return subject;
    }
    return subject.substr(0, subject.length-1);
}


var match;

if(isWindows) {
    NarwhalUriPath = NarwhalUriPath.replace(/\//g, "\\").replace(/%20/g, " ");
    EngineUriPath = EngineUriPath.replace(/\//g, "\\").replace(/%20/g, " ");
}

if(match = NarwhalUriPath.match(/^jar:file:(\/\/|\\\\\\)(.*?\.jar)!(.*)$/)) {
    exports.registerJar(trimTailingSlash(nsINarwhal_NARWHAL_URI), match[2], match[3].replace(/\\/g, "/"));
    NarwhalUriPath = false;
} else {
//    NarwhalUriPath = NarwhalUriPath.substr((isWindows)?8:7);
    if(isWindows) {
        NarwhalUriPath = NarwhalUriPath.replace(/\//g, "\\");
    }
}
if(match = EngineUriPath.match(/^jar:file:(\/\/|\\\\\\)(.*?\.jar)!(.*)$/)) {
    exports.registerJar(trimTailingSlash(nsINarwhal_ENGINE_URI), match[2], match[3].replace(/\\/g, "/"));
    EngineUriPath = false;
} else {
//    EngineUriPath = EngineUriPath.substr((isWindows)?8:7);
    if(isWindows) {
        EngineUriPath = EngineUriPath.replace(/\//g, "\\");
    }
}

