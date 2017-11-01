module.exports.run = () => {
    if (Game.cpu.bucket < 100) {
        console.log('Code not loaded cause no bucket');
        return;
    }
    
    require('global')();
    require('prototype.console')();

    const Traveler = require('Traveler');

    const profiler = require('screeps-profiler');


    const kernel = require('Kernel');

    console.log("[" + "<p style=\"display:inline; color: #ededed\">RESET</p>" + "] " + "<p style=\"display:inline; color: #6dbbff\">" + Game.cpu.bucket + "</p>"); // reset log

    module.exports.run = () => {
        if (Game.cpu.bucket < 100) {
        console.log('Code not run cause no bucket');
        return;
    }
        
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

        if (Game.shard.name == 'shard0' && RawMemory.interShardSegment == "gimme") {
            var otherCreep = Game.creeps[Memory.otherCreep];

            if (!otherCreep && !Game.spawns['Spawn2'].spawning && Game.spawns['Spawn2'].room.energyAvailable >= 2400) {
                Memory.otherCreep = 'otherCreep' + Game.time;
                Game.spawns['Spawn2'].spawnCreep([MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY,MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY], Memory.otherCreep);
            }
            else if (otherCreep) {
                otherCreep.memory.l = Game.time;
                otherCreep.memory.p = 'insanity';
                otherCreep.travelTo(new RoomPosition(24, 37, 'E70S40'), {range: 0});
            }
        }
        else if (Game.shard.name == 'shard1') RawMemory.interShardSegment = "stop!";

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
}
