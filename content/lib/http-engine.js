
var IO = require('./io').IO;

exports.IO = function (url) {
    var request = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
    request.open('GET', url, false);
    return {
        read: function() {
            request.send(null);
            if(request.status == 0 || request.status == 200)
                return request.responseText;
            else throw Error("Unable to read url : " + request.statusText);
        },
        close: function() {
        }
    }
};
