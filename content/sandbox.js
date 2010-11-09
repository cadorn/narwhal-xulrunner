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

    var APP_INFO = Components.classes["@mozilla.org/xre/app-info;1"].getService(Components.interfaces.nsIXULAppInfo);  
    var VERSION_COMPARE = Cc["@mozilla.org/xpcom/version-comparator;1"].getService(Ci.nsIVersionComparator);
    
    var isGecko2 = (VERSION_COMPARE.compare(APP_INFO.platformVersion, "2")>=0 || APP_INFO.platformVersion.substr(0,1)=="2")?true:false;
    if(isGecko2) {
        Components.utils.import("resource://gre/modules/AddonManager.jsm");
    }
    
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
        loadingSandboxes = {},
        globalEventListeners = [],
        allSandboxesReady = false;

    scope.get = function(options, callback) {
        if(!options || !options.type || !options.id) {
            throw new Error("Invalid program argument!");
        }
        options.internalID = options.internalID || options.id;

        dump("[narwhal][sandbox::get] options.internalID: " + options.internalID + "\n");

        if(sandboxes[options.id]) {
            if(callback) {
                return callback(sandboxes[options.id]);
            } else {
                return sandboxes[options.id];
            }
        }

        if(callback) {
            return scope.create(options, callback);
        } else {
            return scope.create(options);
        }
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
    scope.create = function(options, callback) {
        if(!options || !options.type || !options.id) {
            throw new Error("Invalid program argument!");
        }

        if(callback) {
            if(loadingSandboxes[options.id]) {
                loadingSandboxes[options.id].push(callback);

                dump("[narwhal][sandbox::create] queue notify" + "\n");

                return;
            } else {
                loadingSandboxes[options.id] = [callback];
            }
        }

        dump("[narwhal][sandbox::create] CREATE NEW: " + options.internalID + "\n");

        options.internalID = options.internalID || options.id;
        options.modules = options.modules || {};
        options.debug = options.debug || false;
        try {
            var create = function(programRootPath) {

                try {
                    
                    programRootPath = FILE.Path(programRootPath);
        
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
                    var defaultPaths = [
                        "chrome:/narwhal-xulrunner/content/lib",
                        "chrome:/narwhal-xulrunner/content/narwhal/engines/default/lib",
                        "chrome:/narwhal-xulrunner/content/narwhal/lib"
                    ];
                    var loader = Loader({
                        // construct own loader paths to ensure predictable environment
                        "paths": [].concat(defaultPaths)
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
                        
                        // NOTE: the paths are messed up after the packages are loaded
                        //       so we set them correctly again by removing default paths first and
                        //       readding them in correct order
                        for( var i=0 ; i<sandbox.paths.length ; i++ ) {
                            for( var j in defaultPaths ) {
                                if(defaultPaths[j]==sandbox.paths[i]) {
                                    delete sandbox.paths[i];
                                    break;
                                }
                            }
                        }
                        // NOTE: This puts the narwhal engine and platform modules at the *TOP* of the search path
                        for( var i=(defaultPaths.length-1) ; i>=0 ; i-- ) {
                            sandbox.paths.unshift(defaultPaths[i]);
                        }
                    }

                    var ret = sandboxes[options.id] = {
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
                    };
                    
                    if(callback) {
                        for( var i=0 ; i<loadingSandboxes[options.id].length ; i++ ) {

                            dump("[narwhal][sandbox::create] trigger notify" + "\n");

                            loadingSandboxes[options.id][i](ret);
                        }
                        delete loadingSandboxes[options.id];
                        return;
                    }
        
                    return ret;

                } catch(e) {
                    narwhal.system.log.error(e);
                }
            };

            // start with the program root path and locate all resources from there
            if(callback) {
                getPath(options, "/", create);
            } else {
                return create(getPath(options, "/"));
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

    function getPath(options, path, callback) {
        var IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
        var FileService = IOService.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);
        if(options.type=="extension") {
            if(isGecko2) {
                AddonManager.getAddonByID(options.internalID, function(addon) {
                    var uri = addon.getResourceURI(path);
                    callback(FileService.getFileFromURLSpec(uri.spec).path);
                });
            } else {
                var em = Cc["@mozilla.org/extensions/manager;1"].getService(Ci.nsIExtensionManager);
                var ret = em.getInstallLocation(options.internalID).getItemFile(options.internalID, path).path;
                if(callback) {
                    return callback(ret);
                }
                return ret;
            }
        } else
        if(options.type=="application") {
            var ResourceHandler = Cc['@mozilla.org/network/protocol;1?name=resource'].getService(Ci.nsIResProtocolHandler);
            return FileService.getFileFromURLSpec(ResourceHandler.resolveURI(IOService.newURI("resource:"+path, null, null))).path;
        } else
        if(options.type=="package") {
            return path;
        }
    }
})(this);
