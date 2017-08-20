require('global')();
require('prototype.console')();

const Traveler = require('Traveler');
const profiler = require('screeps-profiler');
const kernel = require('Kernel');

console.log("[" + "<p style=\"display:inline; color: #ededed\">RESET</p>" + "] " + "<p style=\"display:inline; color: #6dbbff\">" + Game.cpu.bucket + "</p>"); // reset log

module.exports.run = () => {
    if (!console.logTickStart) require('prototype.console')();
    if (!isUndefinedOrNull) require('global')();
    
    if (!global.allies || !global.controllerSigns) {
        var segment0;
        if (!RawMemory.segments[0]) RawMemory.setActiveSegments([0]);
        else {
        segment0 = JSON.parse(RawMemory.segments[0]);
        }
        global.allies = segment0 && segment0.allies ? segment0.allies : [];
        global.controllerSigns = segment0 && segment0.controllerSigns ? segment0.controllerSigns : [];
        }


    console.logTickStart();

    if (!global.stats) global.stats = {rooms: {}};

    global.Mem = Memory;
    global.processesRun = 0;
    global.processCost = {};

    try {
        (() => {
            if (Game.time % 11 == 0) {
                for (let creep_it in Memory.creeps) if (!Game.creeps[creep_it]) delete Memory.creeps[creep_it];
                for (let flag_it in Memory.flags) if (!Game.flags[flag_it]) delete Memory.flags[flag_it];
            }
        })();
    }
    catch (err) {
        err && err.stack ? console.errorLog(err.stack) : console.errorLog(err);
    }

    try {
        kernel.run();
    }
    catch (err) {
        err && err.stack ? console.kernelError(err.stack) : console.kernelError(err);
    }

    if (global.stats.cpu) {
        global.stats.cpu.processUse = _.clone(global.processCost);
        global.stats.cpu.getUsed = _.clone(Game.cpu.getUsed());
    }

    if (isUndefinedOrNull(RawMemory.segments[1])) RawMemory.setActiveSegments([1]);
    else if (global.stats) {
        RawMemory.segments[1] = JSON.stringify(global.stats);
    }

    console.logTickSummary();
};


if(false) { // hardcoded profiler switch
    const profiler = require('screeps-profiler');
    profiler.enable();
    module.exports.loop = () => profiler.wrap(() => module.exports.run());
} else {
    module.exports.loop = module.exports.run;
}