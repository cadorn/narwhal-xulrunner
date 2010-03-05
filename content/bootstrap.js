/* Copyright (c) 2006 Irakli Gozalishvili <rfobic@gmail.com>
   See the file LICENSE for licensing information. */
function dump(msg)
{
    Components.utils.reportError(msg);
}
/**
 * Bootstrap file for the XULRunner engine.
 */
(function(global, evalGlobal) {
    var Cc = global.Cc = Components.classes;
    var Ci = global.Ci = Components.interfaces;
    global.Cu = Components.utils;
    global.Cr = Components.results;
    global.CC = Components.Constructor;

    const IOService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
    const ScriptableStream = Cc["@mozilla.org/scriptableinputstream;1"].getService(Ci.nsIScriptableInputStream);

    var Env = Cc["@mozilla.org/process/environment;1"].getService(Ci.nsIEnvironment),
        NARWHAL_HOME = trimTailingSlash(Env.get("nsINarwhal_NARWHAL_URI")),
        NARWHAL_ENGINE_HOME = trimTailingSlash(Env.get("nsINarwhal_ENGINE_URI")),
        debug = (Env.get("nsINarwhal_DEBUG")=="true")? true : false,
        verbose = (Env.get("nsINarwhal_VERBOSE")=="true")? true : false,
        moduleScopingEnabled = false;

    function trimTailingSlash(subject) {
        if(subject.substr(subject.length-1,1)!="/") {
            return subject;
        }
        return subject.substr(0, subject.length-1);
    }

    function print (message) {
        dump(message + "\n");
    }

    function joinPath() {
        var parts = [];
        for( var i=0 ; i<arguments.length ; i++ ) {
            parts.push(arguments[i]);
        }
        return parts.join("/");
    }

    function getFileUri(file) {
        return Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService)
            .getProtocolHandler('file').QueryInterface(Ci.nsIFileProtocolHandler)
            .getURLSpecFromFile(file);
    }

    function fixPathUri(path) {
        path = path.replace(/\\/g, "/");
        if(!/^resource:\/[^\/].*/.test(path)) return path;
        return "resource://" + path.substr(10);
    }

    function read(path) {
        path = fixPathUri(path);
        var channel = IOService.newChannel(path, null, null);
        var input = channel.open();
        ScriptableStream.init(input);
        var str = ScriptableStream.read(input.available());
        ScriptableStream.close();
        input.close();
        return str;
    }

    function isFile(path) {
        path = fixPathUri(path);
        var input,
            isFile = false;
        // TODO: Use something other than try/catch to detect if path is a file
        try {
            var channel = IOService.newChannel(path, null, null);
            input = channel.open();
            ScriptableStream.init(input);
            ScriptableStream.read(1);
            ScriptableStream.close();
            isFile = true;
        } catch(e) {}

        if(input) input.close();
        return isFile;
    }

    function evaluateInSandbox(code, path, lineNo) {
        lineNo = lineNo || 0;
        path = path || "anonymus";
        var scope;
        if (moduleScopingEnabled) {
            scope = Cu.Sandbox(Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal));
            scope.__proto__ = global;
        } else {
            scope = global;
        }
        var source = "(function(require,exports,module,system,print){try{" + code +"/**/\n}catch(e){(system.log)?system.log.error(e):dump('ERROR[evaluateInSandbox]: '+e);}})";
        return Cu.evalInSandbox(source, scope, "1.8", path, lineNo);
    }
    function evaluateInGlobal(code, path, lineNo) {
        lineNo = lineNo || 0;
        path = path || "anonymus";
        var source = "(function(require,exports,module,system,print){try{" + code +"/**/\n}catch(e){(system.log)?system.log.error(e):dump('ERROR[evaluateInGlobal]: '+e);}})";
        return Cu.evalInSandbox(source, global, "1.8", path, lineNo);
    }
    var path = joinPath(NARWHAL_HOME, 'narwhal.js');
    dump("narwhal bootstrap from "+path);
    var narwhal = Cu.evalInSandbox(read(path), global, "1.8", path, 0);
    dump("narwhal evaled from "+path);
    narwhal({
        global: global,
        evalGlobal: evalGlobal, //evaluateInGlobal,
        evaluate: evaluateInSandbox,
        engine: 'xulrunner',
        engines: ['xulrunner', 'default'],
        os: Cc["@mozilla.org/xre/app-info;1"].getService(Ci.nsIXULRuntime).OS,
        debug: debug,
        verbose: verbose,
        print: print,
        fs: {
            read: read,
            isFile: isFile
        },
        prefix: NARWHAL_HOME,
        prefixes: [NARWHAL_ENGINE_HOME, NARWHAL_HOME],
        enginePrefix: NARWHAL_ENGINE_HOME
    });
    dump("narwhal init from "+path);
})(this, function () {
    // no lexical arguments so they do not mask
    // variables by the same name in global scope.
    return eval(arguments[0]);
});