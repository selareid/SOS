
require('prototype.room-position');
require('prototype.room');
require('prototype.creep');
require('pathing');

const processSpawn = require('process.spawn');

function getCreep(name, process) {
    var creep = Game.creeps[name];

    if (!process || !creep) return creep ? creep : undefined;

    if (!creep.memory.p || !creep.memory.p == process) creep.memory.p = process;
    creep.memory.l = Game.time;

    if (process != 'deadCreepHandler' && creep.room.storage && creep.ticksToLive <= (creep.pos.getRangeTo(creep.room.storage)*2)) {
        spawnNewProcess('deadCreepHandler', undefined, creep.name);
        return 'dead';
    }

    return creep ? creep : undefined;
}

const defaultBodyChart = {
    scout: [[], [MOVE], 1],
    minimalist: [[WORK, MOVE, MOVE, CARRY, CARRY], []],
    doHarvest: [[WORK, MOVE, MOVE, CARRY], [], 6],
    praiseRC: [[WORK, CARRY, MOVE], []],
    mine: [[WORK, MOVE], [CARRY, MOVE]],
    strgDistr: [[CARRY], [MOVE], 16],
    fillSpawn: [[CARRY, CARRY, MOVE], [], 6],
    fillExt: [[CARRY, CARRY, MOVE], [], 8],
    iRmHaul: [[CARRY, CARRY, MOVE], []],
    takeCare: [[WORK, CARRY, MOVE], []],
    claim: [[CLAIM, MOVE, MOVE], [], 1],
    buildSpawn: [[WORK, MOVE, CARRY, MOVE], []],
    stealEnergy: [[CARRY, MOVE, MOVE], []],
    healer: [[MOVE, HEAL], []],
    crusher: [[MOVE, ATTACK], []],
    drainer: [[MOVE, HEAL], []],
    guards: [[MOVE, MOVE, MOVE, ATTACK, RANGED_ATTACK, HEAL], []],
    defendRoom: [[MOVE, ATTACK], []],
    reserver: [[CLAIM, MOVE, MOVE], [], 2],
    harvesters: [[WORK, CARRY, MOVE, MOVE], [], 6],
    haulers: [[CARRY, CARRY, MOVE, MOVE], []],
    miners: [[WORK, MOVE], [CARRY, MOVE]],
    doLabs: [[CARRY, MOVE], [], 21],
    remoteBadger: [[MOVE, ATTACK], [], 1]
};

function getBodyChart(room) {
    var newChart = _.clone(defaultBodyChart);

    if (room) {
        if (room.controller.level < 7) newChart['fillExt'][0] = [CARRY, CARRY, MOVE, MOVE];
        newChart['fillSpawn'][2] = room.find(FIND_MY_SPAWNS).length*3;
        
        if (room.energyAvailable < 700) newChart['claim'][0] = [CLAIM, MOVE];

        // if (room.controller.level >= 7 && room.find(FIND_SOURCES).length >= 2) {
        //     if (!room.memory.hrvstPrts) {
        //         var parts = 0;
        //         var totalTime = Number.POSITIVE_INFINITY;
        //         var time = room.findPath(room.find(FIND_SOURCES)[0].pos, room.find(FIND_SOURCES)[1].pos, {ignoreRoads: true, swampCost: 1, ignoreCreeps: true, maxRooms: 1}).length;
        //
        //         for (; Math.floor(totalTime) > 300; parts++) {
        //             let mine = 3000 / (parts * 2);
        //
        //             totalTime = Math.floor((mine * 2) + (time * 2));
        //         }
        //
        //         room.memory.hrvstPrts = parts;
        //         newChart['doHarvest'][2] = parts;
        //         newChart['doHarvest'][1] = [MOVE, CARRY];
        //         newChart['doHarvest'][0] = [WORK, MOVE];
        //     }
        //     else {
        //         newChart['doHarvest'][2] = room.memory.hrvstPrts;
        //         newChart['doHarvest'][1] = [MOVE, CARRY];
        //         newChart['doHarvest'][0] = [WORK, MOVE];
        //     }
        // }
    }

    return newChart;
}

function getRandomHash() {
    var randomHash;

    do {
        randomHash = makeid();
    }
    while (global[randomHash]);

    return randomHash;
}

module.exports = {
    //global processes (not tied to room)

    init: {
        run: function () {
            global.Mem.notify = [];
            global.Mem.p = {};
            global.Mem.rooms = {};
            global.Mem.init = true;

            spawnNewProcess('doStats');
            spawnNewProcess('checkRooms');
            spawnNewProcess('checkCreeps');
            spawnNewProcess('checkGlobalProcesses');
            spawnNewProcess('checkStructRepair');
            spawnNewProcess('garbageCollection');
        }
    },

    doStats: {
        run: function () {
            if (Game.cpu.limit < 10) return {response: 'idle', time: Game.time + 1001};

            global.stats.tick = Game.time;
            global.stats.gcl = Game.gcl;
            global.stats.constructionSites = _.size(Game.constructionSites);
            global.stats.tokens = Game.resources.token;
            global.stats.power = Game.resources[RESOURCE_POWER];

            global.stats.cpu = {
                limit: Game.cpu.limit,
                bucket: Game.cpu.bucket,
                heapStatistics: Game.cpu.getHeapStatistics()
            };

            global.stats.memory = {
                used: RawMemory.get().length
            };

            global.stats.market = {
                credits: Game.market.credits,
                num_orders: Game.market.orders ? Object.keys(Game.market.orders).length : 0,
            };
        }
    },

    garbageCollection: {
        run: function () {
            for (let creep_it in Memory.creeps) if (!Game.creeps[creep_it]) delete Memory.creeps[creep_it];
            for (let flag_it in Memory.flags) if (!Game.flags[flag_it]) delete Memory.flags[flag_it];

            return {response: 'idle', time: Game.time + 13};
        }
    },

    checkGlobalProcesses: {
        run: function () {

            (function () {
                var flag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'claim')[0];

                if (flag && (!flag.room || !flag.room.controller.my) && !processExists('claim')) spawnNewProcess('claim');
            }());

            (function () {
                var flag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'buildSpawn')[0];

                if (flag && (!flag.room || flag.room.find(FIND_MY_SPAWNS).length < 1) && !processExists('buildSpawn', undefined, 3)) spawnNewProcess('buildSpawn');
            }());

            (function () {
                var flag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'steal' && Game.rooms[f.name.split(' ')[1]])[0];

                if (flag && !processExists('stealEnergy')) spawnNewProcess('stealEnergy');
            }());

            (function () {
                var flag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'crusher' && Game.rooms[f.name.split(' ')[1]])[0];

                if (flag && !processExists('crusher')) spawnNewProcess('crusher');
            }());

            (function () {
                var flag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'drainer' && Game.rooms[f.name.split(' ')[1]])[0];

                if (flag && !processExists('drainer')) spawnNewProcess('drainer');
            }());

            return {response: 'idle', time: Game.time + 100 + Math.round(Math.random() * 100)};
        }
    },

    checkRooms: {
        run: function () {

            for (let roomName in Game.rooms) {
                let room = Game.rooms[roomName];
                if (!room || !room.controller || !room.controller.my || room.find(FIND_MY_SPAWNS).length < 1) continue;

                if (!processExists('room', room.name)) {
                    _.forEach(room.find(FIND_MY_CREEPS, (c) => {
                        c.suicide();
                    }));
                    spawnNewProcess('room', room.name);
                }
            }

            return {response: 'idle', time: Game.time + 5 + Math.round(Math.random() * 7)};
        }
    },

    checkCreeps: {
        run: function () {

            _.forEach(Game.creeps, (creep) => {
                if (!creep.memory.p || !creep.memory.l || Game.time - creep.memory.l > 7) {
                    if (isUndefinedOrNull(creep.memory.nc)) creep.memory.nc = 0;
                    else creep.memory.nc++;

                    if (creep.memory.nc > 3) {
                        if (creep.ticksToLive > CREEP_LIFE_TIME*0.25 && creep.memory.p != null && creep.hasActiveBodyparts(WORK) && creep.hasActiveBodyparts(CARRY)) {
                            var praiseRCP = _.filter(global.Mem.p, (p) => p.rmN == creep.room.name && p.pN == 'praiseRC');
                            if (praiseRCP && praiseRCP[0] && praiseRCP[0].crps) praiseRCP[0].crps.push(creep.name);

                            creep.memory.p = praiseRCP ? 'praiseRC' : null;
                        }
                        else spawnNewProcess('deadCreepHandler', creep.room.name, creep.name);
                    }
                }
                else delete creep.memory.nc;
            });

            return {response: 'idle', time: Game.time + 5 + Math.round(Math.random() * 5)};
        }
    },

    checkStructRepair: {
        run: function () {
            _.forEach(Game.rooms, (room) => {
                if (!room.controller || !room.controller.my) return;
                if (!room.memory.repairQueue) room.memory.repairQueue = [];

                _.forEach(room.find(FIND_STRUCTURES), (structure) => {
                    if ((structure.structureType != STRUCTURE_WALL && structure.structureType != STRUCTURE_RAMPART && structure.hits < (structure.hitsMax * 0.5)
                        || (structure.structureType == STRUCTURE_RAMPART && structure.hits < RAMPART_DECAY_AMOUNT*RAMPART_DECAY_TIME/3))
                        && (structure.structureType != STRUCTURE_CONTAINER || structure.pos.findInRange(room.getStructures(STRUCTURE_LINK), 3) < 1 || structure.pos.findInRange(FIND_SOURCES, 2).length < 1)
                        && !structure.room.memory.repairQueue.includes(structure.id)) structure.room.memory.repairQueue.push(structure.id);
                });
            });

            return {response: 'idle', time: Game.time + 40 + Math.round(Math.random() * 40)};
        }
    },

    deadCreepHandler: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];
            var creep = getCreep(Memory.oNCreation, 'deadCreepHandler');

            if (!creep || !creep.room.storage) return {response: 'end'};

            if (_.sum(creep.carry) == 0) return creep.suicide();

            if (creep.pos.isNearTo(creep.room.storage)) creep.transfer(creep.room.storage, Object.keys(creep.carry)[Math.floor(Game.time % Object.keys(creep.carry).length)]);
            else creep.moveWithPath(creep.room.storage, {range: 1, repath: 0.01, maxRooms: 1});
        }
    },

    drainer: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            var flag = Game.flags[Memory.f];
            var roomToRally = Memory.RTRLY;

            if (!Memory.complete && (!flag || !room || !roomToRally)) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'drainer' && Game.rooms[f.name.split(' ')[1]])[0];
                Memory.rmN = newFlag ? newFlag.name.split(' ')[1] : undefined;
                Memory.roomToRally = newFlag ? newFlag.name.split(' ')[2] : undefined;
                return newFlag ? Memory.f = newFlag.name : {response: 'end'};
            }

            if (!Memory.creeps) Memory.creeps = [];
            if (!Memory.state) Memory.state = 0; // rally state

            var creeps = Memory.creeps;

            var rallied = 0;

            for (let creep_it_it in creeps) {
                if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                let creep = getCreep(creeps[creep_it_it].split(':')[0], 'scout');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                    continue;
                }
                else if (creep.spawning) continue;

                switch (Memory.state) {
                    case 0:  // rally state
                        if (creep.hits < creep.hitsMax) creep.heal(creep);
                        creep.travelTo(new RoomPosition(21, 21, roomToRally), {range: 5, repath: 0.01});

                        if (creep.pos.roomName == roomToRally) rallied++;
                        break;
                    case 1: //charge state
                        creep.heal();
                        
                        if (creep.pos.roomName != flag.pos.roomName) {
                            if (creep.hits == creep.hitsMax) creep.travelTo(flag, {range: 2, repath: 0.01});
                            else creep.move(creep.pos.getDirectionTo(new RoomPosition(21, 21, creep.room.name)));
                        }
                        else if (creep.room.find(FIND_HOSTILE_SPAWNS).length < 1) Memory.complete = true;
                        break;
                    default:
                        Memory.state = 0;
                }
            }

            if (!Memory.complete && creeps.length < 5) Memory.creeps.push(module.exports.room.addToSQ(room.name, 'drainer'));
            else if (creeps.length >= 5 && creeps.length == rallied) Memory.state = 1;

            if (Memory.complete) {
                flag.remove();
                return {response: 'end'};
            }

        }
    },

    crusher: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            var flag = Game.flags[Memory.f];

            if (!Memory.complete && (!flag || !room)) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'crusher' && Game.rooms[f.name.split(' ')[1]])[0];
                Memory.rmN = newFlag ? newFlag.name.split(' ')[1] : undefined;
                return newFlag ? Memory.f = newFlag.name : {response: 'end'};
            }

            var crusher = getCreep(Memory.crusher, 'crusher');
            var healer = getCreep(Memory.healer, 'crusher');

            if (!Memory.complete && !healer) Memory.healer = module.exports.room.addToSQ(room.name, 'healer', {name: Memory.healer});
            if (!Memory.complete && !crusher) Memory.crusher = module.exports.room.addToSQ(room.name, 'crusher', {name: Memory.crusher});

            if ((Memory.complete && !healer && !crusher) || !flag) {
                if (flag) flag.remove();
                return {response: 'end'};
            }

            if (healer) {
                if (crusher) {
                    if (!healer.pos.isNearTo(crusher) && healer.pos.roomName == crusher.pos.roomName) {
                        healer.moveTo(crusher, {reusePath: 2});
                        if (healer.hits < healer.hitsMax) healer.heal(healer);
                    }
                    else if (healer.pos.roomName != crusher.pos.roomName) {
                        if (!crusher.pos.isNearTo(flag.pos)) crusher.travelTo(flag, {repath: 0.01});
                        if (!healer.pos.isNearTo(flag.pos)) healer.travelTo(crusher, {repath: 0.01});
                    }
                    else {
                        if (crusher.pos.roomName != flag.pos.roomName) {
                            crusher.travelTo(flag, {range: 2, repath: 0.01});
                            healer.move(healer.pos.getDirectionTo(crusher.pos));
                            healer.heal(crusher);
                        }
                        else {
                            healer.move(healer.pos.getDirectionTo(crusher.pos));
                            if (healer.hits < healer.hitsMax) healer.heal(healer);
                            else healer.heal(crusher);

                            var target = Game.getObjectById(Memory.target);

                            if (!target) {
                                var newTarget = crusher.pos.findClosestByPath(crusher.room.getStructures(STRUCTURE_TOWER));
                                if (!newTarget) newTarget = crusher.pos.findClosestByPath(FIND_HOSTILE_SPAWNS);
                                if (!newTarget) newTarget = crusher.pos.findClosestByPath(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())});

                                Memory.target = newTarget ? newTarget.id : undefined;
                                target = newTarget;

                                if (!target) Memory.complete = true;
                            }

                            if (crusher.pos.isNearTo(target)) crusher.attack(target);
                            else crusher.moveTo(target, {maxRooms: 1, reUsePath: 1, ignoreCreeps: true, ignoreRoads: true, swampCost: 1});
                        }
                    }
                }
            }
        }
    },

    remoteBadger: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var roomName = Memory.rmN;
            if (!roomName) return {response: 'end'};
            if (!global[roomName]) global[roomName] = {};

            var nearestRoom = Game.rooms[Memory.nr];
            if (!nearestRoom) {
                var newR = _.min(Game.rooms, (r) => {
                    return r.find(FIND_MY_SPAWNS).length > 0 ? Game.map.findRoute(r.name, roomName).length : Number.POSITIVE_INFINITY;
                });
                Memory.nr = newR ? newR.name : undefined;
                nearestRoom = Game.rooms[Memory.nr];
                roomName = Memory.rmN;
                if (Game.map.findRoute(nearestRoom.name, roomName).length > 10) return {response: 'end'}
            }

            var remoteBadger = getCreep(Memory.remoteBadger, 'remoteBadger');

            if (!remoteBadger) Memory.remoteBadger = module.exports.room.addToSQ(nearestRoom.name, 'remoteBadger', {name: Memory.remoteBadger});

            if (remoteBadger && remoteBadger.pos) {
                if (remoteBadger.pos.roomName != roomName) {
                    remoteBadger.travelTo(new RoomPosition(21, 21, roomName), {range: 21});
                }
                else {
                    var target = remoteBadger.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())});

                    if (!target) return {response: 'idle', time: Game.time+3};

                    remoteBadger.moveTo(target, {range: 0});

                    if (remoteBadger.pos.isNearTo(target)) remoteBadger.attack(target);
                }
            }
        }//TODO TODO TODO REVIEW TODO TODO TODO
    },

    stealEnergy: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            var flag = Game.flags[Memory.f];

            if (!flag || !room) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'steal')[0];
                Memory.rmN = newFlag ? newFlag.name.split(' ')[1] : undefined;
                return newFlag ? Memory.f = newFlag.name : 'end';
            }

            if (Game.creeps[Memory.crp] || room.memory.spawnQueue[Memory.crp]) {
                if (!Game.creeps[Memory.crp]) return;
                var creep = getCreep(Memory.crp, 'stealEnergy');
                if (creep == 'dead') {
                    Memory.crp = undefined;
                    creep = undefined;
return;
                }

                creep.talk('stealEnergy');

                if (_.sum(creep.carry) == 0) creep.memory.w = 1;
                else if (_.sum(creep.carry) >= creep.carryCapacity) creep.memory.w = 0;

                if (creep.memory.w == 1) {
                    if (creep.pos.roomName != flag.pos.roomName) {
                        creep.travelTo(new RoomPosition(25, 25, flag.pos.roomName), {range: 23, repath: 0.01, maxRooms: 16});
                    }
                    else {
                        var thingToStealFrom = creep.room.terminal && creep.room.terminal.store[RESOURCE_ENERGY] ? creep.room.terminal : creep.room.storage && creep.room.storage.store[RESOURCE_ENERGY] ? creep.room.storage : undefined;

                        if (!thingToStealFrom) {
                            flag.remove();
                            return {response: 'end'};
                        }

                        if (creep.pos.isNearTo(thingToStealFrom.pos)) creep.withdraw(thingToStealFrom, RESOURCE_ENERGY);
                        else creep.moveWithPath(thingToStealFrom, {range: 1, repath: 0.01, maxRooms: 1});
                    }
                }
                else {
                    var toPut = room.storage || creep.pos.findClosestByRange(room.getStructures(STRUCTURE_CONTAINER)) || room.find(FIND_MY_SPAWNS)[0];

                    if (creep.pos.isNearTo(toPut)) {
                        if (toPut.structureType == STRUCTURE_SPAWN) {
                            creep.transfer(toPut, RESOURCE_ENERGY);
                        }
                        else {
                            creep.transfer(toPut, Object.keys(creep.carry)[Math.floor(Game.time % Object.keys(creep.carry).length)]);
                        }
                    }
                    else {
                        creep.moveWithPath(toPut, {range: 1, repath: 0.01, maxRooms: 1});
                    }
                }
            }
            else Memory.crp = module.exports.room.addToSQ(room.name, 'stealEnergy');
        }
    },

    claim: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var flag = Game.flags[Memory.f];
            if (!flag) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'claim')[0];
                Memory.nr = undefined;
                return newFlag ? Memory.f = newFlag.name : {response: 'end'};
            }

            if (flag.room && flag.room.controller.my) {
                flag.room.createFlag(flag.pos.x, flag.pos.y, 'buildSpawn ' + flag.room.name, COLOR_PURPLE, COLOR_CYAN);
                flag.remove();
                return {response: 'end'};
            }

            var nearestRoom = Game.rooms[Memory.nr];
            if (!nearestRoom) {
                var newR = _.min(Game.rooms, (r) => {
                    return r.find(FIND_MY_SPAWNS).length > 0 && r.energyCapacityAvailable >= 650 ? Game.map.findRoute(r.name, flag.pos.roomName).length : Number.POSITIVE_INFINITY;
                });
                Memory.nr = newR ? newR.name : undefined;
                nearestRoom = Game.rooms[Memory.nr]
            }

            if (Game.creeps[Memory.crp] || nearestRoom.memory.spawnQueue[Memory.crp]) {
                if (!Game.creeps[Memory.crp]) return;
                var creep = getCreep(Memory.crp, 'claim');
                if (creep == 'dead') {
                    Memory.crp = undefined;
                    creep = undefined;
return;
                }
                creep.talk('claim');

                if (creep.pos.roomName != flag.pos.roomName) {
                    creep.travelTo(new RoomPosition(25, 25, flag.pos.roomName), {range: 23, repath: 0.01, maxRooms: 16});
                }
                else {
                    if (creep.pos.isNearTo(creep.room.controller.pos)) {
                        if (creep.claimController(creep.room.controller) != OK) {
                            if (creep.attackController(creep.room.controller) == OK) return {response: 'idle', time: Game.time + (CONTROLLER_ATTACK_BLOCKED_UPGRADE-Game.map.findRoute(creep.pos.roomName, nearestRoom.name).length*50)};
                        }
                    }
                    else creep.moveWithPath(creep.room.controller, {range: 1, repath: 0.01, maxRooms: 1});
                }
            }
            else Memory.crp = module.exports.room.addToSQ(nearestRoom.name, 'claim');
        }
    },

    buildSpawn: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var flag = Game.flags[Memory.f];
            if (!flag) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'buildSpawn')[0];
                return newFlag ? Memory.f = newFlag.name : {response: 'end'};
            }

            var nearestRoom = Game.rooms[Memory.nr];
            if (!nearestRoom) {
                var newR = _.max(Game.rooms, (r) => {
                    return r.find(FIND_MY_SPAWNS).length > 0 && Game.map.findRoute(r.name, flag.pos.roomName).length < 11 ? r.energyCapacityAvailable : 0;
                });
                Memory.nr = newR ? newR.name : undefined;
                nearestRoom = Game.rooms[Memory.nr]
            }

            if (Game.creeps[Memory.crp] || nearestRoom.memory.spawnQueue[Memory.crp]) {
                if (!Game.creeps[Memory.crp]) return;
                var creep = getCreep(Memory.crp, 'buildSpawn');
                if (creep == 'dead') {
                    Memory.crp = undefined;
                    creep = undefined;
return;
                }
                creep.talk('buildSpawn');

                if (creep.pos.roomName != flag.pos.roomName) {
                    creep.travelTo(new RoomPosition(25, 25, flag.pos.roomName), {range: 23, repath: 0.01, maxRooms: 16});
                }
                else {
                    if (_.sum(creep.carry) == creep.carryCapacity) creep.memory.w = true;
                    else if (_.sum(creep.carry) == 0) creep.memory.w = false;

                    if (creep.memory.w == true) {
                        if (creep.room.controller.ticksToDowngrade && creep.room.controller.ticksToDowngrade <= 2500) {
                            if (creep.pos.getRangeTo(creep.room.controller.pos) < 3) creep.upgradeController(creep.room.controller);
                            else creep.moveWithPath(creep.room.controller, {range: 2, repath: 0.01, maxRooms: 1});
                        }
                        else if (flag.room.find(FIND_MY_SPAWNS).length < 1) {
                            if (!flag.pos.findInRange(FIND_CONSTRUCTION_SITES, 1)[0]) return this.placeSpawn1(flag.pos);

                            if (creep.pos.getRangeTo(flag.pos) < 3) creep.build(flag.pos.findInRange(FIND_CONSTRUCTION_SITES, 1)[0]);
                            else creep.moveWithPath(flag, {range: 2, repath: 0.01, maxRooms: 1});
                        }
                        else {
                            if (creep.pos.getRangeTo(creep.room.controller.pos) < 3) creep.upgradeController(creep.room.controller);
                            else creep.moveWithPath(creep.room.controller, {range: 2, repath: 0.01, maxRooms: 1});
                        }
                    }
                    else {
                        var source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                        if (source) {
                            if (creep.pos.isNearTo(source)) creep.harvest(source);
                            else creep.travelTo(source, {range: 1, maxRooms: 1, ignoreCreeps: false})
                        }
                    }
                }
            }
            else {
                if (!flag.room || flag.room.find(FIND_MY_SPAWNS) < 1) Memory.crp = module.exports.room.addToSQ(nearestRoom.name, 'buildSpawn');
                else {
                    flag.remove();
                    return {response: 'end'};
                 }
            }
        },

        placeSpawn1: function (flagPos) {
            if (_.size(Game.constructionSites) < 100) {
                let pos = new RoomPosition(flagPos.x + 1, flagPos.y, flagPos.roomName);
                Game.rooms[flagPos.roomName].createConstructionSite(pos.x, pos.y, STRUCTURE_SPAWN);
            }
        }
    },

    //room processes

    room: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};

            if (!room.memory.spawnQueue) room.memory.spawnQueue = {};

            if (!global[room.name]) global[room.name] = {};

            if (!global[room.name].distrSquareFlag) global[room.name].distrSquareFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];

            if (Game.time % 3 == 0
                && (
                        (room.find(FIND_HOSTILE_CREEPS).length > 0 && room.find(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())}).length > 0)
                        ||
                        (room.find(FIND_CREEPS, {filter: (c) => c.hits < c.hitsMax && (c.my || global.allies.includes(c.owner.username.toLowerCase()))}).length > 0)
                    )
                && !processExists('doTowers', Memory.rmN)) spawnNewProcess('doTowers', Memory.rmN);

            if (room.memory.type == 'jump') {
                if (!processExists('doHarvest', Memory.rmN)) spawnNewProcess('doHarvest', Memory.rmN);
                if (!processExists('takeCare', Memory.rmN)) spawnNewProcess('takeCare', Memory.rmN);
                if (!processExists('fillSpawn', Memory.rmN)) spawnNewProcess('fillSpawn', Memory.rmN);
                if (!processExists('fillExt', Memory.rmN)) spawnNewProcess('fillExt', Memory.rmN);

                if (room.controller.level >= 2 && global[room.name].distrSquareFlag && !processExists('placeExtensions', Memory.rmN)) spawnNewProcess('placeExtensions', Memory.rmN);
                if ((room.controller.level < 8 || room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[room.controller.level] * 0.5) && !processExists('praiseRC', Memory.rmN)) spawnNewProcess('praiseRC', Memory.rmN);
            }
            else {
                if (room.controller.level < 8) delete room.memory.minimal;

                if (!room.memory.minimal && Game.time % 11 == 0) {
                    if (room.storage) {
                        if (room.terminal && room.controller.level >= 8 && !processExists('doTerminal', Memory.rmN)) spawnNewProcess('doTerminal', Memory.rmN);
                        if (room.terminal && !processExists('doLabs', Memory.rmN)) spawnNewProcess('doLabs', Memory.rmN);
                        if (room.terminal && !processExists('shuffleOrdering', Memory.rmN)) spawnNewProcess('shuffleOrdering', Memory.rmN);

                        var mineral = room.find(FIND_MINERALS)[0];
                        if (mineral && room.controller.level >= 6 && ((mineral.mineralAmount > 1 || mineral.ticksToRegeneration < 200) && !processExists('mine', Memory.rmN))) spawnNewProcess('mine', Memory.rmN);
                    }

                    if (!processExists('scout', Memory.rmN)) spawnNewProcess('scout', Memory.rmN);

                    if (!processExists('doHarvest', Memory.rmN)) spawnNewProcess('doHarvest', Memory.rmN);
                    if (!processExists('takeCare', Memory.rmN)) spawnNewProcess('takeCare', Memory.rmN);
                    if (!processExists('fillSpawn', Memory.rmN)) spawnNewProcess('fillSpawn', Memory.rmN);
                    if (!processExists('fillExt', Memory.rmN)) spawnNewProcess('fillExt', Memory.rmN);
                    if (!processExists('buildRoads', Memory.rmN)) spawnNewProcess('buildRoads', Memory.rmN);
                    if ((room.controller.level < 8 || room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[room.controller.level] * 0.5) && !processExists('praiseRC', Memory.rmN)) spawnNewProcess('praiseRC', Memory.rmN);

                    if (room.controller.level >= 4 && room.getStructures(STRUCTURE_LINK).length < 3 && global[room.name].distrSquareFlag && !processExists('iRmHaul', Memory.rmN)) spawnNewProcess('iRmHaul', Memory.rmN);

                    if (room.controller.level >= 2 && global[room.name].distrSquareFlag && !processExists('placeExtensions', Memory.rmN)) spawnNewProcess('placeExtensions', Memory.rmN);
                    if (room.controller.level >= 2 && !room.storage && !Game.flags[global[room.name].distrSquareFlag] && !processExists('placeStorage', Memory.rmN)) spawnNewProcess('placeStorage', Memory.rmN);
                    if (room.controller.level >= 3 && global[room.name].distrSquareFlag && !processExists('placeTowers', Memory.rmN)) spawnNewProcess('placeTowers', Memory.rmN);

                    if (!processExists('strgDistr', Memory.rmN)) spawnNewProcess('strgDistr', Memory.rmN);
                    if (room.controller.level >= 5 && !processExists('doLinks', Memory.rmN)) spawnNewProcess('doLinks', Memory.rmN);
                    if (room.controller.level >= 8 && room.getStructures(STRUCTURE_POWER_SPAWN).length > 0 && !processExists('doPowerProc', Memory.rmN)) spawnNewProcess('doPowerProc', Memory.rmN);
                }
                else if (room.memory.minimal && Game.time % 11 == 0) {
                    if (!processExists('doHarvest', Memory.rmN)) spawnNewProcess('doHarvest', Memory.rmN);
                    if (!processExists('minimalist', Memory.rmN)) spawnNewProcess('minimalist', Memory.rmN);
                    if (!processExists('strgDistr', Memory.rmN)) spawnNewProcess('strgDistr', Memory.rmN);
                    if (!processExists('takeCare', Memory.rmN)) spawnNewProcess('takeCare', Memory.rmN);
                    if (room.terminal && !processExists('doTerminal', Memory.rmN)) spawnNewProcess('doTerminal', Memory.rmN);
                }
            }

            this.spawn(Memory_it);
            
            if (Game.cpu.bucket > 5000) this.doStats(room);
            
            if (Game.time % 113 == 0 && Game.market.credits > 10000 && room.controller.level >= 6 && room.terminal && room.storage && room.find(FIND_MINERALS)[0]) {
                var mineralType = room.find(FIND_MINERALS)[0].mineralType;
                
                if (room.storage.store[mineralType] > 200000) { //arbitrary amount
                    var roomsOrder = Game.market.orders[Memory.roomOrderIdForMarketDumping];
                    
                    if (!roomsOrder) {
                        var foundOrder = _.filter(Game.market.orders, (o) => o.type == ORDER_SELL && o.resourceType == mineralType && o.roomName == room.name && o.price == 0.005)[0];
                        
                        if (foundOrder) {
                            Memory.roomOrderIdForMarketDumping = foundOrder.id;
                        }
                        else {
                            Game.market.createOrder(ORDER_SELL, mineralType, 0.005, 100000, room.name);
                        }
                    }
                    else {
                        var amountToExtend = 100000-roomsOrder.remainingAmount;
                        
                        if (amountToExtend > 50000) {
                            Game.market.extendOrder(roomsOrder.id, amountToExtend);
                        }
                    }
                }
            }
            
//             if (room.controller.level < 8 && room.terminal && room.terminal.store.energy < 50000) {
//                 if (!global.needsEnergy) global.needsEnergy = {};
//                 global.needsEnergy[room.name] = 50000-room.terminal.store.energy;
//             }
        },

        addToSQ: function (roomName, process, creepMem = {}) {
            var room = Game.rooms[roomName];
            if (!room) throw new Error('ERROR addToSQ Passed Bad roomName');

            while (!creepMem.name || Game.creeps[creepMem.name]) creepMem.name = roomName + ((Game.time % 1000) + '' + Math.round(Math.random() * 1000));

            creepMem.body = processSpawn.run(Game.rooms[roomName], _.clone(getBodyChart(Game.rooms[roomName])[process][0]), _.clone(getBodyChart(Game.rooms[roomName])[process][1]),
                (process == 'praiseRC' && Game.rooms[roomName] && Game.rooms[roomName].controller.level >= 8 ? 15 : _.clone(getBodyChart(Game.rooms[roomName])[process][2])));

            creepMem.proc = process;

            if (!room.memory.spawnQueue[creepMem.name]) room.memory.spawnQueue[creepMem.name] = creepMem;

            return creepMem.name;
        },

        spawn: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];
            var room = Game.rooms[Memory.rmN];

            var nextToSpawn = _.sortBy(room.memory.spawnQueue, (c) => {
                if (!c.body || !c.body.cost || c.body.cost > room.energyCapacityAvailable) return Number.POSITIVE_INFINITY;
                return c.proc == 'doHarvest'|| c.proc == 'defendRoom' ? 0 : c.proc == 'fillSpawn' ? 1 : c.proc == 'strgDistr' ? 2 : c.proc == 'fillExt' ? 3 : c.proc == 'claim' || c.proc == 'guards'  || c.proc == 'scout' ? 4 : c.proc == 'praiseRC' && room.controller.ticksToDowngrade*2 >= CONTROLLER_DOWNGRADE && room.controller.progress < room.controller.progressTotal ? 6 : c.proc == 'doLabs' ? 7 : 5;
            })[0];

            if (!nextToSpawn) return;
            if (Game.creeps[nextToSpawn.name] || !nextToSpawn.body || !nextToSpawn.proc) return delete room.memory.spawnQueue[nextToSpawn.name];

            var spawn = room.find(FIND_MY_SPAWNS, {filter: (s) => !s.spawning})[0];

            if (!spawn) return;

            switch (processSpawn.canAfford(room, nextToSpawn.body.cost)) {
                case 2:
                    //cannot afford yet
                    return;
                case 3:
                    nextToSpawn.body = processSpawn.reCalcBody(room.energyAvailable, _.clone(getBodyChart(room)[nextToSpawn.proc][0]), _.clone(getBodyChart(room)[nextToSpawn.proc][1]), _.clone(getBodyChart(room)[nextToSpawn.proc][2]));
                    break;
            }
            
            var result = spawn.spawnCreep(nextToSpawn.body.body, nextToSpawn.name, { 
                memory: {p: nextToSpawn.proc},
                energyStructures: room.find(FIND_MY_SPAWNS).concat(room.getStructures(STRUCTURE_EXTENSION))
            });

            if (result == OK) console.logSpawn(room, nextToSpawn.name + ' ' + nextToSpawn.proc);
            else if (result == -6 || result == -10) delete room.memory.spawnQueue[nextToSpawn.name];
        },

        doStats: function (room) {
            if (!global.stats.rooms[room.name]) global.stats.rooms[room.name] = {};

            global.stats.rooms[room.name].controller = {
                level: room.controller.level,
                ticksToDowngrade: room.controller.ticksToDowngrade,
                progress: room.controller.progress,
                progressTotal: room.controller.progressTotal
            };

            var sortedCreeps = _.groupBy(room.find(FIND_MY_CREEPS), (creep) => {return creep.memory.p});

            for (let group in sortedCreeps) {
                sortedCreeps[group] = _.size(sortedCreeps[group]);
            }

            global.stats.rooms[room.name].creeps = sortedCreeps;
            global.stats.rooms[room.name].storage = room.storage ? room.storage.store : {};
            global.stats.rooms[room.name].terminal = room.terminal ? room.terminal.store : {};

            global.stats.rooms[room.name].energyAvailable = room.energyAvailable;
            global.stats.rooms[room.name].energyCapacityAvailable = room.energyCapacityAvailable;
        }
    },

    scout: {
        run: function (Memory_it) {return {response: 'idle', time: Game.time+101};
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};

            if (!Memory.creeps) Memory.creeps = [];
            if (!Memory.scoutQueue) Memory.scoutQueue = _.map(Game.map.describeExits(room.name), (rN) => rN);

            var toScout = Memory.toScout;

            if (!toScout) this.getNewRoomToScout(Memory);

            if (Game.rooms[toScout]) {
                var roomScouting = Game.rooms[toScout];

                //add rooms to scoutQueue if not already in and also if near enough to home room
                _.forEach(Game.map.describeExits(toScout), (roomName) => {
                    if (!_.includes(Memory.scoutQueue, roomName) && Game.map.getRoomLinearDistance(room.name, roomName) < SCOUT_LINEAR_DISTANCE) Memory.scoutQueue.push(roomName);
                });


                var whoOwnsRoom = !roomScouting.controller ? OWNED_IMPOSSIBLE : roomScouting.controller.my ? OWNED_ME : roomScouting.controller.owner ? _.includes(global.allies, roomScouting.controller.owner.username) ? OWNED_ALLY : OWNED_ENEMY : OWNED_NEUTRAL;

                roomScouting.memory.scoutData = {
                    lastCheck: Game.time,
                    owned: whoOwnsRoom
                };

                var sources = roomScouting.find(FIND_SOURCES);
                if (sources && sources.length > 0) roomScouting.memory.scoutData.sources = {
                    amount: sources.length
                };

                var powerBank = roomScouting.getStructures(STRUCTURE_POWER_BANK)[0];
                if (powerBank) roomScouting.memory.scoutData.powerBank = {
                    power: powerBank.power,
                    decayTime: Game.time + powerBank.ticksToDecay
                };

                var mineral = roomScouting.find(FIND_MINERALS)[0];
                if (mineral) roomScouting.memory.scoutData.mineral = {
                    mineralType: mineral.mineralType
                };

                Memory.toScout = undefined;
                if (Memory.cutOut) delete Memory.cutOut;

                this.getNewRoomToScout(Memory);
                toScout = Memory.toScout;
            }

            if (!toScout) return;

            var observer = room.getStructures(STRUCTURE_OBSERVER)[0];

            if (observer) {
                observer.observeRoom(toScout);
            }
            else {

                var creeps = Memory.creeps;

                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'scout');
                    if (creep == 'dead') {
                        creep = undefined;
                    }

                    if (!creep) {
                        if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        continue;
                    }
                    else if (creep.spawning) continue;

                    if (!creep.memory.notifyingOnDeath) {
                        if (creep.notifyWhenAttacked(false) == OK) creep.memory.notifyingOnDeath = 1;
                    }

                    creep.talk('scout');


                    if (creep.pos.roomName != toScout) {
                        var rsl = creep.travelTo(new RoomPosition(21, 21, toScout), {range: 21, repath: 0.01});

                        if (Game.time % 1001 && Game.map.getRoomLinearDistance(creep.room.name, toScout) < 2) Memory.cutOut = Game.time + (Game.map.getRoomLinearDistance(creep.room.name, toScout) * 75);

                        if (rsl == ERR_NO_PATH || Game.time > Memory.cutOut) {
                            if (!global.Mem[toScout]) global.Mem[toScout] = {};
                            global.Mem[toScout].scoutData = {lastCheck: Game.time + 1001};
                            Memory.toScout = undefined;
                            delete Memory.cutOut;
                        }
                    }
                }

                if (Memory.creeps.length < 1) Memory.creeps.push(module.exports.room.addToSQ(room.name, 'scout'));
            }
        },

        getNewRoomToScout: function (Memory) {
            var newRoom = {};

            _.forEach(Memory.scoutQueue, (r) => {
                var lastCheck = Memory.rooms && Memory.rooms[r] && Memory.rooms[r].scoutData && Memory.rooms[r].scoutData.lastCheck ? Memory.rooms[r].scoutData.lastCheck : 0;
                if (!newRoom.lastCheck || lastCheck < newRoom.lastCheck) newRoom = {r, lastCheck};
            });

            Memory.toScout = newRoom.r;
            return Memory.toScout;
        }
    },

    doTowers: {
        killIdiot: function (tower, idiot) {
            if (!tower || !idiot || tower.energy == 0) return;
            tower.attack(idiot);
        },

        healIdiot: function (tower, idiot) {
            if (!tower || !idiot || tower.energy == 0) return;
            tower.heal(idiot);
        },

        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];

            var baddies = room.find(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())});

            var toHeal = room.find(FIND_CREEPS, {filter: (c) => c.hits < c.hitsMax && (c.my || global.allies.includes(c.owner.username.toLowerCase()))});

            if (!room || (baddies.length < 1 && toHeal.length < 1)) {
                if (Memory.counter >= 7) return {response: 'end'};
                else return Memory.counter = Memory.counter+1 || 1;
            }

            if (!global[room.name]) global[room.name] = {};
            if (room.getStructures(STRUCTURE_TOWER).length < 1) return {response: 'end'};

            if (baddies) {
                _.forEach(room.getStructures(STRUCTURE_TOWER), (tower) => {
                    this.killIdiot(tower, tower.pos.findClosestByRange(baddies));
                });

                if (!processExists('defendRoom', Memory.rmN) && _.filter(baddies, (c) => c.hasActiveBodyparts(HEAL)).length > 0) spawnNewProcess('defendRoom', Memory.rmN);
            }
            else if (toHeal) {
                _.forEach(room.getStructures(STRUCTURE_TOWER), (tower) => {
                    this.healIdiot(tower, tower.pos.findClosestByRange(toHeal));
                });
            }
        }
    },

    defendRoom: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room || (room.find(FIND_HOSTILE_CREEPS).length < 1 && !Memory.creeps)) {
                if (Memory.counter >= 7) return {response: 'end'};
                else return Memory.counter = Memory.counter+1 || 1;
            }
            if (!global[room.name]) global[room.name] = {};
            if (!Memory.creeps) Memory.creeps = [];

            var baddies = room.find(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())});
            if (baddies.length < 1) {
                Memory.waiting = Memory.waiting+1 || 1;
            }
            
            if (Memory.waiting > 500) return {response: 'end'};
            
            var creeps = Memory.creeps;

            for (let creep_it_it in creeps) {
                if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                let creep = getCreep(creeps[creep_it_it].split(':')[0], 'defendRoom');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                    continue;
                }
                else if (creep.spawning) continue;

                creep.talk('defendRoom');

                var myBaddy = creep.pos.findClosestByRange(baddies);
                if (myBaddy && (myBaddy.getActiveBodyparts(ATTACK)+myBaddy.getActiveBodyparts(RANGED_ATTACK))/2 > creep.getActiveBodyparts(RANGED_ATTACK)+creep.getActiveBodyparts(ATTACK)) {            
                    if (creep.pos.isNearTo(myBaddy)) creep.attack(myBaddy);
                    else creep.moveTo(myBaddy, {reusePath: 2});
                }
                else creep.runInSquares();
            }

            if (Memory.creeps.length < baddies.length) Memory.creeps.push(module.exports.room.addToSQ(room.name, 'defendRoom'));
        }
    },

    placeStorage: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0]) return {response: 'end'};

            const freeRange = 2;
            var bestPos;

            for (let x = 3; x < 46; x++) {
                for (let y = 3; y < 46; y++) {
                    let pos = new RoomPosition(x, y, room.name);

                    let exits = pos.findInRange(FIND_EXIT, freeRange);
                    if (exits.length > 0) continue;

                    let structs = pos.findInRange(FIND_STRUCTURES, freeRange, {filter: (s) => s.structureType != STRUCTURE_ROAD});
                    if (structs.length > 0) continue;

                    let flags = pos.findInRange(FIND_FLAGS, 4);
                    if (flags.length > 0) continue;

                    let terrain = _.filter(room.lookForAtArea(LOOK_TERRAIN, y - freeRange, x - freeRange, y + freeRange, x + freeRange, true), (p) => p.type == 'terrain' && p.terrain == 'wall');
                    if (terrain.length > 0) continue;

                    let goodPos = new RoomPosition(x, y, room.name);

                    let toSource = [];
                    let toController;

                    _.forEach(room.find(FIND_SOURCES), (s) => {
                        toSource.push(goodPos.getRangeTo(s.pos));
                    });

                    toController = room.findPath(goodPos, room.controller.pos, {ignoreCreeps: true, ignoreRoads: true, maxRooms: 1}).length;

                    let cnt = 0;

                    if (!bestPos) {
                        bestPos = {
                            x: goodPos.x,
                            y: goodPos.y,
                            c: toController,
                            s: toSource
                        }
                    }

                    for (let foo in toSource) {
                        if (bestPos.s[foo] > toSource[foo]) cnt++;
                    }

                    if (cnt >= 2 || (cnt >= 1 && toController <= bestPos.c) || toController*2 <= bestPos.c) {
                        bestPos = {

                            x: goodPos.x,
                            y: goodPos.y,
                            c: toController,
                            s: toSource
                        }
                    }
                }
            }

            room.createFlag(bestPos.x, bestPos.y, 'distrSquare:' + room.name, COLOR_PURPLE, COLOR_BLUE);
        }
    },

    placeTowers: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};

            var spawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
            var storageFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!spawnFlag || !storageFlag) return;

            if (!Memory.toDo) Memory.toDo = 0;
            if (!Memory.toDoQ) Memory.toDoQ = [[spawnFlag.pos.x, spawnFlag.pos.y], [storageFlag.pos.x, storageFlag.pos.y], [room.controller.pos.x, room.controller.pos.y]]
                .concat(_.map(room.find(FIND_SOURCES), (s) => {return [s.pos.x, s.pos.y]}));

            if (room.getStructures(STRUCTURE_TOWER).length < CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level]) {
                this.placeTower(room, new RoomPosition(Memory.toDoQ[Memory.toDo][0], Memory.toDoQ[Memory.toDo][1], room.name));
                Memory.toDo = Memory.toDo+1 > Memory.toDoQ.length-1 ? 0 : Memory.toDo+1;
            }

            return {response: 'idle', time: Game.time + 1000 + Math.round(Math.random()*1000)};
        },

        placeTower: function (room, startPos) {
            var goals = [{
                pos: startPos,
                range: Math.round(2 + Math.random() * 2)
            }].concat(_.map(room.find(FIND_STRUCTURES), (s) => {
                return {pos: s.pos, range: Math.round(2 + Math.random() * 2)};
            }))
                .concat(_.map(room.find(FIND_CONSTRUCTION_SITES), (s) => {
                    return {pos: s.pos, range: 5};
                }))
                .concat(_.map(room.find(FIND_SOURCES), (s) => {
                    return {pos: s.pos, range: 5};
                }))
                .concat(_.map(room.find(FIND_MINERALS), (s) => {
                    return {pos: s.pos, range: 3};
                }))
                .concat(_.map(room.find(FIND_CREEPS), (s) => {
                    return {pos: s.pos, range: 2};
                }))
                .concat(_.map(room.find(FIND_FLAGS), (s) => {
                    return {pos: s.pos, range: Math.round(4 + Math.random() * 2)};
                }));

            var path = PathFinder.search(startPos, goals, {
                flee: true,
                swampCost: 1,
                plainCost: 1,
                maxRooms: 1
            });

            var newPos = new RoomPosition(path.path[path.path.length-1].x, path.path[path.path.length-1].y, room.name);

            room.createConstructionSite(newPos, STRUCTURE_TOWER)
        }
    },

    placeExtensions: {
        buildings:{
            [STRUCTURE_EXTENSION]:[{"x":4,"y":0},{"x":5,"y":0},{"x":6,"y":0},{"x":3,"y":1},{"x":4,"y":1},{"x":6,"y":1},{"x":7,"y":1},{"x":2,"y":2},{"x":3,"y":2},{"x":5,"y":2},{"x":7,"y":2},{"x":8,"y":2},{"x":1,"y":3},{"x":2,"y":3},{"x":4,"y":3},{"x":5,"y":3},{"x":6,"y":3},{"x":8,"y":3},{"x":9,"y":3},{"x":0,"y":4},{"x":1,"y":4},{"x":3,"y":4},{"x":4,"y":4},{"x":5,"y":4},{"x":7,"y":4},{"x":9,"y":4},{"x":10,"y":4},{"x":2,"y":5},{"x":3,"y":5},{"x":4,"y":5},{"x":6,"y":5},{"x":7,"y":5},{"x":8,"y":5},{"x":0,"y":6},{"x":1,"y":6},{"x":3,"y":6},{"x":5,"y":6},{"x":6,"y":6},{"x":7,"y":6},{"x":9,"y":6},{"x":10,"y":6},{"x":1,"y":7},{"x":2,"y":7},{"x":4,"y":7},{"x":5,"y":7},{"x":6,"y":7},{"x":8,"y":7},{"x":9,"y":7},{"x":2,"y":8},{"x":3,"y":8},{"x":5,"y":8},{"x":7,"y":8},{"x":8,"y":8},{"x":3,"y":9},{"x":4,"y":9},{"x":6,"y":9},{"x":7,"y":9},{"x":4,"y":10},{"x":5,"y":10},{"x":6,"y":10}],
            [STRUCTURE_ROAD]:[{"x":5,"y":1},{"x":4,"y":2},{"x":6,"y":2},{"x":3,"y":3},{"x":7,"y":3},{"x":2,"y":4},{"x":8,"y":4},{"x":1,"y":5},{"x":9,"y":5},{"x":2,"y":6},{"x":8,"y":6},{"x":3,"y":7},{"x":7,"y":7},{"x":4,"y":8},{"x":6,"y":8},{"x":5,"y":9}],
            [STRUCTURE_LINK]:[{"x":5,"y":5}],
            [STRUCTURE_CONTAINER]:[{"x":6,"y":4},{"x":4,"y":6}]},

        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};

            var flag = room.extensionFlag;
            if (!flag) {
                this.placeFlag(room);
                return {response: 'idle', time: Game.time + 5};
            }

            var amountToBuild = 100 - _.size(Game.constructionSites);

            for (let structureType in this.buildings) {
                if ((structureType != STRUCTURE_EXTENSION && room.controller.level < 5) || (structureType == STRUCTURE_LINK && room.controller.level < 7)) continue;
                
                for (let posXYRAW of this.buildings[structureType]) {
                    let posXY = {x: flag.pos.x+posXYRAW.x, y: flag.pos.y+posXYRAW.y};

                    if (amountToBuild <= 0) return {response: 'idle', time: Game.time + 101};
                    if (room.getStructures(structureType).length >= CONTROLLER_STRUCTURES[structureType][room.controller.level]) break;

                    if (room.lookForAt(LOOK_STRUCTURES, posXY.x, posXY.y).length < 1 && room.lookForAt(LOOK_CONSTRUCTION_SITES, posXY.x, posXY.y).length < 1) {
                        if (room.createConstructionSite(posXY.x, posXY.y, structureType) == ERR_RCL_NOT_ENOUGH) break;
                        console.roomLog(room, 'Places Construcion Site ' + structureType + ' At ' + posXY.x + ' ' + posXY.y);
                        amountToBuild--;
                    }
                }
            }

            return room.controller.level < 8 ? {response: 'idle', time: Game.time + Math.round((1-(room.controller.progress/room.controller.progressTotal))*5003)} : {response: 'idle', time: Game.time + 5003};
        },

        placeFlag: function (room) {
            const freeRange = 10;
            var bestPos;

            for (let x = 1; x < 40; x++) {
                for (let y = 1; y < 40; y++) {
                    let structures = _.filter(room.lookForAtArea(LOOK_STRUCTURES, y, x, y + freeRange, x + freeRange, true), (s) => s.structureType != STRUCTURE_EXTENSION && s.structureType != STRUCTURE_ROAD);
                    if (structures.length > 0) continue;

                    let flags = room.lookForAtArea(LOOK_FLAGS, y, x, y + freeRange, x + freeRange, true);
                    if (flags.length > 0) continue;

                    let terrain = _.filter(room.lookForAtArea(LOOK_TERRAIN, y, x, y + freeRange, x + freeRange, true), (p) => p.type == 'terrain' && p.terrain == 'wall');
                    if (terrain.length > 0) continue;

                    let goodPos = new RoomPosition(x, y, room.name);

                    let toSource = [];

                    _.forEach(room.find(FIND_SOURCES), (s) => {
                        toSource.push(room.findPath(goodPos, s.pos, {ignoreCreeps: true, ignoreRoads: true, maxRooms: 1}).length);
                    });

                    let cnt = 0;

                    if (!bestPos) {
                        bestPos = {
                            x: goodPos.x,
                            y: goodPos.y,
                            s: toSource
                        }
                    }

                    for (let foo in toSource) {
                        if (bestPos.s[foo] > toSource[foo]) cnt++;
                    }

                    if (cnt >= 1) {
                        bestPos = {

                            x: goodPos.x,
                            y: goodPos.y,
                            s: toSource
                        }
                    }
                }
            }
            
            if (!bestPos) console.notify('Unable to place extension flag in room ' + room.name);
            
            room.createFlag(bestPos.x, bestPos.y, 'extensionFlag:' + room.name, COLOR_YELLOW, COLOR_ORANGE);

            console.notify('Places extension flag,\nROOM: ' + room.name + '\nAt Position: ' + bestPos.x + ' ' + bestPos.y);
        }
    },

    buildRoads: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};

            var spawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
            var storageFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!spawnFlag || !storageFlag) return;

            var costMatrix = this.getCostMatrix(room.name, storageFlag, spawnFlag);

            switch (Memory.nb) {
                case 1:
                    Memory.nb++;

                    if (!room.find(FIND_SOURCES)[1]) break;

                    var structure = room.find(FIND_SOURCES)[0];
                    _.forEach(room.find(FIND_SOURCES)[1].pos.findPathTo(structure, {range: 2, ignoreCreeps: true, ignoreRoads: false, plainCost: 1, swampCost: 1, costCallback: costMatrix}), (pathData) => {
                        if (_.size(Game.constructionSites) < 100) {
                            if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]
                                && _.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_TERRAIN), (s) => s == 'swamp')[0]) room.createConstructionSite(pathData.x, pathData.y, STRUCTURE_ROAD);
                        }
                    });
                    break;
                case 0:
                    Memory.nb++;
                    _.forEach(room.find(FIND_SOURCES), (structure) => {
                        _.forEach(storageFlag.pos.findPathTo(structure, {range: 2, ignoreCreeps: true, ignoreRoads: false, plainCost: 1, swampCost: 1, costCallback: costMatrix}), (pathData) => {
                            if (_.size(Game.constructionSites) < 100) {
                                if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]
                                    && _.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_TERRAIN), (s) => s == 'swamp')[0]) room.createConstructionSite(pathData.x, pathData.y, STRUCTURE_ROAD);
                            }
                        });
                    });
                    break;
                default:
                    Memory.nb = 0;
                    if (room.controller.level < 4) return;
                    _.forEach(storageFlag.pos.findPathTo(spawnFlag, {range: 2, ignoreCreeps: true, ignoreRoads: false, plainCost: 1, swampCost: 1}), (pathData) => {
                        if (_.size(Game.constructionSites) < 100) {
                            if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]) room.createConstructionSite(pathData.x, pathData.y, STRUCTURE_ROAD);
                        }
                    });
            }

            return {response: 'idle', time: Game.time + 10000 + Math.round(Math.random()*57)};
        },
        
        getCostMatrix: function (roomName, storageFlag, spawnFlag) {
            var room = Game.rooms[roomName];
            if (!room) return;
            if (!global[room.name]) global[room.name] = {};

            var costs = new PathFinder.CostMatrix;

            room.find(FIND_STRUCTURES).forEach(function(struct) {
                if ((struct.structureType !== STRUCTURE_RAMPART || !struct.my)) {
                    // Can't walk through non-walkable buildings
                    costs.set(struct.pos.x, struct.pos.y, 0xff);
                }
            });

            _.forEach([{x: 0, y: 0}, {x: 1, y: 1}, {x: 1, y: 0}, {x: 1, y: -1}, {x: 0, y: -1}, {x: -1, y: -1,}, {x: -1, y: 0}, {x: -1, y: 1}, {x: 1, y: -1}], (struc) => {
                costs.set(storageFlag.pos.x + struc.x, storageFlag.pos.y + struc.y, 0xff);
            });

            _.forEach([{x: 0, y: 0}, {x: 1, y: 0}, {x: 1, y: -1}, {x: 0, y: -1}, {x: -1, y: -1,}, {x: -1, y: 0}], (struc) => {
                costs.set(spawnFlag.pos.x + struc.x, spawnFlag.pos.y + struc.y, 0xff);
            });

            _.forEach(room.find(FIND_SOURCES), (structure) => {
                _.forEach([{x: 0, y: 0}, {x: 0, y: 1}, {x: 1, y: 0}, {x: 1, y: 1}, {x: -1, y: 0}, {x: 0, y: -1}, {x: -1, y: -1}], (struc) => {
                    costs.set(structure.pos.x + struc.x, structure.pos.y + struc.y, 0xff);
                });
            });


            return costs;
        }
    },
    
    doLinks: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};

            var links = room.getStructures(STRUCTURE_LINK);

            var full = [];
            var empty = [];

            for (let link of links) {
                if (link.energy >= link.energyCapacity) full.push(link);
                else if (link.energy <= link.energyCapacity*0.5 && link.pos.findInRange(FIND_SOURCES, 2).length < 1) empty.push(link);
            }

            for (var full_it in full) {
                var fullLink = full[full_it];
                var emptyLink = empty[full_it];

                if (!fullLink || !emptyLink) break;

                fullLink.transferEnergy(emptyLink);
            }

            if (full.length < 1 || empty.length < 1) return {response: 'idle', time: Game.time + 11};
            else return {response: 'idle', time: Game.time + 3};

        }
    },

    doLabs: {
        labPositions: [{"x": 1, "y": 0}, {"x": 2, "y": 0}, {"x": 0, "y": 1}, {"x": 3, "y": 1}, {"x": 0, "y": 2}, {"x": 3, "y": 2}, {"x": 1, "y": 3}, {"x": 2, "y": 3}],

        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room || !room.storage || !room.terminal || room.controller.level < 6) return {response: 'end'};

            var flag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'labFlag'})[0];

            if (!flag) return this.placeFlag(room);

            var lab1 = _.filter(room.getPositionAt(flag.pos.x+2, flag.pos.y+1).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_LAB)[0];
            var lab2 = _.filter(room.getPositionAt(flag.pos.x+1, flag.pos.y+2).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_LAB)[0];

            if (!lab1 || !lab2) {
                var rsl1 = room.createConstructionSite(room.getPositionAt(flag.pos.x + 2, flag.pos.y + 1), STRUCTURE_LAB);
                var rsl2 = room.createConstructionSite(room.getPositionAt(flag.pos.x + 1, flag.pos.y + 2), STRUCTURE_LAB);

                if (rsl1 == OK && rsl2 == OK) return {response: 'idle', time: Game.time + 1001};
                else return {response: 'idle', time: Game.time + 7};
            }

            if (Game.time % 1201 == 0 || !Memory.lastLevel || Memory.lastLevel != room.controller.level) {
                Memory.lastLevel = room.controller.level;
                this.placeStrucs(room, flag);
            }

            if (!Memory.mineral1 || !Memory.mineral2) {
                var newMinerals = this.choosingCompound(room);

                if (!newMinerals || !newMinerals[0] || !newMinerals[1]) return {response: 'idle', time: Game.time + 11};

                Memory.mineral1 = newMinerals[0];
                Memory.mineral2 = newMinerals[1];

                Memory.state = 'empty';
            }


            var creeps = Memory.crps ? Memory.crps : undefined;
            if (!creeps) Memory.crps = []; creeps = Memory.crps;


            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'doLabs');
                    if (creep == 'dead') {
                        creep = undefined;
                    }

                    if (!creep) {
                        if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        continue;
                    }
                    else if (creep.spawning) continue;

                    creep.talk('doLabs');

                    switch (Memory.state) {
                        case 'fill':
                            if (this.fillLabs(creep, room, lab1, lab2, Memory.mineral1, Memory.mineral2) == 'done') Memory.state = 'react';
                            break;
                        case 'empty':
                            if (this.emptyLabs(creep, room) == 'done') Memory.state = 'fill';
                            break;
                        case 'react':
                            if (lab2.mineralAmount < 100) this.emptyLabs(creep, room, creep.pos.findClosestByRange(room.getStructures(STRUCTURE_LAB, (s) => s.mineralAmount > 0 && s.id != lab1.id && s.id != lab2.id)));
                            break;
                        default: // reset
                            Memory.state = 'empty';
                    }
                }
            }

            //get more creeps
            if (Memory.state != 'react' && creeps.length < 1) Memory.crps.push(module.exports.room.addToSQ(room.name, 'doLabs'));

            if (Memory.state == 'react') {
                var labToReactWith = room.getStructures(STRUCTURE_LAB, (s) => s.id != lab1.id && s.id != lab2.id && !s.cooldown && s.mineralAmount < s.mineralCapacity && s.pos.getRangeTo(lab1.pos) <= 2 && s.pos.getRangeTo(lab2.pos) <= 2)[0];

                if (labToReactWith) labToReactWith.runReaction(lab1, lab2);

                if (lab1.mineralAmount <5 || lab2.mineralAmount < 5) {
                    Memory.mineral1 = undefined;
                    Memory.mineral2 = undefined;
                    Memory.state = 'empty';
                }
            }
        },

        placeStrucs: function (room, flag) {
            for (let pos of this.labPositions) {
                if (_.size(Game.constructionSites) < 100
                    && CONTROLLER_STRUCTURES[STRUCTURE_LAB][room.controller.level] > room.getStructures(STRUCTURE_LAB).length) {
                    let strucPos = new RoomPosition(flag.pos.x + pos.x, flag.pos.y + pos.y, room.name);
                    let lookAt = strucPos.lookFor(LOOK_STRUCTURES);

                    if (!_.filter(lookAt, (s) => s.structureType == STRUCTURE_LAB)[0]) room.createConstructionSite(strucPos.x, strucPos.y, STRUCTURE_LAB);
                }
            }
        },

        choosingCompound: function (room) {
            for (let mineral1Type in REACTIONS) {
                if (!room.storage.store[mineral1Type] || room.storage.store[mineral1Type] < 500) continue;
                
                for (let mineral2Type in REACTIONS[mineral1Type]) {
                    if (room.storage.store[mineral2Type] >= 500 && (room.terminal.store[REACTIONS[mineral1Type][mineral2Type]] || 0) < terminalGoals[REACTIONS[mineral1Type][mineral2Type]]) return [mineral1Type, mineral2Type];
                }
            }
        },

        placeFlag: function (room) {
            const freeRange = 5;
            var bestPos;

            for (let x = 1+freeRange; x < 49-freeRange; x++) {
                for (let y = 1+freeRange; y < 49-freeRange; y++) {
                    let structures = _.filter(room.lookForAtArea(LOOK_STRUCTURES, y, x, y + freeRange, x + freeRange, true), (s) => s.structureType != STRUCTURE_ROAD);
                    if (structures.length > 0) continue;

                    let flags = room.lookForAtArea(LOOK_FLAGS, y, x, y + freeRange, x + freeRange, true);
                    if (flags.length > 0) continue;

                    let terrain = _.filter(room.lookForAtArea(LOOK_TERRAIN, y, x, y + freeRange, x + freeRange, true), (p) => p.type == 'terrain' && p.terrain == 'wall');
                    if (terrain.length > 0) continue;

                    let goodPos = new RoomPosition(x, y, room.name);

                    if (room.storage.pos.getRangeTo(goodPos) < 2) continue;

                    let distToStr = room.findPath(goodPos, room.storage.pos, {ignoreCreeps: true, ignoreRoads: true, maxRooms: 1}).length;

                    if (!bestPos) {
                        bestPos = {
                            x: goodPos.x,
                            y: goodPos.y,
                            s: distToStr
                        }
                    }

                    if (bestPos.s > distToStr) {
                        bestPos = {

                            x: goodPos.x,
                            y: goodPos.y,
                            s: distToStr
                        }
                    }
                }
            }

            room.createFlag(bestPos.x, bestPos.y, 'labFlag:' + room.name, COLOR_YELLOW, COLOR_ORANGE);

            console.notify('Places lab flag,\nROOM: ' + room.name + '\nAt Position: ' + bestPos.x + ' ' + bestPos.y);
        },

        fillLabs: function (creep, room, lab1, lab2, mineral1, mineral2) {
            var labToDo = Game.getObjectById(creep.memory.lf);

            if (!labToDo) {
                creep.memory.lf = lab1.mineralCapacity - lab1.mineralAmount > 0 && (room.storage.store[mineral1] || 0) > 0 ? lab1.id : lab2.mineralCapacity - lab2.mineralAmount > 0 && (room.storage.store[mineral2] || 0) > 0 ? lab2.id : undefined;
                labToDo = Game.getObjectById(creep.memory.lf);

                if (!labToDo) return 'done';
            }

            var mineralAmountNeeded = labToDo.mineralCapacity - labToDo.mineralAmount > creep.carryCapacity ? creep.carryCapacity : labToDo.mineralCapacity - labToDo.mineralAmount;
            var mineralNeeded = labToDo.id == lab1.id ? mineral1 : mineral2;

            if (mineralAmountNeeded < 1 || (!room.storage.store[mineralNeeded] && !creep.carry[mineralNeeded])) return creep.memory.lf = undefined;

            if (!creep.carry[mineralNeeded]) creep.memory.w = 1;
            else if (_.sum(creep.carry) >= creep.carryCapacity) creep.memory.w = 0;

            if (creep.memory.w) {
                if (creep.pos.isNearTo(room.storage)) {
                    if (creep.withdraw(room.storage, mineralNeeded, (mineralAmountNeeded > room.storage.store[mineralNeeded] ? room.storage.store[mineralNeeded] : mineralAmountNeeded)) == OK) creep.memory.w = 0;
                }
                else creep.moveWithPath(room.storage, {maxRooms: 1});
            }
            else {
                if (creep.pos.isNearTo(labToDo)) creep.transfer(labToDo, mineralNeeded);
                else creep.moveWithPath(labToDo, {maxRooms: 1});
            }
        },

        emptyLabs: function (creep, room, labToEmpty = creep.pos.findClosestByRange(room.getStructures(STRUCTURE_LAB, (s) => s.mineralAmount > 0))) {
            if (_.sum(creep.carry) == 0) creep.memory.w = 1;
            else if (_.sum(creep.carry) >= creep.carryCapacity) creep.memory.w = 0;

            if (creep.memory.w) {
                if (labToEmpty) {
                    if (creep.pos.isNearTo(labToEmpty.pos)) {
                        if (creep.withdraw(labToEmpty, labToEmpty.mineralType) == OK) creep.memory.w = 0;
                    }
                    else creep.moveWithPath(labToEmpty, {maxRooms: 1});
                }
                else return 'done';
            }
            else {
                if (creep.pos.isNearTo(room.storage)) creep.transferAll(room.storage);
                else creep.moveWithPath(room.storage, {maxRooms: 1});
            }
        }
    },

    shuffleOrdering: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room || !room.storage || !room.terminal) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (!global.shuffle) global.shuffle = {};

            _.forEach(RESOURCES_ALL, (resourceType) => {
                var amountInRoom = (room.storage.store[resourceType] || 0)+(room.terminal.store[resourceType] || 0);

                if (!amountInRoom || (amountInRoom < 500 || (resourceType == RESOURCE_ENERGY && amountInRoom < 250000))) {
                    if (!global.shuffle[resourceType]) global.shuffle[resourceType] = {};

                    global.shuffle[resourceType][room.name] = resourceType == RESOURCE_ENERGY ? 250000-amountInRoom : 500-amountInRoom;
                }
                else if (global.shuffle[resourceType] && global.shuffle[resourceType][room.name]) {
                    delete global.shuffle[resourceType][room.name];
                }
            });

            return {response: 'idle', time: Game.time + 17};
        }
    },
    
    doTerminal: {
        maxCreditLoss: 5000,

        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room || !room.storage || !room.terminal || room.controller.level < 8) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (!global.Mem.market) global.Mem.market = {};

            if (room.terminal.store[RESOURCE_ENERGY] < 10000) return {
                response: 'idle',
                time: Game.time + (1 - (room.terminal.store[RESOURCE_ENERGY] / 10000)) * 1000
            };
            else if (room.terminal.cooldown) return {response: 'idle', time: Game.time + room.terminal.cooldown};

    //shuffling
            for (let resourceType in room.terminal.store) {
                if (global.shuffle && global.shuffle[resourceType] && room.terminal.store[resourceType] >= 100) {
                    var closestRoomThatNeedsResources;

                    for (let roomName in global.shuffle[resourceType]) {
                        if (room.name == roomName) continue;

                        var transCost = Game.market.calcTransactionCost(1, room.name, roomName);

                        if (!closestRoomThatNeedsResources || closestRoomThatNeedsResources.cost > transCost) {
                            closestRoomThatNeedsResources = {
                                roomName: roomName,
                                cost: transCost
                            };
                        }
                    }

                    if (closestRoomThatNeedsResources && closestRoomThatNeedsResources.roomName && Game.rooms[closestRoomThatNeedsResources.roomName]
                        && Game.rooms[closestRoomThatNeedsResources.roomName].controller && Game.rooms[closestRoomThatNeedsResources.roomName].controller.level >= 6
                        && Game.rooms[closestRoomThatNeedsResources.roomName].terminal) {

                        var amountToSend = Math.round((room.terminal.store.energy / 2) / transCost) > room.terminal.store[resourceType] ? room.terminal.store[resourceType] : Math.round((room.terminal.store.energy / 2) / transCost);
                        if (amountToSend > global.shuffle[resourceType][closestRoomThatNeedsResources.roomName]) amountToSend = global.shuffle[resourceType][closestRoomThatNeedsResources.roomName];


                        if (amountToSend) {
                            var rsl = room.terminal.send(resourceType, amountToSend, closestRoomThatNeedsResources.roomName, 'Shuffling... \n long live the empire!');

                            console.terminalLog(room, 'Tried to send ' + resourceType + ' Amount ' + amountToSend + ' To Room ' + closestRoomThatNeedsResources.roomName + ' With Result ' + rsl);

                            if (rsl == OK) {
                                global.shuffle[resourceType][closestRoomThatNeedsResources.roomName] = global.shuffle[resourceType][closestRoomThatNeedsResources.roomName] - amountToSend;
                                return {response: 'idle', time: Game.time + 10};

                            }
                        }
                    }
                }
            }
    //shuffling


            (() => {
                for (var orderIndex in global.Mem.market) {
                    var order = Game.market.getOrderById(global.Mem.market[orderIndex]);
                    
                    if (!order || order.amount < 10) {
                        delete global.Mem.market[orderIndex];
                        continue;
                    }
                    
                    if (order.resourceType == RESOURCE_POWER && room.storage.store[RESOURCE_POWER] >= 100) continue;

                    switch (order.type) {
                        case ORDER_SELL: //you buy
                            if (room.storage.store[order.resourceType] && room.storage.store[order.resourceType] > 1000) continue;

                            var transCost = Game.market.calcTransactionCost(1, room.name, order.roomName);

                            var amountToSend = Math.round((room.terminal.store.energy / 2) / transCost) > room.terminal.store[order.resourceType] ? room.terminal.store[order.resourceType] : Math.round((room.terminal.store.energy / 2) / transCost);
                            if (amountToSend > order.amount) amountToSend = order.amount;
                            if (amountToSend * order.price > this.maxCreditLoss) amountToSend = Math.floor(this.maxCreditLoss / order.price);
                            if (amountToSend > room.terminal.storeCapacity - _.sum(room.terminal.store)) amountToSend = room.terminal.storeCapacity - _.sum(room.terminal.store);
                            if (terminalGoals[order.resourceType] && amountToSend + (room.terminal.store[order.resourceType] ? room.terminal.store[order.resourceType] : 0) > terminalGoals[order.resourceType]+1000) amountToSend = terminalGoals[order.resourceType]+1000 - (room.terminal.store[order.resourceType] ? room.terminal.store[order.resourceType] : 0);

                            if (amountToSend) {
                                var rsl = Game.market.deal(order.id, amountToSend, room.name);
                                console.terminalLog(room, 'Tried to buy ' + order.resourceType + ' Amount ' + amountToSend + ' At Price ' + order.price + ' Result ' + rsl);

                                if (rsl == OK) return {response: 'idle', time: Game.time + 10};
                            }
                        case ORDER_BUY: //you sell
                            if (!room.terminal.store[order.resourceType] || room.terminal.store[order.resourceType] < 500) continue;

                            var transCost = Game.market.calcTransactionCost(1, room.name, order.roomName);

                            var amountToSend = Math.round((room.terminal.store.energy / 2) / transCost) > room.terminal.store[order.resourceType] ? room.terminal.store[order.resourceType] : Math.round((room.terminal.store.energy / 2) / transCost);
                            if (amountToSend > order.amount) amountToSend = order.amount;
                            if (amountToSend > room.terminal.store[order.resourceType]) amountToSend = room.terminal.store[order.resourceType];

                            if (amountToSend) {
                                var rsl = Game.market.deal(order.id, amountToSend, room.name);
                                console.terminalLog(room, 'Tried to sell ' + order.resourceType + ' Amount ' + amountToSend + ' At Price ' + order.price + ' Result ' + rsl);

                                if (rsl == OK) return {response: 'idle', time: Game.time + 10};
                            }

                    }

                }
            })();

            return {response: 'idle', time: Game.time + 7};
        }
    },

    doPowerProc: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room || room.memory.minimal || !room.storage || !room.terminal || room.getStructures(STRUCTURE_POWER_SPAWN).length < 1) return {response: 'end'};

            if (global.shuffle && _.sum(global.shuffle[RESOURCE_ENERGY]) > 100) return {response: 'idle', time: Game.time + 101};
            
            var powerSpawn = room.getStructures(STRUCTURE_POWER_SPAWN)[0];

            if (powerSpawn && powerSpawn.energy >= 50 && powerSpawn.power >= 1 && room.storage && room.storage.store[RESOURCE_ENERGY] >= 10000) powerSpawn.processPower();

            if (room.storage.store.energy >= 200000) return;
            return {response: 'idle', time: Game.time + 7};
        }
    },

    doHarvest: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (!global[room.name].distrSquareFlag) global[room.name].distrSquareFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!creeps) Memory.crps = []; creeps = Memory.crps;
            
            if (room.storage && room.storage.store[RESOURCE_ENERGY] > 600000 && room.energyAvailable == room.energyCapacityAvailable) return {response: 'idle', time: Game.time + 17};
            
            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'doHarvest');
                    if (creep == 'dead') {
                        creep = undefined;
                    }

                    if (!creep) {
                        if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        continue;
                    }
                    else if (creep.spawning) continue;

                    creep.talk('doHarvest');

                    if (room.find(FIND_MY_CREEPS, {filter: (c) => c.memory.p && c.memory.p != 'doHarvest'}).length >= 1) {
                        if (creep.carry.energy >= (creep.carryCapacity - 2 * creep.getActiveBodyparts(WORK))) this.dropEnergy(Memory, creep);
                        this.harvest(Memory, room, creep);
                    }
                    else {
                        if (creep.carry.energy >= creep.carryCapacity) {
                            var sE = creep.pos.findClosestByRange(FIND_MY_SPAWNS, {filter: (s) => s.energy < s.energyCapacity});
                            if (sE) {
                                if (creep.pos.isNearTo(sE)) creep.transfer(sE, RESOURCE_ENERGY);
                                else creep.moveWithPath(sE, {repath: 0.01, maxRooms: 1});
                            }
                            else {
                                var extension = creep.pos.findClosestByRange(creep.room.getStructures(STRUCTURE_EXTENSION), {filter: (s) => s.energy < s.energyCapacity});
                                if (extension) {
                                    if (creep.pos.isNearTo(extension)) creep.transfer(extension, RESOURCE_ENERGY);
                                    else creep.moveWithPath(extension, {repath: 0.01, maxRooms: 1});
                                }
                            }
                        }
                        else this.harvest(Memory, room, creep);
                    }
                }
            }

            //get more creeps
            if (creeps.length < this.getHarvesters(room)) Memory.crps.push(module.exports.room.addToSQ(room.name, 'doHarvest'));
        },

        getHarvesters: function (room) {
            return !room.memory.minimal ? room.find(FIND_SOURCES).length : 1;
        },

        harvest: function (Memory, room, creep) {
            var source = Game.getObjectById(creep.memory.src);

            if (source) {
                if (!creep.pos.isNearTo(source)) creep.travelTo(source, {maxRooms: 1});
                else if (source.energy) creep.harvest(source)
            }
            else {
                var takenSources = [];
                _.forEach(Memory.crps, (c) => {
                    c = c.toString();
                    c = Game.creeps[c.split(':')[0]];
                    if (c && c.memory.src) takenSources.push(c.memory.src);
                });

                var zeChosn = room.find(FIND_SOURCES, {filter: (s) => !takenSources.includes(s.id)})[0];

                if (zeChosn && zeChosn.id) creep.memory.src = zeChosn.id;
                else {
                    zeChosn = creep.pos.findClosestByPath(FIND_SOURCES);
                    creep.memory.src = zeChosn ? zeChosn.id : undefined;
                }
            }
        },

        dropEnergy: function (Memory, creep, room = creep.room) {

            var link = room.storage && creep.pos.isNearTo(room.storage) ? room.storage : Game.getObjectById(creep.memory.lnk);

            if (!link) {
                var nLink = creep.pos.findClosestByRange(room.getStructures(STRUCTURE_LINK));
                creep.memory.lnk = nLink && nLink.pos.getRangeTo(creep.pos.findClosestByRange(FIND_SOURCES)) < 3 ? nLink.id : null;
                link = Game.getObjectById(creep.memory.lnk);
            }

            if (link) {
                if (creep.pos.isNearTo(link.pos)) creep.transfer(link, RESOURCE_ENERGY);
                 else creep.moveWithPath(link, {repath: 0.01, maxRooms: 1});
            }
            else {
                var container = creep.pos.findInRange(room.getStructures(STRUCTURE_CONTAINER), 1, (s) => s.store.energy < s.storeCapacity)[0];

                if (container) {
                    if (creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveWithPath(container, {repath: 0.01, maxRooms: 1});
                    }
                }
                else {
                    creep.drop(RESOURCE_ENERGY);
                }

                if (room.getStructures(STRUCTURE_LINK).length < CONTROLLER_STRUCTURES.link[creep.room.controller.level]) {
                    if (!creep.pos.findClosestByRange(FIND_SOURCES).pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0]) {
                        this.placeLink(creep.pos.findClosestByRange(FIND_SOURCES), creep);
                    }
                }
                else {
                    var src = creep.pos.findClosestByRange(FIND_SOURCES);
                    if (room.controller.level >= 3 && _.size(Game.constructionSites) < 100 && src && creep.pos.isNearTo(src) && creep.pos.findInRange(room.getStructures(STRUCTURE_CONTAINER), 1).length < 1
                        && creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).length < 1) room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER)
                }
            }
        },

        placeLink: function (source, creep, room = creep.room) {
            if (_.size(Game.constructionSites) >= 100 || !global[room.name].distrSquareFlag.pos.findInRange(room.getStructures(STRUCTURE_LINK), 1)[0]) return;

            const opRP = {
                [TOP]: {d: BOTTOM, x: 0, y: 1},
                [BOTTOM]: {d: TOP, x: 0, y: -1},
                [LEFT]: {d: RIGHT, x: 1, y: 0},
                [RIGHT]: {d: LEFT, x: -1, y: 0},
                [TOP_LEFT]: {d: BOTTOM_RIGHT, x: 1, y: 1},
                [TOP_RIGHT]: {d: BOTTOM_LEFT, x: -1, y: 1},
                [BOTTOM_RIGHT]: {d: TOP_LEFT, x: -1, y: -1},
                [BOTTOM_LEFT]: {d: TOP_RIGHT, x: 1, y: -1}
            };

            var opDirTS = opRP[creep.pos.getDirectionTo(source.pos)];
            var blocked = false;

            _.forEach(creep.room.getPositionAt(creep.pos.x+opDirTS.x, creep.pos.y+opDirTS.y).lookFor(LOOK_STRUCTURES), (s) => {
                if (s.structureType != STRUCTURE_SPAWN && s.structureType != STRUCTURE_LINK) s.destroy();
                else blocked = true;
            });

            if (!blocked) creep.room.createConstructionSite(creep.room.getPositionAt(creep.pos.x+opDirTS.x, creep.pos.y+opDirTS.y), STRUCTURE_LINK);
            else console.notify("doHarvest's placeLink found itself blocked Source is: " + source.id + ' in Room: ' + source.room);
        }
    },

    fillSpawn: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creep = Memory.creep ? getCreep(Memory.creep, 'fillSpawn') : undefined;
            if (creep == 'dead') {
                Memory.creep = undefined;
                creep = undefined;
            }

            var room = Game.rooms[Memory.rmN];
            if (!room || room.memory.minimal) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};

            if (!global[room.name].fillSpawnFlag) global[room.name].fillSpawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
            var flag = global[room.name].fillSpawnFlag ? Game.flags[global[room.name].fillSpawnFlag.name] : undefined;

            if (!flag) return this.placeFlag(room);
            if (Game.time % 17280 == 0) this.placeSpawn(room);
            if (Game.time % 17280 == 0 && room.controller.level >= 4) this.placeRamparts(room);

            if (creep) {
                creep.talk('fillSpawn');
                if (creep.carry.energy == 0) Memory.w = 1;
                else if (creep.carry.energy == creep.carryCapacity) Memory.w = 0;

                if (Memory.w == 1) {
                    creep.getConsumerEnergy(room);
                }
                else {
                    if (!creep.pos.isEqualTo(flag.pos)) creep.moveWithPath(flag, {range: 0, repath: 0.01, maxRooms: 1});
                    else if (room.find(FIND_MY_SPAWNS)[Game.time % room.find(FIND_MY_SPAWNS).length].energy < SPAWN_ENERGY_CAPACITY) creep.transfer(room.find(FIND_MY_SPAWNS)[Game.time % room.find(FIND_MY_SPAWNS).length], RESOURCE_ENERGY);
                    // else if (creep.ticksToLive < 1250 && !room.find(FIND_MY_SPAWNS)[Game.time % room.find(FIND_MY_SPAWNS).length].spawning && room.find(FIND_MY_SPAWNS)[Game.time % room.find(FIND_MY_SPAWNS).length].energy >= 300) room.find(FIND_MY_SPAWNS)[Game.time % room.find(FIND_MY_SPAWNS).length].renewCreep(creep);
                    else if (creep.carry.energy < creep.carryCapacity) Memory.w = 1;
                }
            }
            else {
                Memory.creep = module.exports.room.addToSQ(room.name, 'fillSpawn', {name: Memory.creep});
            }
        },

        placeFlag: function (room) {
            var spawn = room.find(FIND_MY_SPAWNS)[0];
            if (!spawn) return;

            room.createFlag(spawn.pos.x - 1, spawn.pos.y, 'fillSpawn:' + room.name, COLOR_PURPLE, COLOR_CYAN);
        },

        spawns: [{"x": 1, "y": 0}, {"x": -1, "y": 0}, {"x": 0, "y": -1}],

        placeSpawn: function (room) {
            if (_.size(Game.constructionSites) < 100 && CONTROLLER_STRUCTURES.spawn[room.controller.level] > room.find(FIND_MY_SPAWNS).length) {
                var flag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
                var cnt = room.find(FIND_MY_SPAWNS).length;

                for (let pos_it of this.spawns) {
                    let pos = new RoomPosition(flag.pos.x + pos_it.x, flag.pos.y + pos_it.y, room.name);
                    if (!pos.findInRange(FIND_MY_SPAWNS, 0)[0] && !pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 0)[0]) {
                        room.createConstructionSite(pos.x, pos.y, STRUCTURE_SPAWN);

                        cnt++;
                        if (cnt >= CONTROLLER_STRUCTURES.spawn[room.controller.level]) break;
                    }
                }
            }
        },

        placeRamparts: function (room) {
            if (_.size(Game.constructionSites) < 100) {
                var flag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];

                for (let pos_it of this.spawns) {
                    let pos = new RoomPosition(flag.pos.x + pos_it.x, flag.pos.y + pos_it.y, room.name);
                    if (!pos.findInRange(room.getStructures(STRUCTURE_RAMPART), 0)[0] && !pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 0)[0]) {
                        room.createConstructionSite(pos.x, pos.y, STRUCTURE_RAMPART);
                    }
                }
            }
        }
    },

    fillExt: {
        path: [BOTTOM_LEFT, BOTTOM_LEFT, BOTTOM_LEFT, BOTTOM_LEFT,
            TOP_LEFT, TOP_LEFT,
            TOP_RIGHT,
            BOTTOM_LEFT,
            TOP_LEFT, TOP_LEFT,
            TOP_RIGHT, TOP_RIGHT, TOP_RIGHT, TOP_RIGHT,
            BOTTOM_RIGHT, BOTTOM_RIGHT,
            BOTTOM_LEFT,
            TOP_RIGHT,
            BOTTOM_RIGHT, BOTTOM_RIGHT],

        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room || room.memory.minimal) return {response: 'end'};
            if (!creeps) Memory.crps = [];
            creeps = Memory.crps;
            if (!global[room.name]) global[room.name] = {};

            //creep loop
            for (let creep_it_it in creeps) {
                if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                let creep = getCreep(creeps[creep_it_it].split(':')[0], 'fillExt');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                    continue;
                }
                else if (creep.spawning) continue;

                creep.talk('fillExt');

                var extensionLink = room.extensionFlag ? _.filter(room.getPositionAt(room.extensionFlag.pos.x + 5, room.extensionFlag.pos.y + 5).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_LINK)[0] : room.extensionFlag;

                if (room.controller.level < 8 || !room.extensionFlag || !extensionLink) this.notCoolVersion(Memory, room, creep);
                else if (creep.pos.getRangeTo(extensionLink) > 4) creep.moveWithPath(extensionLink, {range: 3});
                else if (creep.carry.energy < creep.carryCapacity && creep.pos.getRangeTo(extensionLink) <= 1) {
                    if (extensionLink.energy > 0) {
                        creep.withdraw(extensionLink, RESOURCE_ENERGY);
                        if (creep.pos.getDirectionTo(extensionLink) == TOP_RIGHT) creep.memory.moving = 7;
                        else creep.memory.moving = 17;
                    }
                    else {
                        var container = creep.pos.findInRange(room.getStructures(STRUCTURE_CONTAINER), 0)[0];
                        if (container && container.store.energy) creep.withdraw(container, RESOURCE_ENERGY);
                    }
                }
                else if (room.energyAvailable == room.energyCapacityAvailable && creep.pos.getRangeTo(extensionLink) <= 1) {
                    var container = creep.pos.findInRange(room.getStructures(STRUCTURE_CONTAINER), 0)[0];
                    if (container && creep.carry.energy > 0) {
                        creep.transfer(container, RESOURCE_ENERGY);
                    }

                    return {response: 'idle', time: Game.time + 11};
                }
                else {
                    var exts = room.getStructures(STRUCTURE_EXTENSION, (extension) => extension.energy < extension.energyCapacity & extension.pos.isNearTo(creep.pos));

                    if (exts && creep.carry.energy > 0) creep.transfer(exts[0], RESOURCE_ENERGY);
                    
                        if (!creep.memory.moving || !this.path[creep.memory.moving]) {
                            if (creep.pos.x === extensionLink.pos.x - 4) creep.memory.moving = 10;
                            else creep.memory.moving = 0;
                        }

                        creep.move(this.path[creep.memory.moving]);
                        creep.memory.moving++;
                    
                }
            }

            if (creeps.length < this.getCreepAmount(room)) Memory.crps.push(module.exports.room.addToSQ(room.name, 'fillExt'));
        },

        getCreepAmount: function (room) {
            if (!room || !room.controller || room.controller.level >= 8 || room.getStructures(STRUCTURE_EXTENSION).length < 1) return 1;
            else return 2;
        },

        notCoolVersion: function (Memory, room, creep) {
            if (creep.carry.energy == 0) creep.memory.w = 1;
            else if (creep.carry.energy == creep.carryCapacity) creep.memory.w = 0;

            if (creep.memory.w == 1) {
                creep.getConsumerEnergy(room);
            }
            else {
                var extension = Game.getObjectById(creep.memory.ext);

                if (extension && extension.energy < extension.energyCapacity) {
                    if (creep.pos.isNearTo(extension)) {
                        creep.transfer(extension, RESOURCE_ENERGY);
                    }
                    else {
                        creep.moveWithPath(extension, {
                            obstacles: getObstacles(room),
                            repath: 0.01,
                            maxRooms: 1
                        });
                    }
                }
                else {
                    var chosen = creep.pos.findClosestByRange(room.getStructures(STRUCTURE_EXTENSION, (s) => s.energy < s.energyCapacity));
                    
                    creep.memory.ext = chosen ? chosen.id : room.find(FIND_MY_SPAWNS)[0].id;
                }
            }
        }
    },

    strgDistr: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (!creeps) Memory.crps = []; creeps = Memory.crps;

            if (!global[room.name].distrSquareFlag) global[room.name].distrSquareFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];

            var flag = global[room.name].distrSquareFlag;
            if (!room.storage || !flag) return;
            if (!global[room.name]) global[room.name] = {};
            if (!Game.getObjectById(Memory.link)) {
                var link = flag.pos.findInRange(room.getStructures(STRUCTURE_LINK), 1)[0];
                Memory.link = link ? link.id : undefined;

                if (!link && Game.time % 101 == 0) return this.placeStrucs(room, flag);
                else return;
            }
            
            if (!Memory.lastRC || room.controller.level != Memory.lastRC || Game.time % 120960 == 0)
            {
                this.placeStrucs(room, flag);
                if (room.controller.level >= 4) this.placeRamparts(room, flag);
                Memory.lastRC = room.controller.level
            }

            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'strgDistr');
                    if (creep == 'dead') {
                        Memory.crp = undefined;
                        creep = undefined;
                    }

                    if (!creep) {
                        if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        continue;
                    }

                    if (!creep.pos.isEqualTo(flag.pos)) {
                        creep.moveWithPath(flag, {range: 0, obstacles: room.find(FIND_MY_SPAWNS), repath: 0.01, maxRooms: 1});

                        if ((flag.pos.findInRange(FIND_MY_POWER_CREEPS, 1).length > 0 || flag.pos.findInRange(FIND_MY_CREEPS, 1).length > 0) && creep.pos.getRangeTo(flag.pos) <= 3) {
                            var rootOfAllEvil = flag.pos.findInRange(FIND_MY_POWER_CREEPS, 1)[0] || flag.pos.findInRange(FIND_MY_CREEPS, 1, {filter: (c) => c.memory.p != 'strgDistr'})[0];
                            if (rootOfAllEvil) {
                                rootOfAllEvil.move(rootOfAllEvil.pos.getDirectionTo(creep.pos));
                            }
                        }
                    }
                    else { // do stuff

                        if (_.sum(creep.carry) == 0) creep.memory.w = false;
                        else if (_.sum(creep.carry) == creep.carryCapacity) creep.memory.w = true;

                        if (creep.memory.w == true) {
                            switch (creep.memory.doing) {
                                case 'tower':
                                    creep.talk('Fill Tower');
                                    this.fillTower(Memory, room, creep);
                                    break;
                                case 'pickupInRange':
                                    creep.talk('Pick It Up');
                                    this.pickupInRange(Memory, room, creep);
                                    break;
                                case 'link':
                                    creep.talk('Link!');
                                    this.linkToStorage(Memory, room, creep);
                                    break;
                                case 'TTS':
                                    creep.talk('TTS');
                                    this.TTS(Memory, room, creep);
                                    break;
                                case 'fillNuke':
                                    creep.talk('NUKE!');
                                    this.fillNuke(Memory, room, creep);
                                    break;
                                case 'fillPowerSpawn':
                                    creep.talk('POWA!');
                                    this.fillPowerSpawn(Memory, room, creep);
                                    break;
                                case 'STT':
                                    creep.talk('STT');
                                    this.STT(Memory, room, creep);
                                    break;
                                default:
                                    console.errorLog('creep.memory.doing is undefined', creep, room);
                                    creep.memory.doing = 'link';
                            }
                        }
                        else {
                            if (this.fillTower(Memory, room, creep) == OK) creep.memory.doing = 'tower';
                            else if (this.pickupInRange(Memory, room, creep) == OK) creep.memory.doing = 'pickupInRange';
                            else if (this.linkToStorage(Memory, room, creep) == OK) creep.memory.doing = 'link';
                            else if (this.fillNuke(Memory, room, creep) == OK) creep.memory.doing = 'fillNuke';
                            else if (this.STT(Memory, room, creep) == OK) creep.memory.doing = 'STT';
                            else if (this.TTS(Memory, room, creep) == OK) creep.memory.doing = 'TTS';
                            else if (this.fillPowerSpawn(Memory, room, creep) == OK) creep.memory.doing = 'fillPowerSpawn';
                            else return {response: 'idle', time: Game.time+7};
                        }
                    }
                }
            }

            //get more creeps
            if (creeps.length < 1 || (Game.creeps[creeps[0]] && Game.creeps[creeps[0]].ticksToLive < 100 && creeps.length < 2)) Memory.crps.push(module.exports.room.addToSQ(room.name, 'strgDistr'));
        },

        structs: [{x: 1, y: 1, s: STRUCTURE_TOWER}, {x: 1, y: 0, s: STRUCTURE_STORAGE}, {x: 1, y: -1, s: STRUCTURE_TERMINAL}, {x: 0, y: -1, s: STRUCTURE_NUKER}, {x: -1, y: -1, s: STRUCTURE_POWER_SPAWN},
            {x: -1, y: 0, s: STRUCTURE_OBSERVER}, {x: -1, y: 1, s: STRUCTURE_LINK}],

        placeStrucs: function (room, flag) {
            for (let struc of this.structs) {
                if (_.size(Game.constructionSites) < 100
                    && CONTROLLER_STRUCTURES[struc.s][room.controller.level] > room.getStructures(struc.s).length) {
                    let strucPos = new RoomPosition(flag.pos.x + struc.x, flag.pos.y + struc.y, room.name);
                    let lookAt = strucPos.lookFor(LOOK_STRUCTURES);

                    if (!_.filter(lookAt, (s) => s.structureType == struc.s)[0]) room.createConstructionSite(strucPos.x, strucPos.y, struc.s);
                    if (_.filter(lookAt, (s) => s.structureType == STRUCTURE_ROAD)[0]) _.filter(lookAt, (s) => s.structureType == STRUCTURE_ROAD)[0].destroy();
                }
            }
        },

        placeRamparts: function (room, flag) {
            if (!_.filter(flag.pos.lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_RAMPART)[0]) room.createConstructionSite(flag.pos.x, flag.pos.y, STRUCTURE_RAMPART);

            for (let struc of this.structs) {
                if (_.size(Game.constructionSites) < 100) {
                    let strucPos = new RoomPosition(flag.pos.x + struc.x, flag.pos.y + struc.y, room.name);
                    let lookAt = strucPos.lookFor(LOOK_STRUCTURES);

                    if (!_.filter(lookAt, (s) => s.structureType == STRUCTURE_RAMPART)[0]) room.createConstructionSite(strucPos.x, strucPos.y, STRUCTURE_RAMPART);
                }
            }
        },

        pickupInRange: function (Memory, room, creep) {
            if (creep.memory.w == true) {
                //if carry is full
                var storage = room.storage;
                creep.transfer(storage, Object.keys(creep.carry)[Math.floor(Game.time % Object.keys(creep.carry).length)]);
            }
            else {
                //if carry is empty

                if (creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1).length > 0) {
                    var droppedResource = creep.pos.findInRange(FIND_DROPPED_RESOURCES, 1)[0];

                    if (droppedResource) {
                        creep.memory.w = true;
                        creep.pickup(droppedResource);
                        return OK;
                    }
                }
                else return 'no resource'
            }
        },

        linkToStorage: function (Memory, room, creep) {
            var storageLink = Game.getObjectById(Memory.link);


            if (creep.memory.w == true) {
                //if carry is full
                var toPut = room.terminal && room.controller.level > 7 && room.storage.store[RESOURCE_ENERGY]-800 > storageEnergy && room.terminal.store[RESOURCE_ENERGY] < terminalGoals[RESOURCE_ENERGY]? room.terminal : room.storage;
                creep.transfer(toPut, RESOURCE_ENERGY);
                creep.memory.w = false;
            }
            else {
                //if carry is empty
                if (storageLink && storageLink.energy > 0) {
                    var link = room.getStructures(STRUCTURE_LINK, (s) => s.energy < 100 && s.id != storageLink.id && !s.pos.findInRange(FIND_SOURCES, 3)[0])[0];
                     if (room.storage.store.energy <= 1000 || !link) {
                         creep.memory.w = true;
                         creep.withdraw(storageLink, RESOURCE_ENERGY);
                         return OK;
                     }
                }
                else return 'no structure'
            }
        },

        fillTower: function (Memory, room, creep) {

            if (!Game.getObjectById(Memory.tower)) {
                var fnd = creep.pos.findInRange(room.getStructures(STRUCTURE_TOWER, 1))[0];
                Memory.tower = fnd ? fnd.id : undefined;
            }

            var tower = Game.getObjectById(Memory.tower) && Game.getObjectById(Memory.tower).energy < Game.getObjectById(Memory.tower).energyCapacity ? Game.getObjectById(Memory.tower) : undefined;
            if (!tower) {
                creep.memory.w = false;
                return 'no structure';
            }

            if (creep.memory.w == true) {
                //if carry is full
                creep.transfer(tower, RESOURCE_ENERGY);
            }
            else if (room.storage.store.energy >= tower.energyCapacity-tower.energy) {
                //if carry is empty
                creep.memory.w = true;
                creep.withdraw(room.storage, RESOURCE_ENERGY);
                return OK;
            }
        },

        fillNuke: function (Memory, room, creep) {
            var nuke = room.getStructures(STRUCTURE_NUKER) && room.getStructures(STRUCTURE_NUKER)[0] && creep.pos.isNearTo(room.getStructures(STRUCTURE_NUKER)[0]) ? room.getStructures(STRUCTURE_NUKER)[0] : undefined;
            if (!nuke) return 'error no nuke';

            if (creep.memory.w == true) {
                if (creep.transfer(nuke, Object.keys(creep.carry)[Math.floor(Math.random() * Object.keys(creep.carry).length)]) != OK) creep.memory.w = false;
            }
            else {// carry empty
                if (nuke.energy < nuke.energyCapacity && room.storage.store[RESOURCE_ENERGY] >= 10000) {
                    var amtTW = nuke.energyCapacity-nuke.energy > creep.carryCapacity ? undefined : nuke.energyCapacity-nuke.energy;
                    var result = creep.withdraw(room.storage, RESOURCE_ENERGY, amtTW);
                    creep.memory.w = true;
                    //console.log(result);
                    if (result == OK) return OK;
                    else return 'failed';
                }
                else if (nuke.ghodium < nuke.ghodiumCapacity && (room.storage.store[RESOURCE_GHODIUM] || room.terminal.store[RESOURCE_GHODIUM])) {
                    var whereToGetGhodium = room.terminal.store[RESOURCE_GHODIUM] ? room.terminal : room.storage;
                    var amtTW = nuke.ghodiumCapacity-nuke.ghodium > creep.carryCapacity || nuke.ghodiumCapacity-nuke.ghodium >  whereToGetGhodium.store[RESOURCE_GHODIUM] ? undefined : nuke.ghodiumCapacity-nuke.ghodium;
                    var result = creep.withdraw(whereToGetGhodium, RESOURCE_GHODIUM, amtTW);
                    creep.memory.w = true;
                    //console.log(result);
                    if (result == OK) return OK;
                    else return 'failed';
                }
            }
        },

        fillPowerSpawn: function (Memory, room, creep) {
            var powerSpawn = room.getStructures(STRUCTURE_POWER_SPAWN) && room.getStructures(STRUCTURE_POWER_SPAWN)[0] && creep.pos.isNearTo(room.getStructures(STRUCTURE_POWER_SPAWN)[0]) ? room.getStructures(STRUCTURE_POWER_SPAWN)[0] : undefined;;
            if (!powerSpawn) return 'error no powerSpawn';

            if (creep.memory.w == true) {
                if (creep.transfer(powerSpawn, Object.keys(creep.carry)[Math.floor(Math.random() * Object.keys(creep.carry).length)]) != OK) creep.memory.w = false;
            }
            else {// carry empty
                if (powerSpawn.energy < powerSpawn.energyCapacity && room.storage.store[RESOURCE_ENERGY] >= 10000) {
                    var amtTW = powerSpawn.energyCapacity-powerSpawn.energy > creep.carryCapacity ? undefined : powerSpawn.energyCapacity-powerSpawn.energy;
                    var result = creep.withdraw(room.storage, RESOURCE_ENERGY, amtTW);
                    creep.memory.w = true;
                    //console.log(result);
                    if (result == OK) return OK;
                    else return 'failed';
                }
                else if (powerSpawn.power < powerSpawn.powerCapacity && (room.storage.store[RESOURCE_POWER] || room.terminal.store[RESOURCE_POWER])) {
                    var whereToGetPower = room.terminal.store[RESOURCE_POWER] ? room.terminal : room.storage;
                    var amtTW = powerSpawn.powerCapacity-powerSpawn.power > creep.carryCapacity || powerSpawn.powerCapacity-powerSpawn.power >  whereToGetPower.store[RESOURCE_POWER] ? undefined : powerSpawn.powerCapacity-powerSpawn.power;
                    var result = creep.withdraw(whereToGetPower, RESOURCE_POWER, amtTW);
                    creep.memory.w = true;
                    //console.log(result);
                    if (result == OK) return OK;
                    else return 'failed';
                }
            }
        },

        TTS: function (Memory, room, creep) {
            if (!room.terminal) return 'no structure';

            if (creep.memory.w == true) {
                if (creep.transfer(room.storage, Object.keys(creep.carry)[Math.floor(Math.random() * Object.keys(creep.carry).length)]) != OK) creep.memory.w = false;
            }
            else {
                var resourceToMove;
                var amountToMove;

                for (let resourceType in room.terminal.store) {
                    if (room.terminal.store[resourceType] < 1) continue
                    
                    if (resourceType == RESOURCE_ENERGY) {
                        if ((room.terminal.store[RESOURCE_ENERGY]-800 > 15000 && room.controller.level < 8) || room.storage.store[resourceType]+800 < storageEnergy) {
                            resourceToMove = resourceType;
                            break;
                        }
                    }
                    else if ((!room.storage.store[resourceType] || room.storage.store[resourceType] < 500) || room.terminal.store[resourceType]-800 > terminalGoals[resourceType]) {
                        amountToMove = 500-(room.storage.store[resourceType] || 0) > 0 ? 500-(room.storage.store[resourceType] || 0) : undefined;
                        resourceToMove = resourceType;
                        break;
                    }
                }

                if (resourceToMove) {
                    if (amountToMove > room.terminal.store[resourceToMove]) amountToMove = room.terminal.store[amountToMove];
                    if (amountToMove > creep.carryCapacity) amountToMove = creep.carryCapacity;
                    
                    creep.memory.w = true;
                    creep.withdraw(room.terminal, resourceToMove, amountToMove);
                    return OK;
                }
            }
        },

        STT: function (Memory, room, creep) {
            if (!room.terminal || _.sum(room.terminal.store) >= room.terminal.storeCapacity-1000) return 'no structure';

            if (creep.memory.w == true) {
                creep.transfer(room.terminal, Object.keys(creep.carry)[Math.floor(Game.time % Object.keys(creep.carry).length)]);
            }
            else {
                var resourceToMove;
                var amountToMove;

                for (let resourceType in room.storage.store) {
                    if (room.storage.store[resourceType] < 1) continue
                    
                    if (resourceType == RESOURCE_ENERGY) {
                        if ((room.terminal.store[RESOURCE_ENERGY]+800 < 15000 || room.controller.level >= 8) && room.storage.store[resourceType]-800 > storageEnergy && room.terminal.store[RESOURCE_ENERGY] < 150000) {
                            resourceToMove = resourceType;
                            break;
                        }
                    }
//                     else if (true) {
                    else if (room.storage.store[resourceType]-500 > 0 && (!room.terminal.store[resourceType] || room.terminal.store[resourceType]+800 < terminalGoals[resourceType])) {
                        amountToMove = room.storage.store[resourceType]-500 < creep.carryCapacity-_.sum(creep.carry) ? room.storage.store[resourceType]-500 : undefined;
                        resourceToMove = resourceType;
                        break;
                    }
                }

                if (resourceToMove) {
                    creep.memory.w = true;
                    creep.withdraw(room.storage, resourceToMove, amountToMove);
                    return OK;
                }
            }
        }
    },

    mine: {
     run: function (Memory_it) {
         var Memory = global.Mem.p[Memory_it];

         var creeps = Memory.crps ? Memory.crps : undefined;
         var room = Game.rooms[Memory.rmN];
         if (!room || room.memory.minimal || !room.storage || room.controller.level < 6) return {response: 'end'};

         var mineral = room.find(FIND_MINERALS)[0];
         if (!mineral || (mineral.mineralAmount < 1 && mineral.ticksToRegeneration > 200 && (!creeps || creeps.length < 1))) return {response: 'end'};

         if (!global[room.name]) global[room.name] = {};
         if (!creeps) Memory.crps = []; creeps = Memory.crps;

         if (creeps.length > 0) {
             //creep loop
             for (let creep_it_it in creeps) {
                 if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                 let creep = getCreep(creeps[creep_it_it].split(':')[0], 'mine');
                 if (creep == 'dead') {
                     creep = undefined;
                 }

                 if (!creep) {
                     if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                     continue;
                 }
                 else if (creep.spawning) continue;

                 creep.talk('mine');

                 if (_.sum(creep.carry) == 0) Memory.w = 0;
                 else if (_.sum(creep.carry) >= (creep.carryCapacity - HARVEST_MINERAL_POWER * creep.getActiveBodyparts(WORK))) Memory.w = 1;

                 if (Memory.w == 1) {
                     if (creep.pos.isNearTo(room.storage)) creep.transfer(room.storage, Object.keys(creep.carry)[Math.floor(Game.time % Object.keys(creep.carry).length)]);
                     else creep.moveWithPath(room.storage, {repath: 0.01, maxRooms: 1});
                 }
                 else {
                     if (mineral.mineralAmount < 1 && mineral.ticksToRegeneration > 200) {
                         if (_.sum(creep.carry) > 0) Memory.w = 1;
                         else creep.suicide();
                     }

                     if (creep.pos.isNearTo(mineral)) {
                         if (creep.harvest(mineral) == ERR_NOT_FOUND) {
                             if (mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES).length < 1) room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
                             creep.memory.t = 'build';
                             return {response: 'idle', time: Game.time + CONSTRUCTION_COST[STRUCTURE_EXTRACTOR]};
                         }
                         else return {response: 'idle', time: Game.time + 6};
                     }
                     else creep.moveWithPath(mineral, {repath: 0.01, maxRooms: 1});
                 }
             }
         }


         //get more creeps
         if (Game.time % 3 == 0) {
             if ((mineral.mineralAmount > 1 || mineral.ticksToRegeneration < 200) && creeps.length < 1) Memory.crps.push(module.exports.room.addToSQ(room.name, 'mine'));
         }
     }
    },

    iRmHaul: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room || room.memory.minimal) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (!creeps) Memory.crps = []; creeps = Memory.crps;
            if (!room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0]) return;

            if (!room.storage) return this.placeStorage(room);
            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'iRmHaul');
                    if (creep == 'dead') {
                        Memory.crp = undefined;
                        creep = undefined;
                    }

                    if (!creep) {
                        if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        continue;
                    }
                    else if (creep.spawning) continue;

                    creep.talk('iRmHaul');

                    if (_.sum(creep.carry) == 0) Memory.w = 1;
                    else if (_.sum(creep.carry) == creep.carryCapacity) Memory.w = 0;

                    if (Memory.w == 1) {
                        creep.getCarrierResources();
                    }
                    else if (room.storage) {
                        if (creep.pos.isNearTo(room.storage.pos)) creep.transfer(room.storage, Object.keys(creep.carry)[Math.floor(Game.time % Object.keys(creep.carry).length)]);
                        else creep.moveWithPath(room.storage, {repath: 0.01, maxRooms: 1});
                    }

                }
            }


            //get more creeps
            if (Game.time % 3 == 0) {
                var numberOfCreepsNeeded = this.getNumberOfCarriers(room);
                if (creeps.length < numberOfCreepsNeeded) Memory.crps.push(module.exports.room.addToSQ(room.name, 'iRmHaul'));
                else if (creeps.length == 0 && numberOfCreepsNeeded == 0) return {response: 'end'};
            }
        },

        getNumberOfCarriers: function (room) {
            var links = room.getStructures(STRUCTURE_LINK).length;
            return links >= 3 ? 0 : (links >= 2 ? 1 : 2);
        },

        placeStorage: function (room) {
            if (room.storage || _.size(Game.constructionSites) >= 100) return;
            if (Game.time % 11 == 0) {

                var distrFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
                if (!distrFlag || distrFlag.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1)[0]) return;

                room.createConstructionSite((distrFlag.pos.x + 1), (distrFlag.pos.y), STRUCTURE_STORAGE);
            }
        }
    },

    praiseRC: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room || room.memory.minimal) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (!creeps) {
                Memory.crps = [];
                creeps = Memory.crps;
            }

            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'praiseRC');
                    if (creep == 'dead') {
                        creep = undefined;
                    }

                    if (!creep) {
                        if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        continue;
                    }
                    else if (creep.spawning) continue;

                    creep.talk('praiseRC');

                    if (creep.carry.energy == 0) {
                        if (Game.cpu.bucket > 9000 && (creep.memory.w == 0 || creep.memory.w == 2) && (!room.controller.sign || Game.time-room.controller.sign.time > 501 || room.controller.sign.username != creep.owner.username)) creep.memory.w = 2;
                        else creep.memory.w = 1;
                    }
                    else if (creep.carry.energy == creep.carryCapacity) creep.memory.w = 0;

                    if (creep.memory.w == 1) {
                        this.getEnergy(Memory, creep);
                    }
                    else if (creep.memory.w == 2) {
                        if (creep.pos.isNearTo(room.controller)) {
                            if (creep.signController(creep.room.controller, global.controllerSigns[Math.round(Game.time % global.controllerSigns.length)]) == OK) creep.memory.w = 3;
                        }
                        else creep.moveWithPath(room.controller, {repath: 0.01, maxRooms: 1});
                    }
                    else {
                        if (creep.upgradeController(room.controller) == ERR_NOT_IN_RANGE) creep.moveWithPath(room.controller, {range: 1, repath: 0.01, maxRooms: 1, ignoreCreeps: false});
                        else if (creeps.length >= 2 && creep.pos.getRangeTo(room.controller) > 2) creep.moveTo(room.controller);
                    }

                }
            }

            //get more creeps
            if (creeps.length < this.getNumberOfUpgraders(room)) Memory.crps.push(module.exports.room.addToSQ(room.name, 'praiseRC'));
            else if (creeps.length < 1 && this.getNumberOfUpgraders(room) < 1) return {response: 'end'}
        },

        getNumberOfUpgraders: function (room) {
            if (room.controller.level <= 3) {
                return 5;
            }
            else {
                if (room.controller.level < 6) {
                    var storage = room.storage;

                    if (!storage) return 1;

                    return Math.floor((storage.store.energy - 20000) / 20000) > 1 ? Math.min(Math.floor((storage.store.energy - 20000) / 20000), 7) : 1;
                }
                else if (room.controller.level < 8) {
                    var storage = room.storage;

                    if (!storage) return 1;
                    
                    var totalEnergy = room.terminal ? (storage.store.energy || 0)+(room.terminal.store.energy || 0) : storage.store.energy;

                    return Math.floor(totalEnergy / 20000) > 1 ? Math.min(Math.floor(totalEnergy / 20000), 7) : 1;
                }
                else return room.controller.ticksToDowngrade <= CONTROLLER_DOWNGRADE[room.controller.level]*0.5 ? 1 : 0;
            }
        },

        getEnergy: function (Memory, creep, room = creep.room) {
            var randomHash = Memory.RH;

            if (!randomHash || !global[randomHash]) {
                randomHash = getRandomHash();
                global[randomHash] = {};
                Memory.RH = randomHash;
            }

            if (global[randomHash] && (!global[randomHash].l || !Memory.lt || Game.time - Memory.lt > 101)) {
                if (room.controller) global[randomHash].l = room.controller.pos.findInRange(room.getStructures(STRUCTURE_LINK), 3)[0];
                Memory.lt = Game.time;
            }

            var link = global[randomHash].l;

            if (link && link.energy > 0 && (room.storage && creep.pos.findClosestByRange([link, room.storage]) == link)) {
                if (creep.pos.isNearTo(link.pos)) {
                    creep.withdraw(link, RESOURCE_ENERGY);

                }
                else creep.moveWithPath(link, {repath: 0.01, maxRooms: 1});
            }
            else {
                creep.getConsumerEnergy(room);

                if (Game.time % 101 == 0 && _.size(Game.constructionSites) < 100 && room.controller.level >= 6 && room.controller.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 3).length < 1 && room.controller.pos.findInRange(FIND_MY_STRUCTURES, 3, {filter: (s) => s.structureType == STRUCTURE_LINK}).length < 1
                    && CONTROLLER_STRUCTURES[STRUCTURE_LINK][room.controller.level] > room.getStructures(STRUCTURE_LINK).length) {
                    var path = room.storage.pos.findPathTo(room.controller.pos);

                    var linkPos = new RoomPosition(path[path.length-1].x, path[path.length-1].y, room.name);
                    if (linkPos) room.createConstructionSite(linkPos, STRUCTURE_LINK);
                }
            }
        }
    },

    takeCare: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};
            if (!creeps) {
                Memory.crps = [];
                creeps = Memory.crps;
            }


            //creep loop
            for (let creep_it_it in creeps) {
                if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                let creep = getCreep(creeps[creep_it_it].split(':')[0], 'praiseRC');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!room.memory.spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                    continue;
                }
                else if (creep.spawning) continue;


                creep.talk('takeCare');

                if (creep.carry.energy == 0) creep.memory.w = 1;
                else if (creep.carry.energy == creep.carryCapacity) creep.memory.w = 0;

                if (creep.room.name != room.name) return creep.moveWithPath(room.getPositionAt(25, 25), {
                    range: 21,
                    repath: 0.01,
                    maxRooms: 16
                });

                if (creep.memory.w == 1) {
                    creep.getConsumerEnergy(room);
                }
                else {
                    var structureToRepair = this.findStructureToRepair(Memory, room, creep);
                    if (structureToRepair) {
                        if (creep.pos.getRangeTo(structureToRepair) > 3) creep.moveWithPath(structureToRepair, {
                            range: 3,
                            repath: 0.01,
                            maxRooms: 1
                        });
                        else creep.repair(structureToRepair);
                    }
                    else if (room.controller.level == 8 && room.controller.ticksToDowngrade < CONTROLLER_DOWNGRADE[room.controller.level] * 0.75) {
                        if (creep.pos.getRangeTo(room.controller) > 3) creep.moveWithPath(room.controller, {
                            range: 3,
                            repath: 0.01,
                            maxRooms: 1
                        });
                        else creep.upgradeController(room.controller);
                    }
                    else {
                            var towerToRefill = this.getTowerToRefill(Memory, room);
                            if (towerToRefill) {
                                if (creep.pos.isNearTo(towerToRefill)) creep.transfer(towerToRefill, RESOURCE_ENERGY);
                                else creep.moveWithPath(towerToRefill, {repath: 0.01, maxRooms: 1});
                            }
                        else {
                            var structureToBuild = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
                            if (structureToBuild) {
                                if (creep.pos.getRangeTo(structureToBuild) > 3) creep.moveWithPath(structureToBuild, {
                                    range: 3,
                                    repath: 0.01,
                                    maxRooms: 1
                                });
                                else creep.build(structureToBuild);
                            }
                            else {
                                var defenseToRepair = this.findDefence(Memory, room, creep);
                                if (defenseToRepair) {
                                    if (creep.pos.getRangeTo(defenseToRepair) > 3) creep.moveWithPath(defenseToRepair, {
                                        range: 3,
                                        repath: 0.01,
                                        maxRooms: 1
                                    });
                                    else creep.repair(defenseToRepair);
                                }
                                else {
                                    creep.runInSquares();
                                    return {response: 'idle', time: Game.time+3};
                                }
                            }
                        }
                        }

                }
            }

            //get more creeps
            if (creeps.length < this.getNumberOfCaretakers(room)) Memory.crps.push(module.exports.room.addToSQ(room.name, 'takeCare'));
        },

        getNumberOfCaretakers: function (room) {
            if (room.controller.level <= 3 || !room.storage) return 3;
            else return 1;
        },

        //OLD CODE WHEN THERE WAS ONLY ONE CARETAKER, IT HAS SOME USEFUL STUFF THOUGH
        // getCreep: function (Memory, room) {
        //     if (room.energyCapacityAvailable >= 400) return Memory.creep = module.exports.room.addToSQ(room.name, 'takeCare', {name: Memory.creep});
        //
        //     var nearestRoom = Game.rooms[Memory.nr];
        //     if (!nearestRoom) {
        //         var newR = _.min(Game.rooms, (r) => {
        //             return r.find(FIND_MY_SPAWNS).length > 0 && r.energyCapacityAvailable >= 550 ? Game.map.getRoomLinearDistance(r.name, room.name) : undefined;
        //         });
        //         Memory.nr = newR ? newR.name : undefined;
        //
        //         return Memory.creep = module.exports.room.addToSQ(room.name, 'takeCare', {name: Memory.creep});
        //     }
        //
        //     if (nearestRoom.controller.level <= room.controller.level || Game.map.getRoomLinearDistance(room.name, nearestRoom.name) > 10) return Memory.creep = module.exports.room.addToSQ(room.name, 'takeCare', {name: Memory.creep});
        //
        //     return Memory.creep = module.exports.room.addToSQ(nearestRoom.name, 'takeCare', {name: Memory.creep});
        // },

        findStructureToRepair: function (Memory, room, creep) {
            var structure = Memory.str ? Game.getObjectById(Memory.str) : undefined;

            if (room.memory.repairQueue && (!structure || structure.structureType == STRUCTURE_WALL || structure.hits >= structure.hitsMax || (structure.structureType == STRUCTURE_RAMPART && structure.hits > RAMPART_DECAY_AMOUNT*RAMPART_DECAY_TIME/3))) {
                structure = Game.getObjectById(room.memory.repairQueue[0]);
                if (room.memory.repairQueue && room.memory.repairQueue.length > 0)room.memory.repairQueue.splice(0, 1);

                Memory.str = structure && structure.hits < structure.hitsMax ? structure.id : undefined;
            }

            return structure;
        },

        findDefence: function (Memory, room, creep) {
            var structure = Memory.strD ? Game.getObjectById(Memory.strD) : undefined;
            var goal = Memory.gl;

            if (!structure || !goal || structure > goal) {
                structure = _.min(room.getStructures(STRUCTURE_RAMPART).concat(room.getStructures(STRUCTURE_RAMPART)), (s) => s.hits);
                if (structure.hits > WALL_RAMPART_MAX_HITS) return;//30M rampart hp cap
                Memory.gl = structure.hits + 10000 > structure.hitsMax ? structure.hitsMax : structure.hits + 10000;
            }

            Memory.strD = structure && structure.hits < goal ? structure.id : undefined;

            return structure;
        },

        getTowerToRefill: function (Memory, room) {
            var tower = _.min(room.getStructures(STRUCTURE_TOWER), 'energy');

            return tower && tower.energy < tower.energyCapacity ? tower : undefined;
        }
    },

    minimalist: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creep = Memory.creep ? getCreep(Memory.creep, 'minimalist') : undefined;
            if (creep == 'dead') {
                Memory.creep = undefined;
                creep = undefined;
            }

            var room = Game.rooms[Memory.rmN];
            if (!room || !room.memory.minimal) return {response: 'end'};
            if (!global[room.name]) global[room.name] = {};

            if (creep) {
                if (creep.spawning) return;

                creep.talk('minimalist');

                if (_.sum(creep.carry) == creep.carryCapacity) creep.memory.w = true;
                else if (_.sum(creep.carry) == 0) creep.memory.w = false;

                if (creep.memory.d) {
                    var rsl = this[creep.memory.d](Memory, room, creep);
                    if (rsl === 'finished' || rsl === false) creep.memory.d = undefined;
                    else if (rsl === 'sleep') return {response: 'idle', time: 5};
                }
                else {
                    if (this.fillSpawn(Memory, room, creep) === true) creep.memory.d = 'fillSpawn';
                    else if (this.fillExts(Memory, room, creep) === true) creep.memory.d = 'fillExts';
                    else if (this.resetDG(Memory, room, creep) === true) creep.memory.d = 'resetDG';
                    else if (this.harvest(Memory, room, creep) === true) creep.memory.d = 'harvest';
                }
            }
            else this.getCreep(Memory, room);
        },

        getCreep: function (Memory, room) {
            return Memory.creep = module.exports.room.addToSQ(room.name, 'minimalist', {name: Memory.creep});
        },

        fillSpawn: function (Memory, room, creep) {
            var spawnsToFill = room.getStructures(STRUCTURE_SPAWN, (s) => s.energy < s.energyCapacity);

            if (spawnsToFill.length < 1) return false;

            if (creep.memory.w == true) {
                if (creep.pos.isNearTo(spawnsToFill[0])) {if (creep.transfer(spawnsToFill[0], RESOURCE_ENERGY) == OK) return 'finished';}
                else creep.moveWithPath(spawnsToFill[0], {maxRooms: 1});
            }
            else creep.getConsumerEnergy();

            return true;
        },

        fillExts: function (Memory, room, creep) {
            var extsToFill = room.getStructures(STRUCTURE_EXTENSION, (s) => s.energy < s.energyCapacity);

            if (extsToFill.length < 1) return false;

            if (creep.memory.w == true) {
                if (creep.pos.isNearTo(extsToFill[0])) creep.transfer(extsToFill[0], RESOURCE_ENERGY);
                else creep.moveWithPath(extsToFill[0], {maxRooms: 1});
            }
            else {
                var container = creep.pos.findClosestByRange(room.getStructures(STRUCTURE_CONTAINER, (s) => s.store.energy > 0));
                if (!container) creep.getConsumerEnergy();
                else {
                    if (creep.pos.isNearTo(container)) creep.withdraw(container, RESOURCE_ENERGY);
                    else creep.moveWithPath(container, {maxRooms: 1});
                }
            }

            return true;
        },

        resetDG: function (Memory, room, creep) {
            if (creep.memory.w == true) {
                if (creep.pos.getRangeTo(room.controller.pos) > 3) creep.moveWithPath(room.controller, {range: 3, maxRooms: 1});
                else creep.upgradeController(room.controller);
            }
            else {
                if (CONTROLLER_DOWNGRADE[8]-room.controller.ticksToDowngrade < 5000) return false;
                creep.getConsumerEnergy();
            }

            return true;
        },

        harvest: function (Memory, room, creep) { //never fails
            var source = Game.getObjectById(Memory.source);
            
            if (!source) {
                var newS = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                Memory.source = newS ? newS.id : undefined;
                
                if (newS) source = newS;
                else return 'sleep';
            }
            
            if (creep.memory.w == true) {
                var link = creep.pos.findClosestByRange(room.getStructures(STRUCTURE_LINK));

                if (creep.pos.isNearTo(link.pos)) {if (creep.transfer(link, RESOURCE_ENERGY) == OK) return 'finished';}
                else creep.moveWithPath(link, {maxRooms: 1})
            }
            else {
                if (creep.pos.isNearTo(source)) creep.harvest(source);
                else creep.moveWithPath(source, {maxRooms: 1});
            }

            return true;
        }
    },

    remoteHandler: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var roomName = Memory.rmN;
            if (!roomName) return {response: 'end'};
            if (!global[roomName]) global[roomName] = {};

            var nearestRoom = Game.rooms[Memory.nr];
            if (!nearestRoom) {
                var newR = _.min(Game.rooms, (r) => {
                    return r.find(FIND_MY_SPAWNS).length > 0 ? Game.map.findRoute(r.name, roomName).length : Number.POSITIVE_INFINITY;
                });
                Memory.nr = newR ? newR.name : undefined;
                nearestRoom = Game.rooms[Memory.nr];
                roomName = Memory.rmN;
                if (Game.map.findRoute(nearestRoom.name, roomName).length > 3) return {response: 'end'}
            }


            //reservers
            if (!Memory.reservers) Memory.reservers = [];

            var reservers = Memory.reservers;

            for (var creepName_it in reservers) {
                if (typeof reservers[creepName_it] == 'number') reservers[creepName_it] = reservers[creepName_it].toString();

                var creep = getCreep(reservers[creepName_it].split(':')[0], 'remoteHandler');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!nearestRoom.memory.spawnQueue[reservers[creepName_it]]) reservers.splice(creepName_it, 1);
                    continue;
                }

                creep.talk('remoteHandler');

                this.doReserver(creep, roomName);
            }

            if ((Game.rooms[roomName] && Game.rooms[roomName].controller) && (reservers.length < 1 || reservers[0].ticksToLive) < 100 && nearestRoom.energyCapacityAvailable >= 700) Memory.reservers.push(module.exports.room.addToSQ(nearestRoom.name, 'reserver'));


            //harvesters
            if (!Memory.harvesters) Memory.harvesters = [];

            var harvesters = Memory.harvesters;

            for (var creepName_it in harvesters) {
                if (typeof harvesters[creepName_it] == 'number') harvesters[creepName_it] = harvesters[creepName_it].toString();

                var creep = getCreep(harvesters[creepName_it].split(':')[0], 'remoteHandler');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!nearestRoom.memory.spawnQueue[harvesters[creepName_it]]) harvesters.splice(creepName_it, 1);
                    continue;
                }

                creep.talk('remoteHandler');

                this.doHarvester(creep, roomName, harvesters);
            }

            if (harvesters.length < this.getNumberOfHarvesters(roomName)) Memory.harvesters.push(module.exports.room.addToSQ(nearestRoom.name, 'harvesters'));


            //haulers
            if (!Memory.haulers) Memory.haulers = [];

            var haulers = Memory.haulers;

            for (var creepName_it in haulers) {
                if (typeof haulers[creepName_it] == 'number') haulers[creepName_it] = haulers[creepName_it].toString();

                var creep = getCreep(haulers[creepName_it].split(':')[0], 'remoteHandler');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!nearestRoom.memory.spawnQueue[haulers[creepName_it]]) haulers.splice(creepName_it, 1);
                    continue;
                }

                creep.talk('remoteHandler');

                this.doHaulers(creep, roomName, nearestRoom);
            }

            if (haulers.length < this.getNumberOfHarvesters(roomName)) Memory.haulers.push(module.exports.room.addToSQ(nearestRoom.name, 'haulers'));


            //guards
            if (!Memory.guards) Memory.guards = [];

            var guards = Memory.guards;

            for (var creepName_it in guards) {
                if (typeof guards[creepName_it] == 'number') guards[creepName_it] = guards[creepName_it].toString();

                var creep = getCreep(guards[creepName_it].split(':')[0], 'remoteHandler');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!nearestRoom.memory.spawnQueue[guards[creepName_it]]) guards.splice(creepName_it, 1);
                    continue;
                }

                creep.talk('remoteHandler');

                this.doGuards(creep, roomName);
            }
    
            if (guards.length < this.getNumberOfGuards(roomName) || (guards[0] && guards[0].ticksToLive < 200)) Memory.guards.push(module.exports.room.addToSQ(nearestRoom.name, 'guards'));


            //miner
            if (!Memory.miners) Memory.miners = [];

            var miners = Memory.miners;

            for (var creepName_it in miners) {
                if (typeof miners[creepName_it] == 'number') miners[creepName_it] = miners[creepName_it].toString();

                var creep = getCreep(miners[creepName_it].split(':')[0], 'remoteHandler');
                if (creep == 'dead') {
                    creep = undefined;
                }

                if (!creep) {
                    if (!nearestRoom.memory.spawnQueue[miners[creepName_it]]) miners.splice(creepName_it, 1);
                    continue;
                }

                creep.talk('remoteHandler');

                this.doMiners(creep, roomName);
            }

            if ((Game.rooms[roomName] && Game.rooms[roomName].getStructures(STRUCTURE_EXTRACTOR).length > 0 && Game.rooms[roomName].getStructures(STRUCTURE_EXTRACTOR)[0].isActive()) && (miners.length < Game.rooms[roomName].getStructures(STRUCTURE_EXTRACTOR).length || (reservers[0] && reservers[0].ticksToLive < 200))) Memory.miners.push(module.exports.room.addToSQ(nearestRoom.name, 'miners'));
        },

        getNumberOfHarvesters: function (roomName) {
            return Game.rooms[roomName] ? Game.rooms[roomName].find(FIND_SOURCES).length : 1;
        },

        getNumberOfGuards: function (roomName) {
            return Game.rooms[roomName] ? Game.rooms[roomName].getStructures(STRUCTURE_KEEPER_LAIR).length > 0 ? 2 : 0 : 1;
        },

        doReserver: function (creep, roomName) {
            var room = Game.rooms[roomName];
            if (creep.pos.roomName == roomName) {
                if (creep.pos.isNearTo(room.controller)) {
                    if (!room.controller.reservation || room.controller.reservation.ticksToEnd < CONTROLLER_RESERVE_MAX-(CONTROLLER_RESERVE*3)) {
                        creep.reserveController(room.controller);
                        if (Game.cpu.bucket > 9000 && (!room.controller.sign || Game.time-room.controller.sign.time > 501 || room.controller.sign.username != creep.owner.username)) creep.signController(creep.room.controller, global.controllerSigns[Math.round(Game.time % global.controllerSigns.length)]);
                    }
                }
                else creep.moveWithPath(room.controller);
            }
            else creep.travelTo(new RoomPosition(21, 21, roomName), {range: 21, repath: 0.01})
        },

        doMiners: function (creep, roomName) {
            var room = Game.rooms[roomName];
            if (creep.pos.roomName == roomName) {
                var mineral = room.find(FIND_MINERALS)[0];
                var extractor = Game.rooms[roomName].getStructures(STRUCTURE_EXTRACTOR)[0];

                if (mineral && extractor && mineral.pos.findInRange(FIND_HOSTILE_CREEPS).length < 1) {
                    if (creep.pos.isNearTo(mineral)) { if (!extractor.cooldown) creep.harvest(mineral);}
                    else creep.moveWithPath(mineral);
                }
            }
            else creep.travelTo(new RoomPosition(21, 21, roomName), {range: 21, repath: 0.01})
        },

        doGuards: function (creep, roomName) {
            var room = Game.rooms[roomName];
            if (creep.pos.roomName == roomName) {
                if (creep.hits < creep.hitsMax) creep.heal(creep);

                var hostile = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())});

                if (hostile) {
                    if (creep.pos.isNearTo(hostile.pos)) {
                        creep.attack(hostile);
                        creep.move(creep.pos.getDirectionTo(hostile.pos));
                    }
                    else {
                        creep.moveTo(hostile, {repath: 2});
                    }

                    if (creep.pos.getRangeTo(hostile.pos) < 3) creep.rangedAttack(hostile);
                }
                else {
var lairs = room.getStructures(STRUCTURE_KEEPER_LAIR);
                    var lair = _.min(lairs, (kl) => kl.ticksToSpawn);

                    if (lairs.length > 0 && lair && !creep.pos.isNearTo(lair.pos)) creep.travelTo(lair);
                }
            }
            else creep.travelTo(new RoomPosition(21, 21, roomName), {range: 21, repath: 0.01})
        },

        doHarvester: function (creep, roomName, crps) {
            var room = Game.rooms[roomName];
            if (creep.pos.roomName == roomName) {
                var source = Game.getObjectById(creep.memory.src);

                if (source) {
                    if (source.pos.findInRange(FIND_HOSTILE_CREEPS).length > 0) return;

                    if (!creep.pos.isNearTo(source)) creep.moveWithPath(source, {repath: 0.01, maxRooms: 1});
                    else if (source.energy) creep.harvest(source)
                }
                else {
                    var takenSources = [];
                    _.forEach(crps, (c) => {
                        c = c.toString();
                        c = Game.creeps[c.split(':')[0]];
                        if (c && c.memory.src) takenSources.push(c.memory.src);
                    });

                    var zeChosn = room.find(FIND_SOURCES, {filter: (s) => !takenSources.includes(s.id)})[0];

                    if (zeChosn && zeChosn.id) creep.memory.src = zeChosn.id;
                    else {
                        zeChosn = creep.pos.findClosestByPath(FIND_SOURCES);
                        creep.memory.src = zeChosn ? zeChosn.id : undefined;
                    }
                }

                if (creep.carry.energy && creep.carry.energy >= (creep.carryCapacity - HARVEST_POWER * creep.getActiveBodyparts(WORK))) creep.drop(RESOURCE_ENERGY);
            }
            else creep.travelTo(new RoomPosition(21, 21, roomName), {range: 21, repath: 0.01})
        },

        doHaulers: function (creep, roomName, nearestRoom) {
            if (_.sum(creep.carry) == creep.carryCapacity) creep.memory.w = 0;
            else if (_.sum(creep.carry) == 0) creep.memory.w = 1;

            if (creep.memory.w == 1) {
                if (creep.pos.roomName == roomName) {
                    creep.getCarrierResources();
                }
                else creep.travelTo(new RoomPosition(21, 21, roomName), {range: 21, repath: 0.01});
            }
            else {
                if (creep.pos.roomName == nearestRoom.name) {
                    var toPut = nearestRoom.storage || creep.pos.findClosestByRange(nearestRoom.getStructures(STRUCTURE_CONTAINER)) || nearestRoom.find(FIND_MY_SPAWNS)[0];

                    if (creep.pos.isNearTo(toPut)) {
                        if (toPut.structureType == STRUCTURE_SPAWN) {
                            creep.transfer(toPut, RESOURCE_ENERGY);
                        }
                        else {
                            creep.transfer(toPut, Object.keys(creep.carry)[Math.floor(Game.time % Object.keys(creep.carry).length)]);
                        }
                    }
                    else {
                        creep.moveWithPath(toPut, {range: 1, repath: 0.01, maxRooms: 1});
                    }
                }
                else {
                    creep.travelTo(new RoomPosition(21, 21, nearestRoom.name), {range: 21, repath: 0.01});
                }
            }
        }
    }
};
