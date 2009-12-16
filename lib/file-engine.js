
var DirService = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties)
var FileOutputStream = CC("@mozilla.org/network/file-output-stream;1", "nsIFileOutputStream", "init");
var FileInputStream = CC("@mozilla.org/network/file-input-stream;1", "nsIFileInputStream", "init");
var LocalFile = CC("@mozilla.org/file/local;1", "nsILocalFile", "initWithPath");
var Process = CC("@mozilla.org/process/util;1", "nsIProcess", "init");              

var exports = require('./file');
var IO = require("./io").IO;
var OS = require('./os');
var JAR_LOADER = require("./jar-loader");


function MozFile(path) {
    var file;
    try {
        file = new LocalFile(path);
    } catch(e) {
        file = new LocalFile(exports.cwd());
        path.split(/[\\\/]/).forEach(function(part) {
            if (part != '') file.append(part)
        });
    }
    return file;
}

exports.cwd = function () DirService.get("CurWorkD", Ci.nsIFile).path;

exports.list = function (path) {
    var ret = JAR_LOADER.mapPath("!list", path);
    if(ret) {
        if(ret.archive) return ret.archive.list(ret.path);
        path = ret.path;
    }
    var entries = MozFile(path).directoryEntries;
    var entryNames = [];
    while(entries.hasMoreElements()) {
        var entry = entries.getNext();
        entry.QueryInterface(Ci.nsIFile);
        entryNames.push(entry.leafName);
    }
    return entryNames;
};

exports.canonical = function (path) {

    JAR_LOADER.mapPath("canonical", path);

    var file = MozFile(path);
    try {
        file.normalize();
    } catch(e) {}
    return file.path;
}

exports.exists = function (path) {
    var ret = JAR_LOADER.mapPath("!exists", path);
    if(ret) {
        if(ret.archive) return ret.archive.exists(ret.path);
        path = ret.path;
    }

    return MozFile(path).exists();
}

exports.mtime = function (path) {
    var ret = JAR_LOADER.mapPath("!mtime", path);
    if(ret) {
        if(ret.archive) return ret.archive.mtime(ret.path);
        path = ret.path;
    }

    return new Date(MozFile(path).lastModifiedTime);
}
exports.size = function (path) {
    JAR_LOADER.mapPath("size", path);
    return MozFile(path).fileSize;
}
exports.stat = function (path) {
    JAR_LOADER.mapPath("stat", path);
    return {
        mtime: exports.mtime(path),
        size: exports.size(path)
    }
};

exports.isDirectory = function (path) {
    var ret = JAR_LOADER.mapPath("!isDirectory", path);
    if(ret) {
        if(ret.archive) return ret.archive.isDirectory(ret.path);
        path = ret.path;
    }

    var file = MozFile(path);
    return file.exists() && file.isDirectory();
}

exports.isFile = function (path) {
    var ret = JAR_LOADER.mapPath("!isFile", path);
    if(ret) {
        if(ret.archive) return ret.archive.isFile(ret.path);
        path = ret.path;
    }
    
    var file = MozFile(path);
    return file.exists() && file.isFile();
}

exports.isLink = function (path) {

    JAR_LOADER.mapPath("isLink", path);

    return MozFile(path).isSymlink();
}

exports.isReadable = function (path) {

    JAR_LOADER.mapPath("isReadable", path);

    return MozFile(path).isReadable();
}

exports.isWritable = function (path) {
    JAR_LOADER.mapPath("isWritable", path);

    return MozFile(path).isWritable();
}

exports.rename = function (source, target) {
    source = exports.path(source);
    target = source.resolve(target);
    source = MozFile(source);
    target = MozFile(target);
    try {
        source.moveTo(target.parent, target.leafName);
    } catch(e) {
        throw new Error("failed to rename " + source.path + " to " + target.path);
    }
};

exports.move = function (source, target) {
    source = exports.path(source);
    target = source.resolve(target);
    source = MozFile(source);
    target = MozFile(target);
    try {
        source.moveTo(target.parent, target.leafName);
    } catch(e) {
        throw new Error("failed to move " + source.path + " to " + target.path);
    }
};

exports.remove = function (path) {
    try {
        MozFile(path).remove(false)
    } catch(e) {
        throw new Error("failed to delete " + path);
    }
};

exports.mkdir = function (path) {

    JAR_LOADER.mapPath("mkdir", path);

    return MozFile(path).create(Ci.nsIFile.DIRECTORY_TYPE, 0777);
}

exports.mkdirs = exports.mkdir;

exports.rmdir = function(path) {
    JAR_LOADER.mapPath("rmdir", path);

    try {
        MozFile(path).remove(false)
    } catch(e) {
        throw new Error("failed to delete " + path);
    }
};

exports.rmtree = function(path) {

    JAR_LOADER.mapPath("rmtree", path);
    try {
        MozFile(path).remove(true)
    } catch(e) {
        throw new Error("failed to delete " + path);
    }
};

exports.touch = function (path, mtime) {

    JAR_LOADER.mapPath("touch", path);
    
    var file = MozFile(path);
    if (!file.exists()) file.create(Ci.nsIFile.NORMAL_FILE_TYPE, 0666);
    else file.lastModifiedTime = new Date().getTime().toString();
};

exports.symlink = function (source, target) {
/*
    // XXX this behavior of resolving the source
    // path from the target path when the source 
    // path is relative ought to be discussed
    // on ServerJS
    if (exports.isRelative(source))
        source = exports.relative(target, source);
    OS.command(['ln', '-s', source, target]);
*/
    if(/\bwindows\b/i.test(system.os) || /\bwinnt\b/i.test(system.os)) {
        throw "NYI";
    }

    var shell = "/bin/ln";
    var file = new LocalFile(shell);
    var process = new Process(file);
    var args = ["-s", source, target];
    process.run(true, args, args.length);
};

exports.FileIO = function (path, mode, permissions) {

    var {
        read: read,
        write: write,
        append: append,
        update: update
    } = exports.mode(mode);
    
    if(read) {
        var ret = JAR_LOADER.mapPath("!FileIO[mode=read]", path);
        if(ret) {
            if(ret.archive) return ret.archive.read(ret.path);
            path = ret.path;
        }
    }

    JAR_LOADER.mapPath("FileIO", path);

    file = MozFile(path);

    if (update) {
        throw new Error("Updating IO not yet implemented.");
    } else if (write || append) {
        return new IO(null, new FileOutputStream(file, -1, -1, 0));
    } else if (read) {
        return new IO(new FileInputStream(file, -1, 0, 0), null);
    } else {
        throw new Error("Files must be opened either for read, write, or update mode.");
    }
};
