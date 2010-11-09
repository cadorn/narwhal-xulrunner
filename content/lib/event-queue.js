/*
var ThreadManager = Cc["@mozilla.org/thread-manager;1"].getService();

exports.enqueue = function(task) {
    var thread = ThreadManager.currentThread;
    thread.dispatch({
        run: function() {
            thread.pushEventQueue(null);
            task();
            thread.popEventQueue();
        }
    }, thread.DISPATCH_NORMAL);
};
*/

// adapted from https://github.com/mozilla/addon-sdk/blob/master/packages/jetpack-core/lib/timer.js


//const {Cc,Ci} = require("chrome");
//var xpcom = require("xpcom");

var jsm = {};
Cu.import("resource://gre/modules/XPCOMUtils.jsm", jsm);

var timerClass = Cc["@mozilla.org/timer;1"];
var nextID = 1;
var timers = {};

function TimerCallback(timerID, callback, params) {
  this._callback = callback;
  this._params = params;
};
TimerCallback.prototype = {
  QueryInterface : jsm.XPCOMUtils.generateQI([Ci.nsITimerCallback])
};

function TimeoutCallback(timerID, callback, params) {
//  memory.track(this);
  TimerCallback.apply(this, arguments)
  this._timerID = timerID;
};
TimeoutCallback.prototype = new TimerCallback();
TimeoutCallback.prototype.notify = function notifyOnTimeout(timer) {
  try {
    delete timers[this._timerID];
    this._callback.apply(null, this._params);
  } catch (e) {
    system.log.error(e);
  }
};

function IntervalCallback(timerID, callback, params) {
//  memory.track(this);
  TimerCallback.apply(this, arguments)
};
IntervalCallback.prototype = new TimerCallback();
IntervalCallback.prototype.notify = function notifyOnInterval() {
  try {
    this._callback.apply(null, this._params);
  } catch (e) {
    system.log.error(e);
  }
};


var setTimeout = exports.setTimeout = function setTimeout(callback, delay) {
  return makeTimer(
    Ci.nsITimer.TYPE_ONE_SHOT,
    callback,
    TimeoutCallback,
    delay,
    Array.slice(arguments, 2));
};

var clearTimeout = exports.clearTimeout = function clearTimeout(timerID) {
  cancelTimer(timerID);
};

var setInterval = exports.setInterval = function setInterval(callback, delay) {
  return makeTimer(
    Ci.nsITimer.TYPE_REPEATING_SLACK,
    callback,
    IntervalCallback,
    delay,
    Array.slice(arguments, 2));
};

var clearInterval = exports.clearInterval = function clearInterval(timerID) {
  cancelTimer(timerID);
};

function makeTimer(type, callback, callbackType, delay, params) {
  var timer = timerClass.createInstance(Ci.nsITimer);

//  memory.track(timer, "nsITimer");

  var timerID = nextID++;
  timers[timerID] = timer;

  timer.initWithCallback(
    new callbackType(timerID, callback, params),
    delay || 0,
    type
  );
  return timerID;
}

function cancelTimer(timerID) {
  var timer = timers[timerID];
  if (timer) {
    timer.cancel();
    delete timers[timerID];
  }
}


/*
TODO:

require("unload").when(
  function cancelAllPendingTimers() {
    var timerIDs = [timerID for (timerID in timers)];
    timerIDs.forEach(function(timerID) { cancelTimer(timerID); });
  });
*/
