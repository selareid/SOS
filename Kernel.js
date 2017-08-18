const Processes = require('Processes');

const lowBucketAmount = 5000;
const saveBucketLessCPU = 2.5;
const saveBucketAllowance = 2;

module.exports = {
    run:  function() {
        if (!Memory.init) return Processes.init.run();

        //idle processes
        for (let idle_it in Memory.iP) {
            if (!Memory.iP[idle_it] || !Memory.iP[idle_it][0] || !Memory.iP[idle_it][1]) {
                Memory.iP.splice(idle_it, 1);
                console.logKernel('REMOVE PROCESS ' + idle_it + ' FROM IDLE PROCESSES');
                continue;
            }

            if (Game.time >= Memory.iP[idle_it][0]) {
                console.logKernel('ADDED PROCESS ' + idle_it + ' BACK TO NORMAL PROCESSES QUEUE');

                Memory.pQ.push(Memory.iP[idle_it][1]);
                Memory.iP.splice(idle_it, 1);
            }
        }
        //idle processes

        //normal processes
        var processQueue = Memory.pQ;

        global.processesTotal = processQueue.length;
        global.processesRun = 0;
        global.processesSkipped = [];
        global.processesRunName = [];

        for (let processQueueIndex in processQueue) {
            let processTag = processQueue[processQueueIndex];
            let process = Memory.p[processTag];

            if (!process) console.kernelError('SKIPPED PROCESS ' + processTag + ' DUE TO IT NOT EXISTING IN Memory.p'); continue;

            // Object.setPrototypeOf(process, Process);

            if (process.pN != 'deadCreepHandler' && process.pN != 'doTowers' && process.pN != 'claim'
                && ((Game.cpu.bucket < lowBucketAmount && Game.cpu.limit - Game.cpu.getUsed() < saveBucketLessCPU) || Game.cpu.getUsed() > Game.cpu.limit * 2 || Game.cpu.bucket < 2000)
                && (!process.avg || Game.cpu.limit - Game.cpu.getUsed() < saveBucketAllowance || Game.cpu.limit - process.avg - Game.cpu.getUsed() < saveBucketAllowance)) {
                //skip process
                global.processesSkipped.push(process.pN);
            }
            else {
                if (!process.pN) return; //Todo add something here

                if (Processes[process.pN.split(':')]) {
                    try {
                        let startCpu = Game.cpu.getUsed();

                        let rsl = Processes[process.pN].run(processTag);

                        let used = Game.cpu.getUsed()-startCpu;
                        process.avg = process.avg ?  ((process.avg*process.times)+used)/(process.times+1) : used;
                        process.times = process.times ? process.times+1 : 1;

                        global.processCost[process.pN] = global.processCost[process.pN] ? global.processCost[process.pN]+used : Game.cpu.getUsed()-startCpu;

                        global.processesRun++;
                        global.processesRunName.push(process.pN);

                        if (rsl) {
                            switch (rsl.response) {
                                case 'end':
                                    delete Memory.p[processTag];
                                    Memory.pQ.splice(processQueueIndex, 1);
                                    break;
                                case 'idle':
                                    if (rsl.time) {
                                        Memory.iP.push([
                                            rsl.time,
                                            processTag
                                        ]);

                                        console.logKernel('ADDED PROCESS ' + processTag + ' TO IDLE PROCESSES');

                                        Memory.pQ.splice(processQueueIndex, 1);
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
                    Memory.pQ.splice(processQueueIndex, 1);
                }
            }
        }
        //normal processes
    }
};
