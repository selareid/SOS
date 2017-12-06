require('global')();
require('prototype.console')();
require('SegMemory');

const Traveler = require('Traveler');

const profiler = require('screeps-profiler');


const kernel = require('Kernel');

console.log("[" + "<p style=\"display:inline; color: #ededed\">RESET</p>" + "] " + "<p style=\"display:inline; color: #6dbbff\">" + Game.cpu.bucket + "</p>"); // reset log

if (Game.spawns['Spawn1']) {
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

        if (Game.shard.name == 'shard2' && RawMemory.interShardSegment == "gimme") {
            var otherCreep = Game.creeps[Memory.otherCreep];

            if (!otherCreep && !Game.spawns['Spawn10'].spawning && Game.spawns['Spawn10'].room.energyAvailable >= 2400) {
                if (!Memory.otherCreep) Memory.otherCreep = 'otherCreep' + Game.time;
                Game.spawns['Spawn10'].spawnCreep([MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY,MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY, MOVE, WORK, CARRY], Memory.otherCreep);
            }
            else if (otherCreep) {
                otherCreep.memory.l = Game.time;
                otherCreep.memory.p = 'insanity';
                otherCreep.travelTo(new RoomPosition(24, 4, 'W10S20'), {range: 0});
            }

            var claimerOther = Game.creeps[Memory.claimerOther];

            if (!claimerOther && !Game.spawns['Spawn10'].spawning && Game.spawns['Spawn10'].room.energyAvailable >= 700) {
                if (!Memory.claimerOther) Memory.claimerOther = 'claimerOther' + Game.time;
                Game.spawns['Spawn10'].spawnCreep([MOVE, MOVE, CLAIM], Memory.claimerOther);
            }
            else if (claimerOther) {
                claimerOther.memory.l = Game.time;
                claimerOther.memory.p = 'insanity';
                claimerOther.travelTo(new RoomPosition(24, 4, 'W10S20'), {range: 0});
            }
        }
        else if (Game.shard.name == 'shard1') RawMemory.interShardSegment = "stop!";
        //normal code

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
else {
    const roomToGoTo = 'W12S21';

    require('prototype.creep');


    function doClaimer(creep) {
        if (creep.pos.roomName == roomToGoTo) {
            if (creep.room.controller.owner && creep.room.controller.owner.username == creep.owner.username) {
                RawMemory.interShardSegment = 1;
                creep.suicide();
            }

            if (creep.pos.isNearTo(creep.room.controller)) creep.claimController(creep.room.controller);
            else creep.travelTo(creep.room.controller, {range: 1});
        }
        else creep.travelTo(new RoomPosition(21, 21, roomToGoTo), {range: 3});
    }

    function doStartup(creep) {
        if (creep.pos.roomName == roomToGoTo) {
            if (creep.room.find(FIND_MY_SPAWNS).length > 0) {
                RawMemory.interShardSegment = 2;
                creep.suicide();
            }

            if (creep.carry.energy == 0) creep.memory.w = 0;
            else if (creep.carry.energy == creep.carryCapacity) creep.memory.w = 1;

            if (creep.memory.w == 1) {
                var constructionSite = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {filter: (s) => s.structureType == STRUCTURE_SPAWN})[0];

                if (constructionSite) {
                    if (creep.pos.isNearTo(constructionSite)) creep.build(constructionSite);
                    else creep.travelTo(constructionSite);
                }
                else creep.room.createConstructionSite(new RoomPosition(28, 22, roomToGoTo), STRUCTURE_SPAWN);
            }
            else {
                var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                if (creep.pos.isNearTo(source)) creep.harvest(source);
                else creep.travelTo(source);
            }
        }
        else creep.travelTo(new RoomPosition(21, 21, roomToGoTo), {range: 3});
    }

    module.exports.loop = function () {
        if (!Game.rooms[roomToGoTo] || Game.rooms[roomToGoTo].find(FIND_HOSTILE_CREEPS).length < 1) RawMemory.interShardSegment = "gimme";
        else RawMemory.interShardSegment = "stop!";

        if (Game.time % 103 == 0) for (let creep_it in Memory.creeps) if (!Game.creeps[creep_it]) delete Memory.creeps[creep_it];

        _.forEach(Game.creeps, (creep) => {
            switch (creep.memory.role) {
                case 'claimer':
                    doClaimer(creep);
                    break;
                case 'startup':
                    doStartup(creep);
                    break;
                default:
                    if (creep.hasActiveBodyparts(CLAIM)) creep.memory.role = 'claimer';
                    else creep.memory.role = 'startup'

            }
        });
    };
}
