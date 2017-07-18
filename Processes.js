require('prototype.room');
require('prototype.creep');

const processSpawn = require('process.spawn');

function getCreep(name, process) {
    var creep = Game.creeps[name];

    if (!process || !creep) return creep ? creep : undefined;

    if (!creep.memory.p || !creep.memory.p == process) creep.memory.p = process;
    creep.memory.l = Game.time;

    if (creep.room.storage && creep.ticksToLive <= creep.pos.getRangeTo(creep.room.storage)) {
        spawnNewProcess('deadCreepHandler', creep.room.name, creep.name);
    }

    return creep ? creep : undefined;
}

const defaultBodyChart = {
    doHarvest: [[WORK, MOVE, MOVE, CARRY], [], 5],
    praiseRC: [[WORK, CARRY, MOVE], []],
    mine: [[WORK, CARRY, MOVE], []],
    strgDistr: [[CARRY, CARRY, MOVE], [], 8],
    fillSpawn: [[CARRY, CARRY, MOVE], [], 6],
    fillExt: [[CARRY, CARRY, MOVE], []],
    iRmHaul: [[CARRY, CARRY, MOVE], []],
    takeCare: [[WORK, CARRY, MOVE], []],
    claim: [[CLAIM, MOVE, MOVE], [], 1],
    buildSpawn: [[WORK, MOVE, CARRY], []],
    stealEnergy: [[CARRY, MOVE, MOVE], []]
};

function getBodyChart(room) {
    var newChart = _.clone(defaultBodyChart);

    if (room) {
        if (room.find(FIND_MY_CONSTRUCTION_SITES).length < 1) newChart['takeCare'][2] = 5;
        newChart['fillSpawn'][2] = room.find(FIND_MY_SPAWNS)*3;
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
    //global processes

    init: {
        run: function () {
            global.Mem.notify = [];
            global.Mem.creeps = {};
            global.Mem.p = {};
            global.Mem.init = true;

            spawnNewProcess('checkForToken');
            spawnNewProcess('doStats');
            spawnNewProcess('checkRooms');
            spawnNewProcess('checkCreeps');
            spawnNewProcess('checkGlobalProcesses');
        }
    },

    checkForToken: {
        run: function () {
            var token = _.min(Game.market.getAllOrders({resourceType: SUBSCRIPTION_TOKEN, type: ORDER_SELL}), (o) => o.price);
            if (token && token.price < Game.market.credits) Game.market.deal(token.id, 1);
        }
    },

    doStats: {
        run: function () {
            Memory.stats = {
                tick: Game.time,
                cpu: _.cloneDeep(Game.cpu),
                gcl: Game.gcl,
                constructionSites: _.size(Game.constructionSites),
                tokens: Game.resources.token,

                memory: {
                    used: RawMemory.get().length
                },

                market: {
                    credits: Game.market.credits,
                    num_orders: Game.market.orders ? Object.keys(Game.market.orders).length : 0,
                }

            }
        }
    },

    checkGlobalProcesses: {
        run: function () {

            if (!Memory.nc || Game.time > Memory.nc) {
                Memory.nc = Game.time + 100 + Math.round(Math.random() * 100);

                (function () {
                    var flag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'claim')[0];

                    if (flag && (!flag.room || !flag.room.controller.my) && _.filter(global.Mem.p, (p) => p.pN == 'claim').length < 1) spawnNewProcess('claim');
                }());

                (function () {
                    var flag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'steal' && Game.rooms[f.name.split(' ')[1]])[0];

                    if (flag && _.filter(global.Mem.p, (p) => p.pN == 'stealEnergy').length < 1) spawnNewProcess('stealEnergy');
                }());
            }
        }
    },

    checkRooms: {
        run: function () {
            for (let roomName in Game.rooms) {
                let room = Game.rooms[roomName];
                if (!room || !room.controller || !room.controller.my || room.find(FIND_MY_SPAWNS).length < 1) continue;
                
                if (!Memory.p['room:' + roomName]) {
                    _.forEach(room.find(FIND_MY_CREEPS, (c) => {
                        c.suicide();
                    }));
                    Memory.p['room:' + roomName] = new Process('room', roomName);
                }
            }
        }
    },

    checkCreeps: {
        run: function () {
            if (Game.time % 7 != 0) return;

            _.forEach(Game.creeps, (creep) => {
                if (!creep.memory.p || !creep.memory.l || Game.time - creep.memory.l > 4) {
                    if (isUndefinedOrNull(creep.memory.nc)) creep.memory.nc = 0;
                    else creep.memory.nc++;

                    if (creep.memory.nc > 13) {
                        spawnNewProcess('deadCreepHandler', creep.room.name, creep.name);
                    }
                }
                else delete creep.memory.nc;
            });
        }
    },

    //global processes (not tied to room)
    deadCreepHandler: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            if (Memory.oNCreation) {
                Memory.creep = _.clone(Memory.oNCreation);
                delete Memory.oNCreation;
                return;
            }

            if (Memory.rmN) delete Memory.rmN;

            var creep = Game.creeps[Memory.creep];

            if (!creep || !creep.room.storage || _.sum(creep.room.storage.store) >= creep.room.storage.storeCapacity) return 'end';

            if (_.sum(creep.carry) == 0) return creep.suicide();

            if (creep.pos.isNearTo(creep.room.storage)) creep.transfer(creep.room.storage, Object.keys(creep.carry)[Math.floor(Math.random() * Object.keys(creep.carry).length)]);
            else creep.travelTo(creep.room.storage, {range: 1, repath: 0.01, maxRooms: 1});
        }
    },

    stealEnergy: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            var flag = Game.flags[Memory.f];

            if (!flag || !room) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'steal' && Game.rooms[f.name.split(' ')[1]])[0];
                Memory.rmN = newFlag ? newFlag.name.split(' ')[1] : undefined;
                return newFlag ? Memory.f = newFlag.name : 'end';
            }

            if (Game.creeps[Memory.crp] || global.Mem.p['room:' + room.name].spawnQueue[Memory.crp]) {
                if (!Game.creeps[Memory.crp]) return;
                var creep = getCreep(Memory.crp, 'stealEnergy');
                creep.say('stealEnergy');

                if (_.sum(creep.carry) == 0) creep.memory.w = 1;
                else if (_.sum(creep.carry) >= creep.carryCapacity) creep.memory.w = 0;

                if (creep.memory.w == 1) {
                    if (creep.pos.roomName != flag.pos.roomName) {
                        creep.travelTo(new RoomPosition(25, 25, flag.pos.roomName), {range: 23, repath: 0.01, maxRooms: 16});
                    }
                    else {
                        var thingToStealFrom = creep.room.terminal.store[RESOURCE_ENERGY] ? creep.room.terminal : creep.room.storage.store[RESOURCE_ENERGY] ? creep.room.storage : undefined;

                        if (!thingToStealFrom) {
                            flag.remove();
                            return 'end';
                        }

                        if (creep.pos.isNearTo(thingToStealFrom.pos)) creep.withdraw(thingToStealFrom, RESOURCE_ENERGY);
                        else creep.travelTo(thingToStealFrom, {range: 1, repath: 0.01, maxRooms: 1});
                    }
                }
                else {
                    if (creep.pos.roomName != room.name) {
                        creep.travelTo(new RoomPosition(25, 25, room.name), {range: 23, repath: 0.01, maxRooms: 16});
                    }
                    else {
                        if (!room.storage) {
                            flag.remove();
                            return 'end';
                        }

                        if (creep.pos.isNearTo(room.storage.pos)) creep.transfer(room.storage, RESOURCE_ENERGY);
                        else creep.travelTo(room.storage, {range: 1, repath: 0.01, maxRooms: 1});
                    }
                }
            }
            else Memory.crp = module.exports.room.addToSQ('room:' + room.name, 'stealEnergy');
        }
    },

    claim: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var flag = Game.flags[Memory.f];
            if (!flag) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'claim')[0];
                return newFlag ? Memory.f = newFlag.name : 'end';
            }

            if (flag.room && flag.room.controller.my) {
                if (_.filter(global.Mem.p, (p) => p.pN == 'buildSpawn').length < 1) spawnNewProcess('buildSpawn');
                return 'end';
            }

            var nearestRoom = Game.rooms[Memory.nr];
            if (!nearestRoom) {
                var newR = _.min(Game.rooms, (r) => {
                    return r.find(FIND_MY_SPAWNS).length > 0 && r.energyCapacityAvailable >= 550 ? Game.map.getRoomLinearDistance(r.name, flag.pos.roomName) : undefined;
                });
                return Memory.nr = newR ? newR.name : undefined;
            }

            if (Game.creeps[Memory.crp] || global.Mem.p['room:' + nearestRoom.name].spawnQueue[Memory.crp]) {
                if (!Game.creeps[Memory.crp]) return;
                var creep = getCreep(Memory.crp, 'claim');
                creep.say('claim');

                if (creep.pos.roomName != flag.pos.roomName) {
                    creep.travelTo(new RoomPosition(25, 25, flag.pos.roomName), {range: 23, repath: 0.01, maxRooms: 16});
                }
                else {
                    if (creep.pos.isNearTo(creep.room.controller.pos)) creep.claimController(creep.room.controller);
                    else creep.travelTo(creep.room.controller, {range: 1, repath: 0.01, maxRooms: 1});
                }
            }
            else Memory.crp = module.exports.room.addToSQ('room:' + nearestRoom.name, 'claim');
        }
    },

    buildSpawn: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var flag = Game.flags[Memory.f];
            if (!flag) {
                var newFlag = _.filter(Game.flags, (f) => f.name.split(' ')[0] == 'claim')[0];
                return newFlag ? Memory.f = newFlag.name : 'end';
            }

            var nearestRoom = Game.rooms[Memory.nr];
            if (!nearestRoom) {
                var newR = _.max(Game.rooms, (r) => {
                    return r.find(FIND_MY_SPAWNS).length > 0 && Game.map.getRoomLinearDistance(r.name, flag.pos.roomName) < 11 ? r.energyAvailable : 0;
                });
                return Memory.nr = newR ? newR.name : undefined;
            }

            if (Game.creeps[Memory.crp] || global.Mem.p['room:' + nearestRoom.name].spawnQueue[Memory.crp]) {
                if (!Game.creeps[Memory.crp]) return;
                var creep = getCreep(Memory.crp, 'claim');
                creep.say('buildSpawn');

                if (creep.pos.roomName != flag.pos.roomName) {
                    creep.travelTo(new RoomPosition(25, 25, flag.pos.roomName), {range: 23, repath: 0.01, maxRooms: 16});
                }
                else {
                    if (_.sum(creep.carry) == creep.carryCapacity) creep.memory.w = true;
                    else if (_.sum(creep.carry) == 0) creep.memory.w = false;

                    if (creep.memory.w == true) {
                        if (creep.room.controller.ticksToDowngrade && creep.room.controller.ticksToDowngrade <= 2500) {
                            if (creep.pos.getRangeTo(creep.room.controller.pos) < 3) creep.upgradeController(creep.room.controller);
                            else creep.travelTo(creep.room.controller, {range: 2, repath: 0.01, maxRooms: 1});
                        }
                        else if (flag.room.find(FIND_MY_SPAWNS).length < 1) {
                            if (!flag.pos.findInRange(FIND_CONSTRUCTION_SITES, 1)[0]) return this.placeSpawn1(flag.pos);

                            if (creep.pos.getRangeTo(flag.pos) < 3) creep.build(flag.pos.findInRange(FIND_CONSTRUCTION_SITES, 1)[0]);
                            else creep.travelTo(flag, {range: 2, repath: 0.01, maxRooms: 1});
                        }
                        else {
                            if (creep.pos.getRangeTo(creep.room.controller.pos) < 3) creep.upgradeController(creep.room.controller);
                            else creep.travelTo(creep.room.controller, {range: 2, repath: 0.01, maxRooms: 1});
                        }
                    }
                    else {
                        var source = flag.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

                        if (source) {
                            if (creep.pos.isNearTo(source.pos)) creep.harvest(source);
                            else creep.travelTo(source, {range: 1, repath: 0.01, maxRooms: 1});
                        }
                    }
                }
            }
            else {
                if (!flag.room || flag.room.find(FIND_MY_SPAWNS) < 1) Memory.crp = module.exports.room.addToSQ('room:' + nearestRoom.name, 'buildSpawn');
                else {
                    flag.remove();
                    return 'end';
                 }
            }
        },

        placeSpawn1: function (flagPos) {
            if (!_.size(Game.constructionSites) < 100) {
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
            if (!room) return 'end';

            if (!Memory.spawnQueue) Memory.spawnQueue = {};

            if (!global[room.name]) global[room.name] = {};

            if (Game.time % 3 == 0 && room.find(FIND_HOSTILE_CREEPS).length > 0 && room.find(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())}).length > 0
                && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'doTowers').length < 1) spawnNewProcess('doTowers', Memory.rmN);

            if (Game.time % 11 == 0) {
                if (!global[room.name].distrSquareFlag) global[room.name].distrSquareFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
                if (!global[room.name].links || !global[room.name].links[0]) global[room.name].links = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}), (l) => {
                    return l.id
                });

                if (room.controller.level > 7 && room.storage) {
                    if (room.terminal && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'doTerminal').length < 1) spawnNewProcess('doTerminal', Memory.rmN);

                    var mineral = room.find(FIND_MINERALS)[0];
                    if (mineral && ((mineral.mineralAmount > 1 || mineral.ticksToRegeneration < 200) && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'mine').length < 1)) spawnNewProcess('mine', Memory.rmN);
                }
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'doHarvest').length < 1) spawnNewProcess('doHarvest', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'takeCare').length < 1) spawnNewProcess('takeCare', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'fillSpawn').length < 1) spawnNewProcess('fillSpawn', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'fillExt').length < 1) spawnNewProcess('fillExt', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'buildRoads').length < 1) spawnNewProcess('buildRoads', Memory.rmN);
                    if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'praiseRC').length < 1) spawnNewProcess('praiseRC', Memory.rmN);

                if (room.controller.level >= 4 && global[room.name].links.length < 3 && global[room.name].distrSquareFlag && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'iRmHaul').length < 1) spawnNewProcess('iRmHaul', Memory.rmN);

                if (room.controller.level >= 2 && global[room.name].distrSquareFlag && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'placeExtensions').length < 1) spawnNewProcess('placeExtensions', Memory.rmN);
                if (room.controller.level >= 3 && global[room.name].distrSquareFlag && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'placeTowers').length < 1) spawnNewProcess('placeTowers', Memory.rmN);

                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'strgDistr').length < 1) spawnNewProcess('strgDistr', Memory.rmN);
                if (room.controller.level >= 5 && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'doLinks').length < 1) spawnNewProcess('doLinks', Memory.rmN);
            }

            if (Game.time % 11 == 0 && room.controller.level >= 2 && !room.storage && !global[room.name].distrSquareFlag && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'placeStorage').length < 1) spawnNewProcess('placeStorage', Memory.rmN);

            this.spawn(Memory_it);
        },

        addToSQ: function (Memory_it, process, creepMem = {}) {
            var Memory = global.Mem.p[Memory_it];

            while (!creepMem.name || Game.creeps[creepMem.name]) creepMem.name = (Game.time % 1000) + '' + Math.round(Math.random() * 1000);
            creepMem.body = processSpawn.run(Game.rooms[Memory.rmN], _.clone(getBodyChart(Game.rooms[Memory.rmN])[process][0]), _.clone(getBodyChart(Game.rooms[Memory.rmN])[process][1]),
                (process == 'praiseRC' && Game.rooms[Memory.rmN] && Game.rooms[Memory.rmN].controller.level >= 8 ? 15 : _.clone(getBodyChart(Game.rooms[Memory.rmN])[process][2])));

            creepMem.proc = process;

            if (!Memory.spawnQueue[creepMem.name]) {
                Memory.spawnQueue[creepMem.name] = creepMem;
            }

            return creepMem.name;
        },

        spawn: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var nextToSpawn = _.sortBy(Memory.spawnQueue, (c) => {
                return c.proc == 'doHarvest' ? 0 : c.proc == 'fillSpawn' ? 1 : c.proc == 'fillExt' ? 2 : c.proc == 'claim' ? 3 : 4;
            })[0];

            if (!nextToSpawn) return;
            if (Game.creeps[nextToSpawn.name] || !nextToSpawn.body || !nextToSpawn.proc) return delete Memory.spawnQueue[nextToSpawn.name];

            var room = Game.rooms[Memory.rmN];

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

            var name = spawn.createCreep(nextToSpawn.body.body, nextToSpawn.name, {p: nextToSpawn.proc});

            if (Game.creeps[name]) console.logSpawn(room, name + ' ' + nextToSpawn.proc);
            else if (name == -6 || name == -10) delete Memory.spawnQueue[nextToSpawn.name];
        }
    },

    doTowers: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room || room.find(FIND_HOSTILE_CREEPS).length < 1) return 'end';
            if (!global[room.name]) global[room.name] = {};

            if (!global[room.name].towers || !global[room.name].towers[0]) global[room.name].towers = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER}), (t) => {return t.id});

            var towers = global[room.name].towers;
            if (towers.length < 1) return 'end';

            var baddies = room.find(FIND_HOSTILE_CREEPS, {filter: (c) => !global.allies.includes(c.owner.username.toLowerCase())});
            if (baddies.length < 1) return 'end';

            StructureTower.prototype.killIdiot = function (idiot) {
                if (!idiot || this.energy == 0) return;
                this.attack(idiot);
            };

            _.forEach(towers, (tower_id) => {
                var tower = Game.getObjectById(tower_id);
                tower.killIdiot(tower.pos.findClosestByRange(baddies));
            });
        }
    },

    placeStorage: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};
            if (room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0]) return 'end';

            var freeRange = 3;
            var bestPos;

            for (let x = 3; x < 46; x++) {
                for (let y = 3; y < 46; y++) {
                    let pos = new RoomPosition(x, y, room.name);

                    let exits = pos.findInRange(FIND_EXIT, freeRange);
                    if (exits.length > 0) continue;

                    let structs = pos.findInRange(FIND_STRUCTURES, freeRange, {filter: (s) => s.structureType != STRUCTURE_ROAD});
                    if (structs.length > 0) continue;

                    let terrain = _.filter(room.lookForAtArea(LOOK_TERRAIN, y - freeRange, x - freeRange, y + freeRange, x + freeRange, true), (p) => p.type == 'terrain' && p.terrain == 'wall');
                    if (terrain.length > 0) continue;

                    let goodPos = new RoomPosition(x, y, room.name);

                    let toSource = [];
                    let toController;

                    _.forEach(room.find(FIND_SOURCES), (s) => {
                        toSource.push(goodPos.getRangeTo(s));
                    });

                    toController = goodPos.getRangeTo(room.controller);

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

                    if (cnt >= 2 || (cnt >= 1 && toController <= bestPos.c)) {
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

            if (!Memory.nr || Game.time > Memory.nr) Memory.nr = Game.time + 10000 + Math.round(Math.random()*57);
            else return;

            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};

            var spawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
            var storageFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!spawnFlag || !storageFlag) return;

            if (!Memory.toDo) Memory.toDo = 0;
            if (!Memory.toDoQ) Memory.toDoQ = [spawnFlag.pos.x+','+spawnFlag.pos.y, storageFlag.pos.x+','+storageFlag.pos.y, room.controller.pos.x+','+room.controller.pos.y]
                .concat(_.map(room.find(FIND_SOURCES), (s) => {return s.pos.x+','+s.pos.y}));

            if (room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER}).length < CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level]) {
                this.placeTower(room, new RoomPosition(Memory.toDoQ[Memory.toDo].split(',')[0], Memory.toDoQ[Memory.toDo].split(',')[1], room.name));
                Memory.toDoQ = Memory.toDoQ+1 > Memory.toDo.length-1 ? 0 : Memory.toDoQ+1;
            }
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

        }
    },

    placeExtensions: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            if (!Memory.nr || Game.time > Memory.nr) Memory.nr = Game.time + 10000 + Math.round(Math.random()*57);
            else return;

            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};

            switch (Memory.toDo) {
                case 1:
                    Memory.toDo++;

                    if (Memory.ext
                        && room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_EXTENSION}) < CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][room.controller.level]) {

                        _.forEach(Memory.ext, (sPos) => {
                            var extensionPos = new RoomPosition(Number.parseInt(sPos.split(',')[0]), Number.parseInt(sPos.split(',')[1]), room.name);

                            if (extensionPos.lookFor(LOOK_CONSTRUCTION_SITES).length < 1 && extensionPos.lookFor(LOOK_STRUCTURES).length < 1) room.createConstructionSite(extensionPos, STRUCTURE_EXTENSION);
                        });
                    }
                    break;
                default:
                    var spawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
                    var storageFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
                    if (!spawnFlag || !storageFlag) return;

                    var extStyle = {radius: 0.3, fill: '#FF0000'};

                    if (!Memory.ext) {
                        var goals = [].concat(_.map(room.find(FIND_STRUCTURES), (s) => {
                            return {pos: s.pos, range: Math.round(2 + Math.random() * 2)};
                        }))
                            .concat(_.map(room.find(FIND_CONSTRUCTION_SITES), (s) => {
                                return {pos: s.pos, range: Math.round(2 + Math.random() * 2)};
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

                        var path = PathFinder.search(storageFlag.pos, goals, {
                            flee: true,
                            swampCost: 1,
                            plainCost: 1,
                            maxRooms: 1
                        });

                        _.forEach(path.path, (pathData) => {
                            room.visual.circle(pathData.x, pathData.y, {radius: 0.3});
                        });

                        if (path.path) {


                            var pos = path.path[path.path.length - 1];

                            var extGoals = [{
                                pos: new RoomPosition(pos.x, pos.y, room.name),
                                range: Math.round(2 + Math.random() * 5)
                            }]
                                .concat(_.map(room.find(FIND_STRUCTURES), (s) => {
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
                                    return {pos: s.pos, range: 5};
                                }));

                            var extensionPath = PathFinder.search(new RoomPosition(pos.x, pos.y, room.name), extGoals, {
                                flee: true,
                                swampCost: 1,
                                plainCost: 1,
                                maxRooms: 1
                            });

                            _.forEach(extensionPath.path, (pathData) => {
                                room.visual.circle(pathData.x, pathData.y, extStyle);
                            });

                            var toAdd = extensionPath.path[Math.round(Math.random() * extensionPath.path.length)];

                            Memory.ext = [toAdd.x + ',' + toAdd.y];
                        }

                    }
                    else if (Memory.ext.length < CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8]) {

                        var extPos = Memory.ext[Math.round(Math.random() * Memory.ext.length)];
                        if (!extPos) return;
                        var pos = {x: extPos.split(',')[0], y: extPos.split(',')[1]};

                        var extGoals = [{
                            pos: new RoomPosition(pos.x, pos.y, room.name),
                            range: Math.round(2 + Math.random() * 5)
                        }]
                            .concat(_.map(room.find(FIND_STRUCTURES), (s) => {
                                return s.structureType == STRUCTURE_EXTENSION ? {pos: s.pos, range: 1} : {pos: s.pos, range: Math.round(2 + Math.random() * 2)};
                            }))
                            .concat(_.map(room.find(FIND_CONSTRUCTION_SITES), (s) => {
                                return s.structureType == STRUCTURE_EXTENSION ? {pos: s.pos, range: 1} : {pos: s.pos, range: Math.round(2 + Math.random() * 2)};
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
                                return {pos: s.pos, range: 5};
                            }));

                        var extensionPath = PathFinder.search(new RoomPosition(pos.x, pos.y, room.name), extGoals, {
                            flee: true,
                            swampCost: 1,
                            plainCost: 1,
                            maxRooms: 1
                        });

                        _.forEach(extensionPath.path, (pathData) => {
                            if (Memory.ext.length < CONTROLLER_STRUCTURES[STRUCTURE_EXTENSION][8]
                                && Math.round(Math.random() * 3) > 1 && !Memory.ext.includes(pathData.x + ',' + pathData.y)) {
                                room.visual.circle(pathData.x, pathData.y, extStyle);
                                Memory.ext.push(pathData.x + ',' + pathData.y)
                            }
                        });
                    }
                    Memory.toDo = 1;
            }
        }
    },

    buildRoads: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            if (!Memory.nr || Game.time > Memory.nr) Memory.nr = Game.time + 10000 + Math.round(Math.random()*57);
            else return;

            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};

            var spawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
            var storageFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!spawnFlag || !storageFlag) return;

            var costMatrix = this.getCostMatrix(room.name, storageFlag, spawnFlag);

            switch (Memory.nb) {
                case 2:
                    Memory.nb++;
                    _.forEach(room.find(FIND_SOURCES), (structure) => {
                        _.forEach(storageFlag.pos.findPathTo(structure, {range: 2, ignoreCreeps: true, ignoreRoads: true, plainCost: 1, swampCost: 1, costCallback: costMatrix}), (pathData) => {
                            if (_.size(Game.constructionSites) < 100) {
                                if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]
                                    && _.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_TERRAIN), (s) => s == 'swamp')[0]) room.createConstructionSite(pathData.x, pathData.y, STRUCTURE_ROAD);
                            }
                        });
                    });
                    break;
                case 1:
                    Memory.nb++;
                    _.forEach(room.find(FIND_MY_STRUCTURES), (structure) => {
                        if (structure.structureType == STRUCTURE_EXTENSION) {
                            _.forEach(storageFlag.pos.findPathTo(structure, {range: 2, ignoreCreeps: true, ignoreRoads: true, plainCost: 1, swampCost: 1, costCallback: costMatrix}), (pathData) => {
                                if (_.size(Game.constructionSites) < 100) {
                                    if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]) room.createConstructionSite(pathData.x, pathData.y, STRUCTURE_ROAD);
                                }
                            });
                        }
                    });
                    break;
                case 0:
                    Memory.nb++;
                    if (room.controller.level < 5) return;
                    var mineral = room.find(FIND_MINERALS)[0];
                    _.forEach(storageFlag.pos.findPathTo(mineral, {range: 2, ignoreCreeps: true, ignoreRoads: true, plainCost: 1, swampCost: 1, costCallback: costMatrix}), (pathData) => {
                            if (_.size(Game.constructionSites) < 100) {
                                if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]) room.createConstructionSite(pathData.x, pathData.y, STRUCTURE_ROAD);
                            }
                        });
                    break;
                default:
                    Memory.nb = 0;
                    if (room.controller.level < 4) return;
                    _.forEach(storageFlag.pos.findPathTo(spawnFlag, {range: 2, ignoreCreeps: true, ignoreRoads: true, plainCost: 1, swampCost: 1}), (pathData) => {
                        if (_.size(Game.constructionSites) < 100) {
                            if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]) room.createConstructionSite(pathData.x, pathData.y, STRUCTURE_ROAD);
                        }
                    });
            }
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
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};

            if (!global[room.name].distrSquareFlag) global[room.name].distrSquareFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            var storageFlag = global[room.name].distrSquareFlag;
            if (!storageFlag) return;

            var randomHash = Memory.RH;

            if (!randomHash || !global[randomHash]) {
                randomHash = getRandomHash();
                global[randomHash] = {};
                Memory.RH = randomHash;
            }

            if (!global[room.name].links || !global[room.name].links[0]) global[room.name].links = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}), (l) => {return l.id});
            if (!global[room.name].sourcelinks || !global[room.name].sourcelinks[0]) global[room.name].sourcelinks = _.filter(global[room.name].links, (s) => {if (Game.getObjectById(s)) {return Game.getObjectById(s).pos.findInRange(FIND_SOURCES, 3)[0]}});

            var links = _.map(global[room.name].links, (l) => {return Game.getObjectById(l)});

            if (global[randomHash] && (!global[randomHash].sl || !Memory.lt || Game.time - Memory.lt > 101)) {
                global[randomHash].sl = storageFlag.pos.findInRange(links, 1)[0]
                    ? storageFlag.pos.findInRange(links, 1)[0].id : undefined;
                Memory.lt = Game.time;
            }

            var storageLink = Game.getObjectById(global[randomHash].sl);
            var sourceLinks = global[room.name].sourcelinks;
            var link = _.filter(links, (s) => s.energy < 50 && s.id != storageLink.id && !sourceLinks.includes(s.id))[0];

            if (!storageLink) return global[room.name].links = undefined;

            _.forEach(sourceLinks, (l_id) => {
                var l = Game.getObjectById(l_id);
                if (l.cooldown == 0 && l.energy >= l.energyCapacity) l.transferEnergy(storageLink);
            });
            
            
            if (link && storageLink.energy >= storageLink.energyCapacity-1 && (!room.storage || room.storage.store.energy > 1000)) {
                storageLink.transferEnergy(link);
            }
        }
    },
    
    doTerminal: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room || !room.terminal || room.controller.level < 8) return 'end';
            if (!global[room.name]) global[room.name] = {};
            if (!Memory.mineral) Memory.mineral = room.find(FIND_MINERALS)[0] ? room.find(FIND_MINERALS)[0].mineralType : undefined;
            if (Memory.credits === undefined) Memory.credits = 500;

            var currentStore = _.sum(room.terminal.store);
            if (Memory.expectedStore != currentStore) {
                Memory.credits +=Memory.creditChange;
            }

            Memory.creditChange = 0;
            Memory.expectedStore = _.clone(currentStore);

            if (!Memory.nextRun || Game.time > Memory.nextRun) {
                Memory.nextRun = Game.time + (34 + (Math.round(Math.random() * 11)));

                if (room.terminal.store[RESOURCE_ENERGY] < 50000) return;

                switch (Memory.n) {
                    case 1:
                        Memory.n++;

                        if (Memory.credits > 0 && _.sum(room.terminal.store) < room.terminal.storeCapacity) {
                            var bestBuy = _.min(Game.market.getAllOrders({
                                resourceType: Memory.mineral,
                                type: ORDER_SELL
                            }), (o) => {
                                if (o.amount >= 10) return o.price
                            });

                            if (!Memory.sellPrice || bestBuy.price < Memory.sellPrice) {
                                var transCost = Game.market.calcTransactionCost(1, room.name, bestBuy.roomName);

                                var amountToSend = Math.round((room.terminal.store.energy / 2) / transCost) > room.terminal.store[Memory.mineral] ? room.terminal.store[Memory.mineral] : Math.round((room.terminal.store.energy / 2) / transCost);
                                if (amountToSend > bestBuy.amount) amountToSend = bestBuy.amount;
                                if (amountToSend * bestBuy.price > Memory.credits) amountToSend = Math.floor(Memory.credits / bestBuy.price);
                                if (amountToSend > room.terminal.storeCapacity - _.sum(room.terminal.store)) amountToSend = room.terminal.storeCapacity - _.sum(room.terminal.store);

                                if (amountToSend > 0) {
                                    var rsl = Game.market.deal(bestBuy.id, amountToSend, room.name);
                                    console.terminalLog(room, 'Tried to buy ' + bestBuy.resourceType + ' Amount ' + amountToSend + ' At Price ' + bestBuy.price + ' Result ' + rsl);

                                    if (rsl == OK) {
                                        Memory.buyPrice = bestBuy.price;
                                        Memory.creditChange -=amountToSend * bestBuy.price;
                                        Memory.expectedStore +=amountToSend;
                                    }
                                }
                            }
                        }
                        break;
                    case 2:
                        Memory.n++;
                        if (Memory.credits > 0 && (!room.storage.store[RESOURCE_GHODIUM] || room.storage.store[RESOURCE_GHODIUM] < 2500)
                            && _.sum(room.terminal.store) < room.terminal.storeCapacity) {
                            var bestBuy = _.min(Game.market.getAllOrders({
                                resourceType: RESOURCE_GHODIUM,
                                type: ORDER_SELL
                            }), (o) => {
                                if (o.amount >= 10) return o.price
                            });

                            var transCost = Game.market.calcTransactionCost(1, room.name, bestBuy.roomName);

                            var amountToSend = Math.round((room.terminal.store.energy / 2) / transCost) > room.terminal.store[RESOURCE_GHODIUM] ? room.terminal.store[RESOURCE_GHODIUM] : Math.round((room.terminal.store.energy / 2) / transCost);
                            if (amountToSend > bestBuy.amount) amountToSend = bestBuy.amount;
                            if (amountToSend * bestBuy.price > Memory.credits) amountToSend = Math.floor(Memory.credits / bestBuy.price);
                            if (amountToSend > room.terminal.storeCapacity - _.sum(room.terminal.store)) amountToSend = room.terminal.storeCapacity - _.sum(room.terminal.store);

                            if (amountToSend > 0) {
                                var rsl = Game.market.deal(bestBuy.id, amountToSend, room.name);
                                console.terminalLog(room, 'Tried to buy ' + bestBuy.resourceType + ' Amount ' + amountToSend + ' At Price ' + bestBuy.price + ' Result ' + rsl);

                                if (rsl == OK) {
                                    Memory.creditChange -= amountToSend * bestBuy.price;
                                    Memory.expectedStore += amountToSend;
                                }
                            }
                        }
                        break;
                    case 3:
                        Memory.n++;
                        if (room.terminal.store[RESOURCE_ENERGY] >= 75000 && room.storage.store[RESOURCE_ENERGY] >= 50000) {
                            var order = _.max(Game.market.getAllOrders({
                                resourceType: RESOURCE_ENERGY,
                                type: ORDER_BUY
                            }), (o) => {
                                if (o.amount >= 10) return o.price / Game.market.calcTransactionCost(10, room.name, o.roomName)
                            });
                            if (!order) return;

                            var engRsl = Game.market.deal(order.id, (24000 > order.amount ? order.amount : 24000), room.name);

                            if (engRsl !== undefined && engRsl !== null) {
                                console.terminalLog(room, 'Sold Energy: ' + order.id + '\n Amount: ' + (24000 > order.amount ? order.amount : 24000) + '\n At Price: ' + order.price + '\n To Room: ' + order.roomName + '\n With Result: ' + engRsl);
                            }
                        }
                        break;
                    default:
                        Memory.n = 1;
                        if (room.terminal.store[Memory.mineral]) {
                            var bestSell = _.max(Game.market.getAllOrders({
                                resourceType: Memory.mineral,
                                type: ORDER_BUY
                            }), (o) => {
                                if (o.amount >= 10) return o.price
                            });
                            Memory.sellPrice = bestSell.price;

                            if (!Memory.buyPrice || bestSell.price > Memory.buyPrice) {
                                var transCost = Game.market.calcTransactionCost(1, room.name, bestSell.roomName);

                                var amountToSend = Math.round((room.terminal.store.energy / 2) / transCost) > room.terminal.store[Memory.mineral] ? room.terminal.store[Memory.mineral] : Math.round((room.terminal.store.energy / 2) / transCost);
                                if (amountToSend > bestSell.amount) amountToSend = bestSell.amount;

                                if (amountToSend > 0) {
                                    var rsl = Game.market.deal(bestSell.id, amountToSend, room.name);
                                    console.terminalLog(room, 'Tried to sell ' + bestSell.resourceType + ' Amount ' + amountToSend + ' At Price ' + bestSell.price + ' Result ' + rsl);

                                    if (rsl == OK) {
                                        Memory.creditChange +=amountToSend * bestSell.price;
                                        Memory.expectedStore -=amountToSend;
                                    }
                                }
                            }
                        }
                }
            }
        }
    },

    doHarvest: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};
            if (!global[room.name].distrSquareFlag) global[room.name].distrSquareFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!creeps) return Memory.crps = [];

            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'doHarvest');
                    if (!creep) {
                        if (!global.Mem.p['room:' + room.name].spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        return;
                    }

                    creep.say('doHarvest');
                    
                    if (room.find(FIND_MY_CREEPS, {filter: (c) => c.memory.p && c.memory.p != 'doHarvest'}).length >= 1) {
                        if (creep.carry.energy >= (creep.carryCapacity - 2 * creep.getActiveBodyparts(WORK))) this.dropEnergy(Memory, creep, creep_it_it);
                        this.harvest(Memory, room, creep_it_it);
                    }
                    else {
                        if (creep.carry.energy >= creep.carryCapacity) {
                            var sE = creep.pos.findClosestByRange(FIND_MY_SPAWNS);
                            if (creep.pos.isNearTo(sE)) creep.transfer(sE, RESOURCE_ENERGY);
                            else creep.travelTo(sE, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                        }
                        else this.harvest(Memory, room, creep_it_it);

                    }
                }
            }

            //get more creeps
            if (creeps.length < room.find(FIND_SOURCES).length) Memory.crps.push(module.exports.room.addToSQ('room:' + room.name, 'doHarvest'));
        },

        harvest: function (Memory, room, creep_it_it) {
            var creep = getCreep(Memory.crps[creep_it_it].split(':')[0], 'doHarvest');

            if (!Memory.crps[creep_it_it].split(':')[1]) {

                var takenSources = [];
                _.forEach(Memory.crps, (c) => {
                    c = c.toString();
                    if (c.split(':')[1]) takenSources.push(c.split(':')[1])
                });

                var zeChosn = room.find(FIND_SOURCES, {filter: (s) => !takenSources.includes(s.id)})[0];

                if (zeChosn && zeChosn.id) Memory.crps[creep_it_it] = creep.name + ':' + zeChosn.id;
            }

            var source = Game.getObjectById(Memory.crps[creep_it_it].split(':')[1]);

            if (source) {
                if (!creep.pos.isNearTo(source)) creep.travelTo(source, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                else creep.harvest(source)
            }
            else Memory.crps[creep_it_it] = creep.name;
        },

        dropEnergy: function (Memory, creep, creep_it_it, room = creep.room) {
            var srcId = Memory.crps[creep_it_it].split(':')[1];

            if (!global[room.name].links || !global[room.name].links[0]) global[room.name].links = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}), (l) => {return l.id});
            if (!global[room.name].sourcelinks || !global[room.name].sourcelinks[0]) global[room.name].sourcelinks = _.filter(global[room.name].links, (s) => {return Game.getObjectById(s) && Game.getObjectById(s).pos.findInRange(FIND_SOURCES, 3)[0];});

            var link = creep.pos.findClosestByRange(_.map(global[room.name].sourcelinks, (s) => {return Game.getObjectById(s)}));

            if (link && link.pos.getRangeTo(creep.pos) < 3) {
                if (creep.pos.isNearTo(link.pos)) creep.transfer(link, RESOURCE_ENERGY);
                 else creep.travelTo(link, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
            }
            else {
                var container = Game.getObjectById(srcId)
                    ? Game.getObjectById(srcId).pos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.energy < s.storeCapacity})[0]
                    : creep.pos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.energy < s.storeCapacity})[0];

                if (container) {
                    if (creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.travelTo(container, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                    }
                }
                else {
                    creep.drop(RESOURCE_ENERGY);
                }

                if (global[room.name].links.length < CONTROLLER_STRUCTURES.link[creep.room.controller.level]) {
                    if (!Game.getObjectById(srcId).pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0]) {
                        this.placeLink(Game.getObjectById(srcId), creep);
                    }
                }
                else {
                    var src = Game.getObjectById(srcId);
                    if (!_.size(Game.constructionSites) < 100 && src && creep.pos.isNearTo(src) && creep.pos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_CONTAINER}).length < 1
                        && creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).length < 1) room.createConstructionSite(creep.pos.x, creep.pos.y, STRUCTURE_CONTAINER)
                }
            }
        },

        placeLink: function (source, creep) {
            if (!_.size(Game.constructionSites) < 100) return;

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
                if (s.structureType != STRUCTURE_SPAWN) s.destroy();
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
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};

            if (!global[room.name].fillSpawnFlag) global[room.name].fillSpawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
            var flag = global[room.name].fillSpawnFlag;

            if (!flag) return this.placeFlag(room);
            if (Game.time % 17280 == 0) this.placeSpawn(room);

            if (creep) {
                creep.say('fillSpawn');
                if (creep.carry.energy == 0) Memory.w = 1;
                else if (creep.carry.energy == creep.carryCapacity) Memory.w = 0;

                if (Memory.w == 1) {
                    creep.getConsumerEnergy(Memory, room);
                }
                else {
                    if (!creep.pos.isEqualTo(flag.pos)) creep.travelTo(flag, {range: 0, obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                    else if (creep.pos.findInRange(FIND_MY_SPAWNS, 1, {filter: (s) => s.energy < s.energyCapacity})[0]) creep.transfer(creep.pos.findInRange(FIND_MY_SPAWNS, 1, {filter: (s) => s.energy < s.energyCapacity})[0], RESOURCE_ENERGY);
                    else if (creep.carry.energy < creep.carryCapacity) Memory.w = 1;
                }
            }
            else {
                Memory.creep = module.exports.room.addToSQ('room:' + room.name, 'fillSpawn', {name: Memory.creep});
            }
        },

        placeFlag: function (room) {
            var spawn = room.find(FIND_MY_SPAWNS)[0];
            if (!spawn) return;

            room.createFlag(spawn.pos.x - 1, spawn.pos.y, 'fillSpawn:' + room.name, COLOR_PURPLE, COLOR_CYAN);
        },

        spawns: [{"x": 1, "y": 0}, {"x": -1, "y": 0}, {"x": 0, "y": -1}],

        placeSpawn: function (room) {
            if (!_.size(Game.constructionSites) < 100 && CONTROLLER_STRUCTURES.spawn[room.controller.level] > room.find(FIND_MY_SPAWNS).length) {
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
        }
    },

    fillExt: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creep = Memory.creep ? getCreep(Memory.creep, 'fillExt') : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};

            if (creep) {
                creep.say('fillExt');
                if (creep.carry.energy == 0) Memory.w = 1;
                else if (creep.carry.energy == creep.carryCapacity) Memory.w = 0;

                if (Memory.w == 1) {
                    creep.getConsumerEnergy(Memory, room);
                }
                else {
                    var extension = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_EXTENSION && s.energy < s.energyCapacity});
                    if (extension) {
                        if (creep.pos.isNearTo(extension)) creep.transfer(extension, RESOURCE_ENERGY);
                        else creep.travelTo(extension, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                    }
                    else if (creep.carry.energy < creep.carryCapacity) Memory.w = 1;
                }
            }
            else {
                Memory.creep = module.exports.room.addToSQ('room:' + room.name, 'fillExt', {name: Memory.creep});
            }
        }
    },
    
    strgDistr: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};
            if (!creeps) return Memory.crps = [];

            if (!global[room.name].distrSquareFlag) global[room.name].distrSquareFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!global[room.name].links || !global[room.name].links[0]) global[room.name].links = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}), (l) => {return l.id});

            var flag = global[room.name].distrSquareFlag;
            if (!room.storage || !flag) return;
            if (!global[room.name]) global[room.name] = {};
            if (!Game.getObjectById(Memory.link)) {
                var link = flag.pos.findInRange(_.map(global[room.name].links, (s) => {return Game.getObjectById(s)}), 1)[0];
                Memory.link = link ? link.id : undefined;

                if (!link && Game.time % 101 == 0) return this.placeStrucs(room, flag);
                else return;
            }
            if (Game.time % 120960 == 0) this.placeStrucs(room, flag);

            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'strgDistr');
                    if (!creep) {
                        if (!global.Mem.p['room:' + room.name].spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        return;
                    }

                    if (!creep.pos.isEqualTo(flag.pos)) {
                        creep.travelTo(flag, {range: 0, obstacles: room.find(FIND_MY_SPAWNS), repath: 0.01, maxRooms: 1});

                        if (flag.pos.findInRange(FIND_MY_CREEPS, 1).length > 0 && creep.pos.getRangeTo(flag.pos) <= 3) {
                            var rootOfAllEvil = flag.pos.findInRange(FIND_MY_CREEPS, 1, {filter: (c) => c.memory.p != 'strgDistr'})[0];
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
                                    this.fillTower(Memory, room, creep);
                                    break;
                                case 'pickupInRange':
                                    this.pickupInRange(Memory, room, creep);
                                    break;
                                case 'link':
                                    this.linkToStorage(Memory, room, creep);
                                    break;
                                case 'TTS':
                                    this.TTS(Memory, room, creep);
                                    break;
                                case 'fillNuke':
                                    this.fillNuke(Memory, room, creep);
                                    break;
                                case 'STT':
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
                            else if (this.TTS(Memory, room, creep) == OK) creep.memory.doing = 'TTS';
                            else if (this.STT(Memory, room, creep) == OK) creep.memory.doing = 'STT';
                        }
                    }
                }
            }

            //get more creeps
            if (creeps.length < 1 || creeps[0].ticksToLive < 150) Memory.crps.push(module.exports.room.addToSQ('room:' + room.name, 'strgDistr'));
        },

        structs: [{x: 1, y: 1, s: STRUCTURE_TOWER}, {x: 1, y: 0, s: STRUCTURE_STORAGE}, {x: 1, y: -1, s: STRUCTURE_TERMINAL}, {x: 0, y: -1, s: STRUCTURE_NUKER}, {x: -1, y: -1, s: STRUCTURE_POWER_SPAWN},
            {x: -1, y: 0, s: STRUCTURE_OBSERVER}, {x: -1, y: 1, s: STRUCTURE_LINK}],

        placeStrucs: function (room, flag) {
            for (let struc of this.structs) {
                if (!_.size(Game.constructionSites) < 100
                    && CONTROLLER_STRUCTURES[struc.s][room.controller.level] > room.find(FIND_STRUCTURES, {filter: (s) => s.structureType == struc.s}).length) {
                    let strucPos = new RoomPosition(flag.pos.x + struc.x, flag.pos.y + struc.y, room.name);

                    if (!strucPos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == struc.s})[0]) room.createConstructionSite(strucPos.x, strucPos.y, struc.s);
                }
            }

            _.filter(FIND_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_ROAD}, (s) => s.destroy());
        },

        pickupInRange: function (Memory, room, creep) {
            if (creep.memory.w == true) {
                //if carry is full
                var storage = room.storage;
                creep.transfer(storage, Object.keys(creep.carry)[Math.floor(Math.random() * Object.keys(creep.carry).length)]);
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
            if (creep.memory.w == true) {
                //if carry is full
                var storage = room.storage;
                creep.transfer(storage, RESOURCE_ENERGY);
            }
            else {
                //if carry is empty
                var storageLink = Game.getObjectById(Memory.link);

                if (storageLink && storageLink.energy > 0) {
                    if (!global[room.name].links || !global[room.name].links[0]) global[room.name].links = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}), (l) => {return l.id});
                    var link = _.filter(_.map(global[room.name].links, (s) => {return Game.getObjectById(s)}), (s) => s.energy < 50 && s.id != storageLink.id && !s.pos.findInRange(FIND_SOURCES, 3)[0])[0];
                    
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

            if (!global[room.name].towers || !global[room.name].towers[0]) global[room.name].towers = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER}), (t) => {return t.id});

            if (!Game.getObjectById(Memory.tower)) {
                var fnd = creep.pos.findInRange(_.map(global[room.name].towers, (t) => {return Game.getObjectById(t)}), 1)[0];
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
            var nuke = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_NUKER})[0];
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
                else if (nuke.ghodium < nuke.ghodiumCapacity && room.storage.store[RESOURCE_GHODIUM]) {
                    var amtTW = nuke.ghodiumCapacity-nuke.ghodium > creep.carryCapacity ? undefined : nuke.ghodiumCapacity-nuke.ghodium;
                    var result = creep.withdraw(room.storage, RESOURCE_GHODIUM, amtTW);
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

                for (let resourceType in room.terminal.store) {
                    if (resourceType == RESOURCE_ENERGY) {
                        if (room.controller.level < 8 || room.storage.store[resourceType]+800 < storageEnergy) {
                            resourceToMove = resourceType;
                            break;
                        }
                    }
                    else if (room.terminal.store[resourceType] > terminalGoals[resourceType] && (!room.storage.store[resourceType] || room.storage.store[resourceType]+800 < 5000)) {
                        resourceToMove = resourceType;
                        break;
                    }
                }

                if (resourceToMove) {
                    creep.memory.w = true;
                    creep.withdraw(room.terminal, resourceToMove);
                    return OK;
                }
            }
        },

        STT: function (Memory, room, creep) {
            if (!room.terminal) return 'no structure';

            if (creep.memory.w == true) {
                creep.transfer(room.terminal, Object.keys(creep.carry)[Math.floor(Math.random() * Object.keys(creep.carry).length)]);
            }
            else {
                var resourceToMove;

                for (let resourceType in room.storage.store) {
                    if (resourceType == RESOURCE_ENERGY) {
                        if (room.controller.level > 7 && room.storage.store[resourceType]+800 > storageEnergy) {
                            resourceToMove = resourceType;
                            break;
                        }
                    }
                    else if (room.storage.store[resourceType] && room.storage.store[resourceType]+800 > 5000) {
                        resourceToMove = resourceType;
                        break;
                    }
                }

                if (resourceToMove) {
                    creep.memory.w = true;
                    creep.withdraw(room.storage, resourceToMove);
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
         if (!room || !room.storage || room.controller.level < 6) return 'end';

         var mineral = room.find(FIND_MINERALS)[0];
         if (!mineral || ((mineral.mineralAmount < 1 && mineral.ticksToRegeneration > 200) || !creeps || creeps.length < 1)) return 'end';

         if (!global[room.name]) global[room.name] = {};
         if (!creeps) return Memory.crps = [];

         if (creeps.length > 0) {
             //creep loop
             for (let creep_it_it in creeps) {
                 if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                 let creep = getCreep(creeps[creep_it_it].split(':')[0], 'mine');
                 if (!creep) {
                     if (!global.Mem.p['room:' + room.name].spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                     return;
                 }

                 creep.say('mine');

                 if (_.sum(creep.carry) == 0) Memory.w = 1;
                 else if (_.sum(creep.carry) == creep.carryCapacity) Memory.w = 0;

                 if (Memory.w == 1) {
                     if (creep.pos.isNearTo(room.storage)) creep.transfer(room.storage, Object.keys(creep.carry)[Math.floor(Math.random() * Object.keys(creep.carry).length)]);
                     else creep.travelTo(room.storage, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                 }
                 else if (mineral.mineralAmount > 1 && mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES).length < 1) {
                     if (creep.pos.isNearTo(mineral)) {
                         if (Game.time % 6 == 0) {
                             if (creep.harvest(mineral) == ERR_NOT_FOUND) {
                                 if (mineral.pos.lookFor(LOOK_CONSTRUCTION_SITES).length < 1) room.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
                                 creep.memory.t = 'build';
                             }
                         }
                     }
                     else creep.travelTo(mineral, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                 }
             }
         }


         //get more creeps
         if (Game.time % 3 == 0) {
             if ((mineral.mineralAmount > 1 || mineral.ticksToRegeneration < 200) && creeps.length < 1) Memory.crps.push(module.exports.room.addToSQ('room:' + room.name, 'mine'));
         }
     }
    },

    iRmHaul: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};
            if (!creeps) return Memory.crps = [];
            if (!room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0]) return;

            if (!room.storage) return this.placeStorage(room);
            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'iRmHaul');
                    if (!creep) {
                        if (!global.Mem.p['room:' + room.name].spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        return;
                    }

                    creep.say('iRmHaul');

                    if (_.sum(creep.carry) == 0) Memory.w = 1;
                    else if (_.sum(creep.carry) == creep.carryCapacity) Memory.w = 0;

                    if (Memory.w == 1) {
                        creep.getCarrierResources(Memory);
                    }
                    else if (room.storage) {
                        if (creep.pos.isNearTo(room.storage.pos)) creep.transfer(room.storage, Object.keys(creep.carry)[0]);
                        else creep.travelTo(room.storage, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                    }

                }
            }


            //get more creeps
            if (Game.time % 3 == 0) {
                var numberOfCreepsNeeded = this.getNumberOfCarriers(room);
                if (creeps.length < numberOfCreepsNeeded) Memory.crps.push(module.exports.room.addToSQ('room:' + room.name, 'iRmHaul'));
                else if (creeps.length == 0 && numberOfCreepsNeeded == 0) return 'end';
            }
        },

        getNumberOfCarriers: function (room) {
            var links = room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}).length;
            return links >= 3 ? 0 : (links >= 2 ? 1 : 2);
        },

        placeStorage: function (room) {
            if (room.storage || !_.size(Game.constructionSites) < 100) return;
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
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};
            if (!creeps) return Memory.crps = [];

            if (creeps.length > 0) {
                //creep loop
                for (let creep_it_it in creeps) {
                    if (typeof creeps[creep_it_it] == 'number') creeps[creep_it_it] = creeps[creep_it_it].toString();
                    let creep = getCreep(creeps[creep_it_it].split(':')[0], 'praiseRC');
                    if (!creep) {
                        if (!global.Mem.p['room:' + room.name].spawnQueue[creeps[creep_it_it]]) creeps.splice(creep_it_it, 1);
                        return;
                    }

                    creep.say('praiseRC');

                    if (creep.carry.energy == 0) {
                        if (creep.memory.w == 0 || creep.memory.w == 2) creep.memory.w = 2;
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
                        else creep.travelTo(room.controller, {range: 0, obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                    }
                    else {
                        if (creep.pos.getRangeTo(room.controller) > 3) creep.travelTo(room.controller, {range: 3, obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                        else creep.upgradeController(room.controller);
                    }

                }
            }

            //get more creeps
            if (creeps.length < this.getNumberOfUpgraders(room)) Memory.crps.push(module.exports.room.addToSQ('room:' + room.name, 'praiseRC'));
        },

        getNumberOfUpgraders: function (room) {
            switch (room.controller.level) {
                case 3:
                    return 7;
                case 2:
                    return 5;
                case 1:
                    return 3;
                default:
                    if (room.controller.level < 8) {
                        var storage = room.storage;

                        if (!storage) return 1;

                        var terminalEnergy = room.terminal && room.terminal.store ? room.terminal.store[RESOURCE_ENERGY] : 0;
                        return Math.floor(((storage.store.energy + terminalEnergy) - 20000) / 20000) > 1 ? Math.floor(((storage.store.energy + terminalEnergy) - 20000) / 20000) : 1;
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

            if (!global[room.name].links || !global[room.name].links[0]) global[room.name].links = _.map(room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}), (s) => {return s.id});

            if (global[randomHash] && (!global[randomHash].l || !Memory.lt || Game.time - Memory.lt > 101)) {
                if (room.controller) global[randomHash].l = room.controller.pos.findInRange(_.map(global[room.name].links, (s) => {return Game.getObjectById(s)}), 3)[0];
                Memory.lt = Game.time;
            }

            var link = global[randomHash].l;

            if (link && link.energy > 0 && (room.storage && creep.pos.findClosestByRange([link, room.storage]) == link)) {
                if (creep.pos.isNearTo(link.pos)) creep.withdraw(link, RESOURCE_ENERGY);
                else creep.travelTo(link, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
            }
            else {
                creep.getConsumerEnergy(Memory, room);

                if (_.size(Game.constructionSites) < 100 && Game.time % 101 == 0 && room.controller.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 3).length < 1 && room.controller.pos.findInRange(FIND_MY_STRUCTURES, 3, {filter: (s) => s.structureType == STRUCTURE_LINK}).length < 1
                    && CONTROLLER_STRUCTURES[STRUCTURE_LINK][room.controller.level] > room.find(FIND_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}).length) {
                    var path = room.storage.pos.findPathTo(room.controller.pos, {range: 3});

                    var linkPos = new RoomPosition(path[path.length-1].x, path[path.length-1].y, room.name);
                    if (linkPos) room.createConstructionSite(linkPos, STRUCTURE_LINK);
                }
            }
        }
    },

    takeCare: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creep = Memory.creep ? getCreep(Memory.creep, 'takeCare') : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
            if (!global[room.name]) global[room.name] = {};

            if (creep) {
                if (creep.spawning) return;

                creep.say('takeCare');
                if (creep.carry.energy == 0) Memory.w = 1;
                else if (creep.carry.energy == creep.carryCapacity) Memory.w = 0;

                if (_.sum(creep.carry) - creep.carry.energy > 0) {
                    for (let resourceType in creep.carry) {
                        if (resourceType == RESOURCE_ENERGY) continue;
                        creep.drop(resourceType);
                        break;
                    }
                }

                if (creep.room.name != room.name) return creep.travelTo(room.getPositionAt(25, 25), {range: 21, obstacles: getObstacles(room), repath: 0.01, maxRooms: 16});

                if (Memory.w == 1) {
                    creep.getConsumerEnergy(Memory, room);
                }
                else {
                    var structureToRepair = this.findStructureToRepair(Memory, room, creep);
                    if (structureToRepair) {
                        if (creep.pos.getRangeTo(structureToRepair) > 3) creep.travelTo(structureToRepair, {range: 3, obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                        else creep.repair(structureToRepair);
                    }
                    else {
                        var structureToBuild = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
                        if (structureToBuild) {
                            if (creep.pos.getRangeTo(structureToBuild) > 3) creep.travelTo(structureToBuild, {range: 3, obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                            else creep.build(structureToBuild);
                        }
                        else {
                            var towerToRefill = this.getTowerToRefill(Memory, room);
                            if (towerToRefill) {
                                if (creep.pos.isNearTo(towerToRefill)) creep.transfer(towerToRefill, RESOURCE_ENERGY);
                                else creep.travelTo(towerToRefill, {obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                            }
                            else {
                                var defenseToRepair = this.findDefence(Memory, room, creep);
                                if (defenseToRepair) {
                                    if (creep.pos.getRangeTo(defenseToRepair) > 3) creep.travelTo(defenseToRepair, {range: 3, obstacles: getObstacles(room), repath: 0.01, maxRooms: 1});
                                    else creep.repair(defenseToRepair);
                                }
                                else if (creep.pos.findInRange(FIND_CREEPS, 1).length > 0) creep.runInSquares();
                            }
                        }
                    }

                }
            }
            else this.getCreep(Memory, room);
        },
        
        getCreep: function (Memory, room) {
            if (room.controller.level > 3) return Memory.creep = module.exports.room.addToSQ('room:' + room.name, 'takeCare', {name: Memory.creep});

            var nearestRoom = Game.rooms[Memory.nr];
            if (!nearestRoom) {
                var newR = _.min(Game.rooms, (r) => {
                    return r.find(FIND_MY_SPAWNS).length > 0 && r.energyCapacityAvailable >= 550 ? Game.map.getRoomLinearDistance(r.name, room.name) : undefined;
                });
                Memory.nr = newR ? newR.name : undefined;

                return Memory.creep = module.exports.room.addToSQ('room:' + room.name, 'takeCare', {name: Memory.creep});
            }

            if (nearestRoom.controller.level <= room.controller.level || Game.map.getRoomLinearDistance(room.name, nearestRoom.name) > 10) return Memory.creep = module.exports.room.addToSQ('room:' + room.name, 'takeCare', {name: Memory.creep});

            return Memory.creep = module.exports.room.addToSQ('room:' + nearestRoom.name, 'takeCare', {name: Memory.creep});
        },

        findStructureToRepair: function (Memory, room, creep) {
            var structure = Memory.str ? Game.getObjectById(Memory.str) : undefined;

            if (!structure || structure.hits >= structure.hitsMax || (structure.structureType == STRUCTURE_RAMPART && structure.hits > (structure.hitsMax * 0.001))) {
                structure = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => (s.structureType != STRUCTURE_WALL && s.structureType != STRUCTURE_RAMPART
                    && s.hits < (s.hitsMax * 0.5) || (s.structureType == STRUCTURE_RAMPART && s.hits < (s.hitsMax * 0.001)))
                    && (s.structureType != STRUCTURE_CONTAINER || !s.pos.findInRange(FIND_MY_STRUCTURES, 3, {filter: (s) => s.structureType == STRUCTURE_LINK})[0])
                });
            }

            if (structure) Memory.str = structure.id;
            return structure;
        },

        findDefence: function (Memory, room, creep) {
            var minDefenceLevel = Memory.mdl;
            if (!Memory.mdl) {
                Memory.mdl = 100;
                minDefenceLevel = 100;
            }

            var structures = room.find(FIND_STRUCTURES,
                {filter: (s) => (s.structureType == STRUCTURE_RAMPART || s.structureType == STRUCTURE_WALL) && s.hits < minDefenceLevel});

            var structure = creep.pos.findClosestByRange(structures);

            if (!structure) {
                Memory.mdl = minDefenceLevel + 1000;
                return;
            }

            return structure;
        },

        getTowerToRefill: function (Memory, room) {
            var towers = room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER && s.energy < s.energyCapacity});

            if (!towers.length > 0) return undefined;

            var tower = _.min(towers, 'energy');

            return tower ? tower : undefined;

        }
    }
};
