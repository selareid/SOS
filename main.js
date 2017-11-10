require('global')();
require('prototype.console')();

const Traveler = require('Traveler');

const profiler = require('screeps-profiler');


const kernel = require('Kernel');

console.log("[" + "<p style=\"display:inline; color: #ededed\">RESET</p>" + "] " + "<p style=\"display:inline; color: #6dbbff\">" + Game.cpu.bucket + "</p>"); // reset log

module.exports.run = () => {

    if (!console.logTickStart) require('prototype.console')();
    if (!isUndefinedOrNull) require('global')();

    console.logTickStart();

    try {
        kernel.run();
    }
    catch (err) {
        err && err.stack ? console.kernelError(err.stack) : console.kernelError(err);
    }

    console.logTickSummary();
};


if (false) { // hardcoded profiler switch
    const profiler = require('screeps-profiler');
    profiler.enable();
    module.exports.loop = () => profiler.wrap(() => module.exports.run());
} else {
    module.exports.loop = module.exports.run;
}