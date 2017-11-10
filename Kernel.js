const Processes = require('Processes');

const lowBucketAmount = 5000;
const saveBucketLessCPU = 2.5;

var Kernel = {
    startup: function () {
        console.log("<p style=\"display:inline; color: #00ed1b\">" + '[Initializing Kernel]' + "</p>");

        SegMemory.init();

        if (!global.allies || global.allies.length < 1 || !global.controllerSigns || global.controllerSigns.length < 1) {
            var segment0;
            if (SegMemory.getSegment('alliesControllerSigns') == SegMemory.ERR_NOT_ACTIVE) {
                //SegMemory.storeSegment('alliesControllerSigns',{ "allies":["apemanzilla","dangermouse","dewjunkie","hiryus","jedislight","leonyx","lisp","rexalicious","rubra","starwar15432","thekraken","utiuti", "redijedi"], "controllerSigns":["““◯””", "Territory Of INTEGER_MAX","CIRCLE WORLD!","INTEGER_MAX","Cake!","Delicious Cake!","My Cake Is Real","The Cake Is A Lie","Territory Of STARWAR15432, An INTEGER_MAX MEMBER","Cake, and grief counseling, will be available at the conclusion of the test -GLaDOS","In layman's terms, speedy thing goes in, speedy thing comes out -GLaDOS","It's been a long time. I've been *really* busy being dead. You know, after you MURDERED ME? -GLaDOS","When life gives you lemons, don't make lemonade! Make life take the lemons back! -Portal 2","Do you know who I am? I'm the man whose gonna burn your house down - with the lemons! -Portal 2","It's your friend deadly neurotoxin. If I were you, I'd take a deep breath. And hold it. -Portal 2","See that? That is a potato battery. It's a toy for children. And now she lives in it. -Portal 2","Violence is the last refuge of the incompetent.","People who think they know everything are a great annoyance to those of us who do.", "The essence of strategy is choosing what not to do.", "Failure is simply the opportunity to begin again, this time more intelligently.", "You can buy ad space here! Message me for more details"] });
                SegMemory.setActive('alliesControllerSigns');
            }
            else {
                segment0 = SegMemory.getSegment('alliesControllerSigns');
                SegMemory.setCrucial("alliesControllerSigns");
            }

            global.allies = segment0 && segment0.allies ? segment0.allies : [];
            global.controllerSigns = segment0 && segment0.controllerSigns ? segment0.controllerSigns : [];
        }

        global.Mem = Memory;
        global.processesRun = 0;
        global.processCost = {};

        console.log("<p style=\"display:inline; color: #00ed1b\">" + '[Initializing Kernel]' + "</p>" + ' CPU used: ' + Game.cpu.getUsed());
    },

    shutdown: function () {
        if (Game.time % 101 == 0) Memory.market = {};

        // if (Game.cpu.limit >= 10) {
        //     if (global.stats.cpu) {
        //         global.stats.cpu.processUse = _.clone(global.processCost);
        //         global.stats.cpu.getUsed = _.clone(Game.cpu.getUsed());
        //     }
        //
        //     if (isUndefinedOrNull(RawMemory.segments[1])) RawMemory.setActiveSegments([0, 1]);
        //     else if (global.stats) {
        //         RawMemory.segments[1] = JSON.stringify(global.stats);
        //     }
        // }

        var toEnable = SegMemory.endTick();
        var activeSegments = SegMemory.endTick();// Creates a list of segments that should be active/set
        if(activeSegments.rawMemorySegmentData){
            for(var data in RawMemory.segments){
                delete RawMemory.segments[data];
            }
            for(var data in activeSegments.rawMemorySegmentData){
                RawMemory.segments[data] = activeSegments.rawMemorySegmentData[data];
            }
        }
        RawMemory.setActiveSegments(activeSegments.nextEnabled);
    },

    run: function () {
        var beforeStartupCPU = Game.cpu.getUsed();
        Kernel.startup();
        var startupUsedCPU = Game.cpu.getUsed()-beforeStartupCPU;
        Memory.startupAvg = Memory.startupAvg ? ((Memory.startupAvg * Memory.startupTimes) + startupUsedCPU) / (Memory.startupTimes + 1) : startupUsedCPU;
        Memory.startupTimes = Memory.startupTimes ? Memory.startupTimes + 1 : 1;

        if (!Memory.init) return Processes.init.run();

        //normal processes

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
                    if (!process.pN) return; //Todo add something here

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
