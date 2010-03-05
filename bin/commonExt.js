/*  See the file LICENSE for licensing information. */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;


/**
 * Instance of Narwhal for simulating of a singleton object.
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