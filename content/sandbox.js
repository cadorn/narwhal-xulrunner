/* Copyright (c) 2010 Christoph Dorn <christoph@christophdorn.com>
   See the file LICENSE for licensing information. */
/**
 * @example
 * var sandbox = {};
 * Components.utils.import('resource://narwhal-xulrunner/sandbox.js', sandbox);
 * var program = {"type": "extension", "id": "<extensionID>"};
 * sandbox.get(program).require("<module>");
 */
(function(scope) {
    var Cc = Components.classes;
    var Ci = Components.interfaces;
    scope.EXPORTED_SYMBOLS = ["get"];
    var narwhal = {};
    Components.utils.import("resource://narwhal-xulrunner/embed.js", narwhal);

    var UTIL = narwhal.require("util");
    var FILE = narwhal.require("file");
    var PACKAGES = narwhal.require("packages");
    var Sandbox = narwhal.require("sandbox").Sandbox;
    var LOADER = narwhal.require("loader");
    LOADER.reassignFileModule(FILE);
    var Loader = LOADER.Loader;
    var JAR_LOADER = narwhal.require("jar-loader");

dump("\nSANDBOX LOADED\n");

    var sandboxes = {},
        globalEventListeners = [],
        allSandboxesReady = false;
    scope.get = function(program, module) {
        if(!program || !program.type || !program.id) {
            throw new Error("Invalid program argument!");
        }
        var key = program.type + ":" + program.id;
        if(sandboxes[key]) {
            return sandboxes[key];
        }
        try {
            // start with the program root path and locate all resources from there
            var programRootPath = FILE.Path(getPath(program, "/"));

            if(programRootPath.join("using.jar").exists()) {
                JAR_LOADER.registerJar(
                    programRootPath.join("using").valueOf(),
                    programRootPath.join("using.jar").valueOf()
                );
            }
            if(programRootPath.join("packages.jar").exists()) {
                JAR_LOADER.registerJar(
                    programRootPath.join("packages").valueOf(),
                    programRootPath.join("packages.jar").valueOf()
                );
            }
            
            var system = UTIL.copy(narwhal.system);
            var loader = Loader({
                // construct own loader paths to ensure predictable environment
                "paths": [
                    "chrome://narwhal-xulrunner/content/lib",
                    "chrome://narwhal-xulrunner/content/narwhal/engines/default/lib",
                    "chrome://narwhal-xulrunner/content/narwhal/lib"
                ]
            });
            var sandbox = Sandbox({
                "loader": loader,
                "system": system,
                "modules": {
                    "system": system,
                    "jar-loader": JAR_LOADER        // prevents module from being re-loaded in the sandbox
                },
                "debug": false
            });

            system = sandbox.force("system");
            system.env["SEA"] = programRootPath.valueOf();
            system.sea = programRootPath.valueOf();
            sandbox("global");

            // load packages from paths
            sandbox('packages').load([
                programRootPath.valueOf(),          // application/extension packages
                "chrome://narwhal-xulrunner/content/",
                "chrome://narwhal-xulrunner/content/narwhal/"
            ]);

            return sandboxes[key] = {
                "require": function(id, pkg) {
                    return sandbox(id, null, pkg);
                },
                "system": system,
                "paths": sandbox.paths,
                "isReady": false,
                "ready": function() {
                    this.isReady = true;
                    checkIfAllReady();
                },
                "onGlobalEvent": function(callback) {
                    globalEventListeners.push(callback);
                },
                "dispatchGlobalEvent": function(event) {
                    if(!allSandboxesReady) {
                        throw new Error("Cannot dispatch global event before all sandboxes are ready!");
                    }
                    for( var i=0, s=globalEventListeners.length ; i<s ; i++ ) {
                        globalEventListeners[i](event);
                    }
                }
            }

        } catch(e) {
            narwhal.system.log.error(e);
        }
        return false;
    };
    
    function checkIfAllReady() {
        var allReady = true;
        for( var key in sandboxes ) {
            if(!sandboxes[key].isReady) {
                allReady = false;
                break;
            }
        }
        if(allReady) {
            allSandboxesReady = true;
            for( var key in sandboxes ) {
                if(sandboxes[key].onAllReady) {
                    sandboxes[key].onAllReady();
                }
            }
        }
    }

    function getPath(program, path) {
        if(program.type=="extension") {
            var em = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
            return em.getInstallLocation(program.id).getItemFile(program.id, path).path;
        } else
        if(program.type=="application") {
            var ResourceHandler = Cc['@mozilla.org/network/protocol;1?name=resource'].getService(Ci.nsIResProtocolHandler);
            var IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
            var FileService = IOService.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);
            return FileService.getFileFromURLSpec(ResourceHandler.resolveURI(IOService.newURI("resource:"+path, null, null))).path;
        } else
        if(program.type=="package") {
            return path;
        }
    }
})(this);
