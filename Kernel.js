const Processes = require('Processes');

const lowBucketAmount = 9000;
const saveBucketLessCPU = 2.5;

module.exports = {
    run:  function() {
        if (!Memory.init) return Processes.init.run();

        //idle processes
        for (let idle_it in Memory.iP) {
            if (!Memory.iP[idle_it] || !Memory.iP[idle_it][0] || !Memory.iP[idle_it][1]) {
                delete Memory.iP[idle_it];
                console.logKernel('REMOVE PROCESS ' + idle_it + ' FROM IDLE PROCESSES');
                continue;
            }

            if (Game.time >= Memory.iP[idle_it][0]) {
                console.logKernel('ADDED PROCESS ' + idle_it + ' BACK TO NORMAL PROCESSES QUEUE');

                Memory.p[idle_it] = _.cloneDeep(Memory.iP[idle_it][1]);
                delete Memory.iP[idle_it];
            }
        }
        //idle processes

        //normal processes
        var processes = Memory.p;

        _.sortBy(processes, (po) => {
            return po.prio;
        });

        global.processesTotal = _.size(processes);
        global.processesRun = 0;
        global.processesSkipped = [];
        global.processesRunName = [];

        for (let process_it in processes) {
            let process = processes[process_it];

            // Object.setPrototypeOf(process, Process);

            if (process.pN != 'deadCreepHandler' && process.pN != 'doTowers' && process.pN != 'claim'
                && ((Game.cpu.bucket < lowBucketAmount && Game.cpu.limit - Game.cpu.getUsed() < saveBucketLessCPU) || Game.cpu.getUsed() > Game.cpu.limit * 2 || Game.cpu.bucket < 2000)) {
                //skip process
                process.prio++;
                global.processesSkipped.push(process.pN);
            }
            else {
                if (!process.pN) process.pN = process_it.split(':')[0];

                if (Processes[process.pN.split(':')[0]]) {
                    try {
                        let startCpu = Game.cpu.getUsed();

                        let rsl = Processes[process.pN.split(':')[0]].run(process_it);

                        let used = Game.cpu.getUsed()-startCpu;
                        process.avg = process.avg ?  ((process.avg*process.times)+(used.toFixed(3)))/(process.times+1) : used;
                        process.times = process.times ? process.times+1 : 1;

                        global.processCost[process.pN] = global.processCost[process.pN] ? global.processCost[process.pN]+used : Game.cpu.getUsed()-startCpu;

                        global.processesRun++;
                        global.processesRunName.push(process.pN);

                        if (rsl) {
                            switch (rsl.response) {
                                case 'end':
                                    delete Memory.p[process_it];
                                    break;
                                case 'idle':
                                    if (rsl.time) {
                                        Memory.iP[process_it] = [
                                            rsl.time,
                                            _.cloneDeep(Memory.p[process_it])
                                        ];

                                        console.logKernel('ADDED PROCESS ' + process_it + ' TO IDLE PROCESSES');

                                        delete Memory.p[process_it];
                                    }
                                    break;
                            }
                        }
                    }
                    catch (err) {
                        console.processError(err);
                        if (err.stack) console.processError(err.stack);
                    }

                    process.prio = getPrio(process.pN);
                }
                else {
                    console.notify('Removed process ' + process_it + ' due to not existing in Processes');
                    delete Memory.p[process_it];
                }
            }
        }
        //normal processes
    }
};
