
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


// backwards compatibility
if(!Logger.SEV_LABEL)
    Logger.SEV_LABEL = ["FATAL", "ERROR", "WARN" , "INFO" , "DEBUG"];


Logger.SEV_LABEL.forEach(function(label, severity) {
    Logger.prototype[label.toLowerCase()] = function() {
        if(arguments[0] instanceof Error) {
            renderError(label, arguments[0]);
        }    
        return this.add(severity, this.format(severity, arguments));
    };
});


function renderError(severity, error) {
    
    var color = (severity=="ERROR")?
                    "red" :
                    (severity=="WARN")?
                        "orange":"white";    
    
    STREAM.print("  \0"+color+"(* "+severity+" ***************************************************************************\0)");
    STREAM.print("  \0"+color+"(*\0) Error: \0"+color+"(\0bold(" + ((typeof error.message !="undefined")?error.message:error) + "\0)\0)");
    STREAM.print("  \0"+color+"(*\0) File : \0cyan(\0bold(" + error.fileName + "\0)\0)");    
    STREAM.print("  \0"+color+"(*\0) Line : \0yellow(\0bold(" + error.lineNumber + "\0)\0)");
    if(error.stack) {
        STREAM.print("  \0"+color+"(*\0) Stack:");
        UTIL.forEach(error.stack.split("\n"), function(line) {
            STREAM.print("  \0"+color+"(*\0)        " + line);
        });
    }
    if(INCLUDE_NOTES && error.notes) {
        STREAM.print("  \0"+color+"(*\0) Notes:");
        
        // TODO: Use better dumper to catch circular references etc...
        var dump = JSDUMP.parse(error.notes);
        
        UTIL.forEach(dump.split("\n"), function(line) {
            STREAM.print("  \0"+color+"(*\0)        " + line);
        });
    }
    STREAM.print("  \0"+color+"(* "+severity+" ***************************************************************************\0)");    
}
