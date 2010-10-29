/* Copyright (c) 2006 Irakli Gozalishvili <rfobic@gmail.com>
   See the file LICENSE for licensing information. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

const Env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
const ResourceHandler = Cc['@mozilla.org/network/protocol;1?name=resource'].getService(Ci.nsIResProtocolHandler);
const IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
const ScriptableStream = Cc["@mozilla.org/scriptableinputstream;1"].getService(Ci.nsIScriptableInputStream);
const FileService = IOService.getProtocolHandler("file").QueryInterface(Ci.nsIFileProtocolHandler);
const ObserverService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

var NARWHAL_HOME = "NARWHAL_HOME";
var ENGINE_HOME = "NARWHAL_ENGINE_HOME";
var PATH = "NARWHAL_PATH";
var JS_PATH = "JS_PATH";
var APP_STARTUP = "app-startup";
var PROFILE_READY = "profile-do-change";

var EXTENSION_BOOTSTRAP_URI = "chrome://narwhal-xulrunner/content/bootstrap.js";
var EXTENSION_ENGINE_URI = "chrome://narwhal-xulrunner/content/";
var EXTENSION_NARWHAL_URI = "chrome://narwhal-xulrunner/content/narwhal/";
var EXTENSION_DEBUG = false;
var EXTENSION_VERBOSE = false;

//function dump(msg)
//{
    //Components.utils.reportError(msg);
//}

/**
 * Load profile-wide narwhal config from <ProfileDirectory>/narwhal.json.
 * The URIs specified in this config are used during the bootstrapping process.
 */
function loadNarwhalConfig() {

    // TODO: This fails when running as an app extension. Need to get config file from a different location.

    try {
        var prefFile = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties).get("ProfD", Ci.nsIFile);
        prefFile.append("narwhal.json");
/* Do not write config by default. Only use it if available.
        if(!prefFile.exists()) {
            writeFile(prefFile, JSON.stringify({
                "BOOTSTRAP_URI": EXTENSION_BOOTSTRAP_URI,
                "ENGINE_URI": EXTENSION_ENGINE_URI,
                "NARWHAL_URI": EXTENSION_NARWHAL_URI,
                "DEBUG": EXTENSION_DEBUG,
                "VERBOSE": EXTENSION_VERBOSE
            }));
        }
*/
        var config = JSON.parse(readFile(prefFile));
        if(config.hasOwnProperty("BOOTSTRAP_URI"))
            EXTENSION_BOOTSTRAP_URI = config.BOOTSTRAP_URI;
        if(config.hasOwnProperty("ENGINE_URI"))
            EXTENSION_ENGINE_URI = config.ENGINE_URI;
        if(config.hasOwnProperty("NARWHAL_URI"))
            EXTENSION_NARWHAL_URI = config.NARWHAL_URI;
        if(config.hasOwnProperty("DEBUG"))
            EXTENSION_DEBUG = config.DEBUG;
        if(config.hasOwnProperty("VERBOSE"))
            EXTENSION_VERBOSE = config.VERBOSE;
    } catch(e) {
        if (e.message) dump("loadNarwhalConfig FAILS: "+e.message + "\n");
        if (e.stack) dump("loadNarwhalConfig FAILS: "+e.stack + "\n");
    }
}

/**
 * Utility function which writes data to a file
 * @param {nsIFile} file
 * @param {String} data
 */
function writeFile(file, data) {
    var foStream = Cc["@mozilla.org/network/file-output-stream;1"].createInstance(Ci.nsIFileOutputStream);
    foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
    var converter = Cc["@mozilla.org/intl/converter-output-stream;1"].createInstance(Ci.nsIConverterOutputStream);
    converter.init(foStream, "UTF-8", 0, 0);
    converter.writeString(data);
    converter.close();
}

/**
 * Utility function which returns file for a correspoding path.
 * If the additional arguments passed appends their values to the
 * given path.
 * @param {String}          file / dir path
 * @returns nsIFile
 */
function getFile(path) {
    var file = Cc["@mozilla.org/file/local;1"].createInstance(Ci.nsILocalFile);
    file.initWithPath(path);
    for (var i=1; i < arguments.length; i++) file.append(arguments[i])
    return file;
}
/**
 * Utility function which returns file uri for a correspoding file.
 * @param {nsIFile}         file / dir path
 * @param String            corresponding file uri (file:///foo/bar)
 */
function getFileUri(file) FileService.getURLSpecFromFile(file);
function readFile(file) {
    if(file instanceof Ci.nsIFile) {
        const MODE_RDONLY = 0x01;
        const PERMS_FILE = 0644;
        var result = [];
        try {
            var fis = Cc["@mozilla.org/network/file-input-stream;1"].createInstance(Ci.nsIFileInputStream);
            fis.init(file, MODE_RDONLY, PERMS_FILE, false);
            var lis = fis.QueryInterface(Ci.nsILineInputStream);
            var line = { value: null };
            var haveMore;
            do {
                haveMore = lis.readLine(line)
                result.push(line.value);
            } while (haveMore)
        } catch(e) {
            dump("nsINarwhal.readFile FAILS for file.path: "+file.path + " "+e);
            if (e.message) dump("nsINarwhal.readFile FAILS: "+e.message + "\n");
        } finally {
            fis.close();
        }
        return result.join('\n');
    } else {
        try	{
            var channel = IOService.newChannel(file.url, null, null);
            if (channel) {
                var input = channel.open();
                ScriptableStream.init(input);
                var str = ScriptableStream.read(input.available());
                ScriptableStream.close();
                input.close();
                return str;
            } else {
                dump("nsINarwhal.readFile no channel for "+file.url+"\n");
            }
        } catch(e) {
            dump("nsINarwhal.readFile channel read FAILS for "+file.url+" "+e);
        }
    }
}

/**
 * Utility function which returns file for a correspoding resource file.
 * @param {String}          resource uri
 * @param nsIFile           corresponding file
 */
function getResourceFile(uri) FileService.getFileFromURLSpec(ResourceHandler.resolveURI(IOService.newURI(uri, null, null)));
/**
 * XPCOM handles command line argument -narwhal. If argument is followed by
 * value it will be used as a path to the bootstarp.js, Otherwise looks for
 * ENV variable NARWHAL_HOME and if" its defined looks for xulrunner engine
 * and uses it"s bootstrap.js to load.
 */
function CommandLineBoot() {}
CommandLineBoot.prototype = {
    classDescription: "Narwhal boot from command line",
    classID: Components.ID("{8082de70-034e-444f-907f-a79543016e7c}"),
    contractID: "@narwhaljs.org/xulrunner/boot/command-line;1",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports, Ci.nsICommandLineHandler]),
    _xpcom_categories: [{ category: "command-line-handler" }],
    handle: function(cmdLine) {
        // trying to get file for passed bootstrap.js (narwhal-xulrunner will pass it)
        var bootstrap;
        try { bootstrap = getFile(cmdLine.handleFlagWithParam("narwhal", false)); } catch (e) {}
        // trying to read NARWHAL_HOME env variable
        if (!bootstrap && cmdLine.handleFlag("narwhal", false)) {
            try {
                bootstrap = getFile(Env.get(ENGINE_HOME), "bootstrap.js");
            } catch(e) {}
        }
        bootstrapNarwhal(bootstrap);
    },
    helpInfo: "-narwhal [path]             Bootstrap narwhal\nwill boot narwhal from the bootstar path. If not specified will look for ENV variable NARWHAL_HOME"
}

/**
 * XPCOM observes application startup. If there is narwhal extension installed
 * it will use as a path to the bootstarp.js to load, Otherwise looks for.
 */
function AppStartupBoot() {}
AppStartupBoot.prototype = {
    classDescription: "Narwhal boot on app startup",
    classID: Components.ID("{8f0feebb-4fdc-9946-bd17-445a2e7d6557}"),
    contractID: "@narwhaljs.org/xulrunner/boot/start-up;1",
    QueryInterface: XPCOMUtils.generateQI([Ci.nsISupports, Ci.nsIObserver]),
    _xpcom_categories: [{ category: APP_STARTUP, service: true }],
    observe: function(subject, topic, data) {
        if (topic == APP_STARTUP) this.register();
        else if (topic == PROFILE_READY) this.boot();
    },
    register: function() {
        ObserverService.addObserver(this, PROFILE_READY, false);
    },
    unregister: function() {
        ObserverService.removeObserver(this, PROFILE_READY);
    },
    boot: function() {
        try {
           // loadNarwhalConfig();
            bootstrapNarwhal({
                "url": EXTENSION_BOOTSTRAP_URI,
                "exists": function() {
                    // TODO: Check with protocol handler to ensure URL does in fact exist
                    return true;
                }
            });
        } finally {
            this.unregister();
        }
    }
};
/**
 * Modifies Narwhal XPCOM so that it will be able to expose
 * require, print, system to the privileged scopes.
 * @param {nsIFile}     bootstrap.js file
 */
function bootstrapNarwhal(bootstrap) {
    if (bootstrap && bootstrap.exists())
        try {
            Env.set("nsINarwhal_NARWHAL_URI", EXTENSION_NARWHAL_URI);
            Env.set("nsINarwhal_ENGINE_URI", EXTENSION_ENGINE_URI);
            Env.set("nsINarwhal_DEBUG", (EXTENSION_DEBUG)?"true":"false");
            Env.set("nsINarwhal_VERBOSE", (EXTENSION_VERBOSE)?"true":"false");
            var sandbox = Cu.Sandbox(Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal));
            Cu.evalInSandbox(readFile(bootstrap), sandbox, "1.8", (bootstrap.path?bootstrap.path:bootstrap.url), 0);
            Narwhal.prototype.__proto__ = sandbox;
        } catch(e) {
            Cu.reportError(e);
            if (e.message) dump(e.message + "\n");
            if (e.stack) dump(e.stack + "\n");
        }
}
/**
 * Instance of Narwhal for simulateing of a singleton object.
 * This is required, because we"re registered for the "JavaScript global
 * privileged property" category, whose handler always calls createInstance.
 * See bug 386535.
 */
var narwhal;
/**
 * XPCOM Exposes object "global" to all privileged scopes. Object contains
 * system, require, print.
 */
function Narwhal() {};
Narwhal.Interfaces = [Ci.nsISupports, Ci.nsIClassInfo, Ci.nsINarwhal];
Narwhal.prototype = {
    classDescription: "Narwhal",
    classID: Components.ID("{d438150e-51a2-4f45-9de9-619f5ab01a90}"),
    contractID: "@narwhaljs.org/xulrunner/global;1",
    QueryInterface: XPCOMUtils.generateQI(Narwhal.Interfaces),
    _xpcom_categories: [{
        // http://mxr.mozilla.org/seamonkey/source/dom/public/nsIScriptNameSpaceManager.h
        category: "JavaScript global privileged property",
        entry: "global"
    }],
    _xpcom_factory: {
        createInstance: function(outer, iid) {
            if (outer != null) throw Components.results.NS_ERROR_NO_AGGREGATION;
            if (!narwhal) narwhal = new Narwhal();
            narwhal.QueryInterface(iid);
            return narwhal;
        }
    },
    // nsIClassInfo
    implementationLanguage: Ci.nsIProgrammingLanguage.JAVASCRIPT,
    getHelperForLanguage: function(number) null,
    getInterfaces: function(number) {
        number.value = Narwhal.Interfaces.length;
        return Narwhal.Interfaces;
    }
};

var components = [AppStartupBoot, Narwhal];
function NSGetModule(compMgr, fileSpec) XPCOMUtils.generateModule(components);