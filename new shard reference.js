if (Game.shard.name == 'shard0') {
    //normal code

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

    //normal code
}
else {
    const roomToGoTo = 'E41S19';

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
                else creep.room.createConstructionSite(new RoomPosition(27, 11, roomToGoTo), STRUCTURE_SPAWN);
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