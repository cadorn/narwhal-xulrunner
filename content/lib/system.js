var ENV = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment);
var MozConsole = Cc['@mozilla.org/consoleservice;1'].getService(Ci.nsIConsoleService);
var DirService = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
//var PipeConsole = Cc["@mozilla.org/process/pipe-console;1"].createInstance(Ci.nsIPipeConsole);
//PipeConsole.open(24, 80, false);

var IO = require("./io").IO;
var stdio = (function() {
    var buffer = [];
    return {
        write: function(text) {
            buffer.push(text.toString());
            return this;
        },
        flush: function() {
            dump(buffer.splice(0).join(""));
            return this;
        }
    };
})();
exports.stdin  = null;/*TODO*/
// Temporary hack to simulate stdout
exports.stdout = stdio;
exports.stderr = stdio;

var env = exports.env = {
    exists: function(name) {
        return ENV.exists(name);
    },
    get: function(name) {
        return ENV.get(name);
    },
    set: function(name, value) {
        return ENV.set(name, value);
    }
};
// Used env variables
[
    "nsINarwhal_NARWHAL_URI",
    "nsINarwhal_ENGINE_URI",
    "nsINarwhal_DEBUG",
    "nsINarwhal_VERBOSE",
    "TERM",
    "PWD",
    "NARWHAL_HOME",
    "NARWHAL_ENGINE_HOME",
    "JS_PATH",
    "NARWHAL_PATH",
    "SEA",
    "PATH",
    "NARWHAL_DEBUG",
    "NARWHAL_VERBOSE",
    "NARWHAL_ARGUMENTS"
].forEach(function(variable) {
    if(ENV.exists(variable)) env[variable] = ENV.get(variable);
});
// removing args or we'll have circular behaviour in workers
ENV.set("NARWHAL_ARGUMENTS", "");

exports.fs = require('./file');
exports.args = (env.NARWHAL_ARGUMENTS || "").split(/\s+/g);

// default logger
var Logger = require("logger").Logger;
exports.log = new Logger((function() {
    var buffer = [];
    return {
        print: function(text) {
            return this.write(text).flush();
        },
        write: function(text) {
            buffer.push(text.toString());
            return this;
        },
        flush: function() {
            var message = buffer.splice(0).join("");
            print(message);
            MozConsole.logStringMessage(message);
            return this;
        }
    };
})());

// print all console errors
var theConsoleListener =
{
    observe:function( aMessage ){
        if(/^\[JavaScript Warning:/.test(aMessage.message)) {
            // skip
        } else {
            print(" [ JSCONSOLE ] " + aMessage.message);
        }
    },
    QueryInterface: function (iid) {
    if (!iid.equals(Components.interfaces.nsIConsoleListener) &&
            !iid.equals(Components.interfaces.nsISupports)) {
        throw Components.results.NS_ERROR_NO_INTERFACE;
        }
        return this;
    }
};
if(env["nsINarwhal_DEBUG"] && env["nsINarwhal_DEBUG"]=="true") {
    dump("\n########## DEBUG ENABLED ##########\n\n");
    MozConsole.registerListener(theConsoleListener);
}


// Add app and profile directories to the prefixes if they are available
try {
    // application directory
//    exports.prefixes.push(DirService.get("resource:app", Ci.nsIFile).path);
    // profile directory
//    exports.prefixes.push(DirService.get("ProfD", Ci.nsIFile).path);
//    var Shell = require("websocket-server").run(require("shell").shell, {port: 4747});
} catch(e) {}

