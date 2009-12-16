
var INCLUDE_NOTES = false;

var JSDUMP = require('test/jsdump').jsDump;
var UTIL = require("util");
var STREAM = require('term').stream;


// Logging
// 
// FATAL:   an unhandleable error that results in a program crash
// ERROR:   a handleable error condition
// WARN:    a warning
// INFO:    generic (useful) information about system operation
// DEBUG:   low-level information for developers
// (Stolen from Ruby)
//

var file = require("file");

var Logger = exports.Logger = function(output) {
    if (typeof output === "string")
        this.output = file.open(output, "a");
    else
        this.output = output;
        
    this.level = Logger.INFO;
};

Logger.SEV_LABEL = ["FATAL", "ERROR", "WARN" , "INFO" , "DEBUG"];

Logger.SEV_LABEL.forEach(function(label, severity) {
    Logger[label] = severity;
    Logger.prototype[label.toLowerCase()] = function() {
        if(arguments[0] instanceof Error) {
            renderError(label, arguments[0]);
        }    
        return this.add(severity, this.format(severity, arguments));
    };
});

Logger.prototype.add = function(severity, message, progname) {
    if (severity > this.level)
        return false;
    this.output.print(message || progname);
};

Logger.prototype.format = function(severity, args) {
    return new Date() + " ["+Logger.SEV_LABEL[severity].toLowerCase()+"] " +Array.prototype.join.apply(args, [" "]).replace(/\n/g, "");
};


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
