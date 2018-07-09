const Processes = require('Processes');

const lowBucketAmount = 5000;
const saveBucketLessCPU = 2.5;

var Kernel = {
    startup: function () {
        Game.cpu.limit = 10;
        
        console.log("<p style=\"display:inline; color: #00ed1b\">" + '[Initializing Kernel]' + "</p>");

        // get allies and controllerSigns from segment
        if (!global.allies || global.allies.length < 1 || !global.controllerSigns || global.controllerSigns.length < 1) {
            var segment0;
            if (!RawMemory.segments[0]) RawMemory.setActiveSegments([0, 1]);
            else segment0 = JSON.parse(RawMemory.segments[0]);

            global.allies = segment0 && segment0.allies ? segment0.allies : [];
            global.controllerSigns = segment0 && segment0.controllerSigns ? segment0.controllerSigns : [];
        }

        global.Mem = Memory; // load Memory and also have a pointer in global cause my code is bad

        global.stats = {rooms: {}}; // reset stats collecting

        global.processesRun = 0; // reset processes run
        global.processCost = {}; // reset process costs

        // log the used CPU usage after startup
        console.log("<p style=\"display:inline; color: #00ed1b\">" + '[Initializing Kernel]' + "</p>" + ' CPU used: ' + Game.cpu.getUsed());
    },

    shutdown: function () {
        // reset market stuffs
        if (Game.time % 101 == 0) Memory.market = [];

        // push the stats
        if (Game.cpu.limit >= 10) {
            if (global.stats.cpu) {
                global.stats.cpu.processUse = _.clone(global.processCost);
                global.stats.cpu.getUsed = _.clone(Game.cpu.getUsed());
            }

            if (isUndefinedOrNull(RawMemory.segments[1])) RawMemory.setActiveSegments([0, 1]);
            else if (global.stats) {
                RawMemory.segments[1] = JSON.stringify(global.stats);
            }
        }
    },

    run: function () {
        var beforeStartupCPU = Game.cpu.getUsed();
        Kernel.startup(); // run startup
        // calculated startup cpu usage and average
        var startupUsedCPU = Game.cpu.getUsed()-beforeStartupCPU;
        Memory.startupAvg = Memory.startupAvg ? ((Memory.startupAvg * Memory.startupTimes) + startupUsedCPU) / (Memory.startupTimes + 1) : startupUsedCPU;
        Memory.startupTimes = Memory.startupTimes ? Memory.startupTimes + 1 : 1;

        // initialize if needed
        if (!Memory.init) return Processes.init.run();

        //normal processes

        // reset things
        global.processesTotal = 0;
        global.processesRun = 0;
        global.processesSkipped = [];
        global.processesRunName = [];

        var queues = [];

        for (let processIndex in Memory.p) {
            if (Memory.p[processIndex].idleTime && Memory.p[processIndex].idleTime <= Game.time) {
                console.logKernel('MOVED PROCESS ' + processIndex + ' BACK TO NORMAL QUEUE');
                Memory.p[processIndex].idleTime = undefined;
            }
            else if (Memory.p[processIndex].idleTime && Memory.p[processIndex].idleTime > Game.time) continue;

            if (isUndefinedOrNull(Memory.p[processIndex].avg)) Memory.p[processIndex].queue = 0;
            if (isUndefinedOrNull(Memory.p[processIndex].queue)) Memory.p[processIndex].queue = getQueue(Memory.p[processIndex].pN);

            if (!queues[Memory.p[processIndex].queue]) queues[Memory.p[processIndex].queue] = [];

            queues[Memory.p[processIndex].queue].push(processIndex)
            global.processesTotal++;
        }


        for (let queue of queues) {
            for (let processTag_it in queue) {
                let processTag = queue[processTag_it]
                let process = Memory.p[processTag];

                // Object.setPrototypeOf(process, Process);

                if (process.pN != 'deadCreepHandler' && process.pN != 'doTowers' && process.pN != 'defendRoom' && process.pN != 'claim' && process.pN != 'buildSpawn'
                    && (((Game.cpu.bucket < lowBucketAmount && Game.cpu.limit - Game.cpu.getUsed() < (Game.cpu.limit > 2.5 ? saveBucketLessCPU : 1)) || Game.cpu.bucket < 1000)
                    && (!process.avg || saveBucketLessCPU + (Memory.shutdownAvg || 0) + process.avg + Game.cpu.getUsed() > Game.cpu.limit)
                    || Game.cpu.getUsed() >= Game.cpu.limit)) {
                    //skip process
                    global.processesSkipped.push(process.pN);
                    process.queue = process.queue == 0 ? 0 : process.queue - 1;
                }
                else {
                    if (!process.pN) {
                        console.logKernel('KILLED PROCESS ' + processTag + ' CAUSE NO PROCESS NAME');
                        delete Memory.p[processTag];
                        continue;
                    }

                    if (Processes[process.pN.split(':')]) {
                        try {
                            let startCpu = Game.cpu.getUsed();

                            let rsl = Processes[process.pN].run(processTag);

                            process.queue = getQueue(process.pN);

                            let used = Game.cpu.getUsed() - startCpu;
                            process.avg = process.avg ? ((process.avg * process.times) + used) / (process.times + 1) : used;
                            process.times = process.times ? process.times + 1 : 1;

                            global.processCost[process.pN] = global.processCost[process.pN] ? global.processCost[process.pN] + used : Game.cpu.getUsed() - startCpu;

                            global.processesRun++;
                            global.processesRunName.push(process.pN);

                            if (rsl) {
                                switch (rsl.response) {
                                    case 'end':
                                        console.logKernel('KILLED PROCESS ' + processTag);
                                        delete Memory.p[processTag];
                                        break;
                                    case 'idle':
                                        if (rsl.time) {
                                            console.logKernel('ADDED PROCESS ' + processTag + ' TO IDLE PROCESSES');
                                            process.idleTime = rsl.time;
                                        }
                                        break;
                                }
                            }
                        }
                        catch (err) {
                            err && err.stack ? console.processError(err.stack) : console.processError(err);
                        }
                    }
                    else {
                        console.notify('Removed process ' + processTag + ' : ' + process.pN + ' due to not existing in Processes');
                        delete Memory.p[processTag];
                    }
                }
            }
        }
        //normal processes

        var beforeShutdownCPU = Game.cpu.getUsed();
        Kernel.shutdown();
        var shutdownUsedCPU = Game.cpu.getUsed()-beforeShutdownCPU;
        Memory.shutdownAvg = Memory.shutdownAvg ? ((Memory.shutdownAvg * Memory.shutdownTimes) + shutdownUsedCPU) / (Memory.shutdownTimes + 1) : shutdownUsedCPU;
        Memory.shutdownTimes = Memory.shutdownTimes ? Memory.shutdownTimes + 1 : 1;
    }
};

module.exports = {run: Kernel.run};
