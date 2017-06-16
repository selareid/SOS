require('global')();
require('prototype.console')();

const Traveler = require('Traveler');
const profiler = require('screeps-profiler');
const kernel = require('Kernel');

console.log("[" + "<p style=\"display:inline; color: #ededed\">RESET</p>" + "] " + "<p style=\"display:inline; color: #6dbbff\">" + Game.cpu.bucket + "</p>"); // reset log

profiler.enable();
module.exports.loop = function () {
    profiler.wrap(function() {
        //Buy that token if it appears
        var token = Game.market.getAllOrders(order => order.resourceType == SUBSCRIPTION_TOKEN &&
        order.type == ORDER_SELL && order.price <= Game.market.credits)[0];
        if (token) Game.market.deal(token.id, 1);

        if (!console.logTickStart) require('prototype.console')();
        if (!isUndefinedOrNull) require('global')();

        console.logTickStart();

        global.Mem = Memory;
        global.processesRun = 0;

        try {
            (() => {
                if (Game.time % 11 == 0) for (let creep_it in Memory.creeps) if (!Game.creeps[creep_it]) delete Memory.creeps[creep_it];
            })();
        }
        catch (err) {
            console.errorLog(err);
        }

        try {
            kernel.run();
        }
        catch (err) {
            console.kernelError(err);
            if (err.stack) console.kernelError(err.stack);
        }

        if (Memory.stats) Memory.stats.cpu.getUsed = Game.cpu.getUsed();
        console.logTickSummary()
    });
};
