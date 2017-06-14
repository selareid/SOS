require('global')();
require('prototype.console')();

const Traveler = require('Traveler');
const profiler = require('screeps-profiler');
const kernel = require('Kernel');

console.log("[" + "<p style=\"display:inline; color: #ededed\">RESET</p>" + "] " + "<p style=\"display:inline; color: #6dbbff\">" + Game.cpu.bucket + "</p>"); // reset log

profiler.enable();
module.exports.loop = function () {
    profiler.wrap(function() {
        if (!console.logTickStart) require('prototype.console')();
        if (!isUndefinedOrNull) require('global')();

        console.logTickStart();

        var token = Game.market.getAllOrders(order => order.resourceType == SUBSCRIPTION_TOKEN &&
        order.type == ORDER_SELL && order.price <= Game.market.credits)[0];
        if (token) Game.market.deal(token.id, 1);

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


        kernel.run();

        if (Memory.stats) Memory.stats.cpu.getUsed = Game.cpu.getUsed();
        console.logTickSummary(Game.cpu.getUsed)
    });
};