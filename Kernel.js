const Processes = require('Processes');

const lowBucketAmount = 5000;
const saveBucketLessCPU = 2.5;
const saveBucketAllowance = 2;

module.exports = {
    run:  function() {
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

                if (process.pN != 'deadCreepHandler' && process.pN != 'doTowers' && process.pN != 'claim'
                    && ((Game.cpu.bucket < lowBucketAmount && Game.cpu.limit - Game.cpu.getUsed() < saveBucketLessCPU) || Game.cpu.getUsed() > Game.cpu.limit || Game.cpu.bucket < 2000)
                    && (!process.avg || Game.cpu.limit - Game.cpu.getUsed() < saveBucketAllowance || Game.cpu.limit - process.avg - Game.cpu.getUsed() < saveBucketAllowance)) {
                    //skip process
                    global.processesSkipped.push(process.pN);
                    process.queue = process.queue == 0 ? 0 : process.queue-1;
                }
                else {
                    if (!process.pN) return; //Todo add something here

                    if (Processes[process.pN.split(':')]) {
                        try {
                            let startCpu = Game.cpu.getUsed();

                            let rsl = Processes[process.pN].run(processTag);
                            
                            process.queue = getQueue(Memory.p[processIndex].pN);
                            
                            let used = Game.cpu.getUsed() - startCpu;
                            process.avg = process.avg ? ((process.avg * process.times) + used) / (process.times + 1) : used;
                            process.times = process.times ? process.times + 1 : 1;

                            global.processCost[process.pN] = global.processCost[process.pN] ? global.processCost[process.pN] + used : Game.cpu.getUsed() - startCpu;

                            global.processesRun++;
                            global.processesRunName.push(process.pN);
                            
                            if (rsl) {
                                switch (rsl.response) {
                                    case 'end':
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
    }
};
