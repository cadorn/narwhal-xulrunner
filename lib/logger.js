
var INCLUDE_NOTES = false;


var FILE = require("file");
var JSDUMP = require('test/jsdump').jsDump;
var UTIL = require("util");
var STREAM = require('term').stream;

var LOGGER = require(FILE.join(system.prefix, "lib", "logger.js"));

for (var name in LOGGER) {
    if (Object.prototype.hasOwnProperty.call(LOGGER, name)) {
        exports[name] = LOGGER[name];
    }
};


var Logger = exports.Logger;

Logger.prototype.error = function() {

    if(arguments[0] instanceof Error) {
        
        var error = arguments[0];
        
        STREAM.print("  \0red(*****************************************************************************\0)");
        STREAM.print("  \0red(*\0) Error: \0red(\0bold(" + ((typeof error.message !="undefined")?error.message:error) + "\0)\0)");
        STREAM.print("  \0red(*\0) File : \0cyan(\0bold(" + error.fileName + "\0)\0)");    
        STREAM.print("  \0red(*\0) Line : \0yellow(\0bold(" + error.lineNumber + "\0)\0)");
        if(error.stack) {
            STREAM.print("  \0red(*\0) Stack:");
            UTIL.forEach(error.stack.split("\n"), function(line) {
                STREAM.print("  \0red(*\0)        " + line);
            });
        }
        if(INCLUDE_NOTES && error.notes) {
            STREAM.print("  \0red(*\0) Notes:");
            
            // TODO: Use better dumper to catch circular references etc...
            var dump = JSDUMP.parse(error.notes);
            
            UTIL.forEach(dump.split("\n"), function(line) {
                STREAM.print("  \0red(*\0)        " + line);
            });
        }
        STREAM.print("  \0red(*****************************************************************************\0)");
    }    

    return this.add(Logger.ERROR, this.format(Logger.ERROR, arguments));
};
