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
    scope.EXPORTED_SYMBOLS = ["get", "create"];
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

    var sandboxes = {},
        globalEventListeners = [],
        allSandboxesReady = false;

    scope.get = function(options) {
        if(!options || !options.type || !options.id) {
            throw new Error("Invalid program argument!");
        }
        options.internalID = options.internalID || options.id;

        if(sandboxes[options.id]) {
            return sandboxes[options.id];
        }

        return scope.create(options);
    };

    /**
     * options = {
     *   "type": "extension",
     *   "id": "<SandboxID>",
     *   "internalID": "<ExtensionID>",
     *   "modules": {existing modules},
     *   "debug": true
     * }
     */
    scope.create = function(options) {
        if(!options || !options.type || !options.id) {
            throw new Error("Invalid program argument!");
        }
        options.internalID = options.internalID || options.id;
        options.modules = options.modules || {};
        options.debug = options.debug || false;
        try {
            // start with the program root path and locate all resources from there
            var programRootPath = FILE.Path(getPath(options, "/"));

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
            options.modules["system"] = system;
            if(!options.modules["jar-loader"]) {
                options.modules["jar-loader"] = JAR_LOADER        // prevents module from being re-loaded in the sandbox
            }
            var sandbox = Sandbox({
                "loader": loader,
                "system": system,
                "modules": options.modules,
                "debug": options.debug
            });

            system = sandbox.force("system");
            system.env["SEA"] = programRootPath.valueOf();
            system.sea = programRootPath.valueOf();
            sandbox("global");
            
            if(options.modules["packages"]) {
                // add existing package paths to the loader
                sandbox.paths.splice.apply(
                    sandbox.paths,
                    [0, sandbox.paths.length].concat(sandbox('packages').analysis.libPaths)
                );
                sandbox.loader.usingCatalog = sandbox('packages').usingCatalog;
                sandbox.loader.uidCatalog = sandbox('packages').uidCatalog;
            } else {
                // load packages from paths
                sandbox('packages').load([
                    programRootPath.valueOf(),          // application/extension packages
                    "chrome://narwhal-xulrunner/content/",
                    "chrome://narwhal-xulrunner/content/narwhal/"
                ]);
            }

            return sandboxes[options.id] = {
                "id": options.id,
                "internalID": options.internalID,
                "require": function(id, pkg) {
                    return sandbox(id, null, pkg);
                },
                "sea": programRootPath.valueOf(),
                "system": system,
                "modules": options.modules,
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
                        try {
                            globalEventListeners[i](event);
                        } catch(e) {
                            system.log.error(e);
                        }
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

    function getPath(options, path) {
        if(options.type=="extension") {
            var em = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
            return em.getInstallLocation(options.internalID).getItemFile(options.internalID, path).path;
        } else
        if(options.type=="application") {
            var ResourceHandler = Cc['@mozilla.org/network/protocol;1?name=resource'].getService(Ci.nsIResProtocolHandler);
            var IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
            var FileService = IOService.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);
            return FileService.getFileFromURLSpec(ResourceHandler.resolveURI(IOService.newURI("resource:"+path, null, null))).path;
        } else
        if(options.type=="package") {
            return path;
        }
    }
})(this);
