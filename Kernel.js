const Processes = require('Processes');

module.exports = {
    run:  function() {
        if (!Memory.init) return Processes.init.run();

        var processes = Memory.p;

        _.sortBy(processes, (po) => {
            return po.prio;
        });

        for (let process_it in processes) {
            let process = processes[process_it];


            Object.setPrototypeOf(process, Process);

            if ((Game.cpu.bucket < 10000 && Game.cpu.limit - Game.cpu.getUsed() < 3) || Game.cpu.getUsed() > Game.cpu.limit * 2 || Game.cpu.bucket < 2000) process.prio++;
            else {
                if (!process.pN) process.pN = process_it.split(':')[0];

                if (Processes[process.pN.split(':')[0]]) {
                    try {
                        var rsl = Processes[process.pN.split(':')[0]].run(process_it);
                    }
                    catch (err) {
                        console.processError(err);
                        if (err.stack) console.processError(err.stack);
                    }

                    if (rsl == 'end') delete Memory.p[process_it];

                    process.prio = getPrio(process.pN);

                    global.processesRun++;
                }
                else {
                    console.notify('Removed process ' + process_it + ' due to not existing in Processes');
                    delete Memory.p[process_it];
                }
            }
        }
    }
};