/* See license.txt for terms of usage */

// ************************************************************************************************
// Constants

const CLASS_ID = Components.ID("{bb9b6ea1-5e9f-4983-a1f6-6f262ca1a40b}");
const CLASS_NAME = "CommonJS.org Modules 1.1";
const CONTRACT_ID = "@commonjs.org/modules-1.1;1";

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cr = Components.results;

// http://wiki.commonjs.org/wiki/Modules/1.1
var module =
{
    // 1. In a module, there is a free variable "require", that is a Function.
    //    1. The "require" function accepts a module identifier.
    requires: function(moduleIdentifier)
    {
        // The "id" property must be such that require(module.id) will return the exports object from which the module.id originated.
        if (moduleIdentifier === module.module.id)
            return module.exports;
    },

    // 2. In a module, there is a free variable called "exports", that is an object that the module may add its API to as it executes.
    exports:
    {
        requires: module.requires,
        exports: module.exports,
        module: module.module,
    },

    // 3. In a module, there must be a free variable "module", that is an Object.
    module:
    {
        // 1. The "module" object must have a read-only, don't delete "id" property that is the top-level "id" of the module.
        get id()
        {
            return CONTRACT_ID;
        }
}


