require('prototype.room');
require('prototype.creep');

const processSpawn = require('process.spawn');

function getCreep(name, process) {
    var creep = Game.creeps[name];

    if (!process || !creep) return creep ? creep : undefined;

    if (!creep.memory.p || !creep.memory.p == process) creep.memory.p = process;
    creep.memory.l = Game.time;

    return creep ? creep : undefined;
}

const bodyChart = {
    doHarvest: [[WORK, WORK, MOVE], [CARRY], 3],
    praiseRC: [[WORK, CARRY, MOVE], []],
    strgDistr: [[CARRY, CARRY, MOVE], []],
    fillSpawn: [[CARRY, CARRY, MOVE], [], 6],
    fillExt: [[CARRY, CARRY, MOVE], []],
    iRmHaul: [[CARRY, CARRY, MOVE], []],
    takeCare: [[WORK, CARRY, MOVE], []]
};

module.exports = {
    init: {
        run: function () {

            if (!global.Mem.a) global.Mem.a = [];
            if (!global.Mem.s) global.Mem.s = [];

            global.Mem.notify = [];
            global.Mem.creeps = {};
            global.Mem.p = {};
            global.Mem.SB = false;
            global.Mem.init = true;

            spawnNewProcess('doStats');
            spawnNewProcess('buildFromQueue');
            spawnNewProcess('checkRooms');
            spawnNewProcess('checkCreeps');
        }
    },

    doStats: {
        run: function () {
            Memory.stats = {
                tick: Game.time,
                cpu: Game.cpu,
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
    
    doNotify: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            if (!global.Mem.notify) global.Mem.notify = [];

            if (!Memory.lt || Game.time-Memory.lt > 1001) {
                var message = 'Brand new Notification: \n';

                _.forEach(global.Mem.notify, (mess) => {
                    message = message + '\n' + mess;
                });

                Game.notify(message);

                global.Mem.notify = [];
                Memory.lt = Game.time;
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

    buildFromQueue: {
        run: function () {
            if (!Memory.cs) Memory.cs = [];
            
            if (_.size(Game.constructionSites) >= 50) return;
            
            var cnt = 0;
            
                do {
                var nextThing = Memory.cs[0];
                if (!nextThing) return;

                var splitThing = nextThing.split(',');

                var room = Game.rooms[splitThing[0]];
                var x = Number.parseInt(splitThing[1]);
                var y = Number.parseInt(splitThing[2]);
                var struct = splitThing[3];

                if (isUndefinedOrNull(room) || isUndefinedOrNull(x) || isUndefinedOrNull(y) || isUndefinedOrNull(struct)) return Memory.cs.splice(0, 1);

                var rsl = room.createConstructionSite(x, y, struct);
                switch (rsl) {
                    case 0:
                        Memory.cs.splice(0, 1);
                        console.roomLog(room, 'Created Construction Site At ' + x + ' ' + y + ' ' + struct);
                        break;
                    case -7:
                        var roomPos = new RoomPosition(x, y, room.name);
                        if (roomPos.lookFor(LOOK_CONSTRUCTION_SITES)[0] || _.filter(roomPos.lookFor(LOOK_STRUCTURES), (s) => s.structureType == struct || OBSTACLE_OBJECT_TYPES.includes(s.structureType))[0]
                            || _.filter(roomPos.lookFor(LOOK_TERRAIN), (t) => t.type == 'wall')[0]) {
                            console.roomLog(room, 'Spliced constructions site ' + ' at ' + x + ' ' + y + ' ' + room.name + ' due to already built' + ' ' + struct);
                            Memory.cs.splice(0, 1);
                        }
                        else {
                            console.errorLog('Error creating constructions site ' + rsl + ' at ' + x + ' ' + y + ' ' + room.name + ' ' + struct);
                        if (roomPos.lookFor(LOOK_CREEPS).length > 0) roomPos.lookFor(LOOK_CREEPS)[0].suicide();
                        if (_.filter(roomPos.lookFor(LOOK_STRUCTURES), (s) => !OBSTACLE_OBJECT_TYPES.includes(s.structureType))[0]) _.filter(roomPos.lookFor(LOOK_STRUCTURES), (s) => !OBSTACLE_OBJECT_TYPES.includes(s.structureType))[0].destroy();
                        }
                            break;
                    default:
                        console.errorLog('Error creating constructions site ' + rsl + ' at ' + x + ' ' + y + ' ' + room.name);
                        Memory.cs.splice(0, 1);
                }
                    
                    cnt++;
            }
            while (rsl == -7 || cnt >= 10);
        }
    },

    checkCreeps: {
        run: function () {
            if (Game.time % 3 != 0) return;

            _.forEach(Game.creeps, (creep) => {
                if (!creep.memory.p || !creep.memory.l || Game.time - creep.memory.l > 4) {
                    if (isUndefinedOrNull(creep.memory.nc)) creep.memory.nc = 0;
                    else creep.memory.nc++;

                    if (creep.memory.nc > 13) {
                        creep.suicide();
                    }
                }
                else delete creep.memory.nc;
            });
        }
    },

    room: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';

            if (!Memory.spawnQueue) Memory.spawnQueue = {};

            if (Game.time % 3 == 0) {
                if (room.find(FIND_HOSTILE_CREEPS, {filter: (c) => !global.Mem.a.includes(c.owner.username)}) && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'doTowers').length < 1) spawnNewProcess('doTowers', Memory.rmN);

                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'doHarvest').length < 1) spawnNewProcess('doHarvest', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'takeCare').length < 1) spawnNewProcess('takeCare', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'fillSpawn').length < 1) spawnNewProcess('fillSpawn', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'fillExt').length < 1) spawnNewProcess('fillExt', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'strgDistr').length < 1) spawnNewProcess('strgDistr', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'buildRoads').length < 1) spawnNewProcess('buildRoads', Memory.rmN);
                if (_.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'praiseRC').length < 1) spawnNewProcess('praiseRC', Memory.rmN);

                if (room.controller.level >= 4 && room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0] && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'iRmHaul').length < 1) spawnNewProcess('iRmHaul', Memory.rmN);
            }

            if (Game.time % 11 == 0 && room.controller.level >= 4 && !room.storage && !room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0] && _.filter(global.Mem.p, (p) => p.rmN == Memory.rmN && p.pN == 'placeStorage').length < 1) spawnNewProcess('placeStorage', Memory.rmN);

            this.spawn(Memory_it);
        },

        addToSQ: function (Memory_it, process, creepMem = {}) {
            var Memory = global.Mem.p[Memory_it];

            while (!creepMem.name || Game.creeps[creepMem.name]) creepMem.name = (Game.time % 1000) + '' + Math.round(Math.random() * 1000);
            creepMem.body = processSpawn.run(Game.rooms[Memory.rmN], _.cloneDeep(bodyChart[process][0]), _.cloneDeep(bodyChart[process][1]), bodyChart[process][2]);
            creepMem.proc = process;

            if (!Memory.spawnQueue[creepMem.name]) {
                Memory.spawnQueue[creepMem.name] = creepMem;
            }

            return creepMem.name;
        },

        spawn: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var nextToSpawn = _.sortBy(Memory.spawnQueue, (c) => {
                return c.proc == 'doHarvest' ? 0 : c.proc == 'fillSpawn' ? 1 : 2;
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
                    nextToSpawn.body = processSpawn.reCalcBody(room.energyAvailable, _.cloneDeep(bodyChart[nextToSpawn.proc][0]), _.cloneDeep(bodyChart[nextToSpawn.proc][1]), bodyChart[nextToSpawn.proc][2]);
                    break;
            }

            var name = spawn.createCreep(nextToSpawn.body.body, nextToSpawn.name, {p: nextToSpawn.proc});

            if (Game.creeps[name]) console.logSpawn(room, name + ' ' + nextToSpawn.proc);
        }
    },

    doTowers: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room || room.find(FIND_HOSTILE_CREEPS).length < 1) return 'end';

            var randomHash = Memory.RH;

            if (!randomHash || !global[randomHash]) {
                Memory.RH = makeid;
                global[Memory.RH] = {};
                randomHash = Memory.RH;
            }

            if (global[randomHash] && (!global[randomHash].t || !Memory.lt || Game.time-Memory.lt > 101)) {
                global[randomHash].t = room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER});
                Memory.lt = Game.time;
            }


            var towers = global[randomHash] && global[randomHash].t ? global[randomHash].t : room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_TOWER});
            if (towers.length < 1) return 'end';

            var baddies = room.find(FIND_HOSTILE_CREEPS, {filter: (c) => !global.Mem.a.includes(c.owner.username)});
            if (baddies.length < 1) return 'end';

            StructureTower.prototype.killIdiot = function (idiot) {
                if (!idiot || this.energy == 0) return;
                this.attack(idiot);
            };

            _.forEach(towers, (tower) => {
                tower.killIdiot(tower.pos.findClosestByRange(baddies));
            });
        }
    },

    placeStorage: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
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

                    let terrain = _.filter(room.lookForAtArea(LOOK_TERRAIN, y - freeRange, x - freeRange, y + freeRange, x + freeRange, {asArray: true}), (p) => p.type == 'terrain' && p.terrain == 'wall');
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

                    if (cnt >= 2 || (cnt >= 1 && toController * 0.5 <= bestPos.c)) {
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

    buildRoads: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            if (!Memory.l || Game.time-Number.parseInt(Memory.l) >= 18000) Memory.l = Game.time;
            else return;

            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';

            var spawnFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
            var storageFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!spawnFlag || !storageFlag) return;

            var costMatrix = this.getCostMatrix(room.name, storageFlag, spawnFlag);

            _.forEach(storageFlag.pos.findPathTo(spawnFlag, {range: 2, ignoreCreeps: true, ignoreRoads: true, plainCost: 1, swampCost: 1, costCallback: costMatrix}), (pathData) => {
                if (!_.filter(new RoomPosition(pathData.x, pathData.y, room.name).lookFor(LOOK_STRUCTURES), (s) => s.structureType == STRUCTURE_ROAD)[0]) global.Mem.cs.push(room.name + ',' + pathData.x + ',' + pathData.y + ',' + STRUCTURE_ROAD);
            });
        },
        
        getCostMatrix: function (roomName, storageFlag, spawnFlag) {
            var room = Game.rooms[roomName];
            if (!room) return;

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


            return costs;
        }
    },

    doHarvest: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
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
                            else creep.moveTo(sE);
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
                if (!creep.pos.isNearTo(source)) creep.moveTo(source, {reusePath: 10});
                else creep.harvest(source)
            }
            else Memory.crps[creep_it_it] = creep.name;
        },

        dropEnergy: function (Memory, creep, creep_it_it) {
            var srcId = Memory.crps[creep_it_it].split(':')[1];

            var randomHash = Memory.RH;

            if (!randomHash || !global[randomHash]) {
                Memory.RH = makeid;
                global[Memory.RH] = {};
                randomHash = Memory.RH;
            }

            if (global[randomHash] && (!global[randomHash].l || !Memory.lt || Game.time - Memory.lt > 101)) {
                global[randomHash].l = Game.getObjectById(srcId).pos.findInRange(FIND_MY_STRUCTURES, 2, {filter: (s) => s.structureType == STRUCTURE_LINK})[0] ? Game.getObjectById(srcId).pos.findInRange(FIND_MY_STRUCTURES, 2, {filter: (s) => s.structureType == STRUCTURE_LINK})[0].id : undefined;
                Memory.lt = Game.time;
            }

            var link = Game.getObjectById(global[randomHash].l) ? Game.getObjectById(global[randomHash].l) : undefined;

            if (link) {
                if (creep.transfer(link, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(link);
                }
            }
            else {
                var container = Game.getObjectById(srcId)
                    ? Game.getObjectById(srcId).pos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.energy < s.storeCapacity})[0]
                    : creep.pos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_CONTAINER && s.store.energy < s.storeCapacity})[0];

                if (container) {
                    if (creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                        creep.moveTo(container);
                    }
                }
                else {
                    creep.drop(RESOURCE_ENERGY);

                    if (creep.room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}).length < CONTROLLER_STRUCTURES.link[creep.room.controller.level]) {
                        if (!Game.getObjectById(srcId).pos.findInRange(FIND_CONSTRUCTION_SITES, 2)[0]) {
                            this.placeLink(Game.getObjectById(srcId), creep);
                        }
                    }
                    else {
                        var src = Game.getObjectById(srcId);
                        if (src && creep.pos.isNearTo(src) && creep.pos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_CONTAINER}).length < 1
                            && creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 1).length < 1) global.Mem.cs.push(creep.room.name + ',' + creep.pos.x + ',' + creep.pos.y + ',' + STRUCTURE_CONTAINER);
                    }
                }
            }
        },

        placeLink: function (source, creep) {
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

            _.forEach(new RoomPosition(creep.pos.x+opDirTS.x, creep.pos.y+opDirTS.y, creep.room.name).lookFor(LOOK_STRUCTURES), (s) => {
                if (s.structureType != STRUCTURE_SPAWN) s.destroy();
                else blocked = true;
            });

            if (!blocked) global.Mem.cs.push(creep.room.name + ',' + Number.parseInt(creep.pos.x+opDirTS.x) + ',' + Number.parseInt(creep.pos.y+opDirTS.y) + ',' + STRUCTURE_LINK);
            else console.notify("doHarvest's placeLink found itself blocked Source is: " + source.id + ' in Room: ' + source.room);
        }
    },

    fillSpawn: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creep = Memory.creep ? getCreep(Memory.creep, 'fillSpawn') : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';

            var flag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];

            if (!flag) return this.placeFlag(room);
            if (Game.time % 98 == 0) this.placeSpawn(room);

            if (creep) {
                creep.say('fillSpawn');
                if (creep.carry.energy == 0) Memory.w = 1;
                else if (creep.carry.energy == creep.carryCapacity) Memory.w = 0;

                if (Memory.w == 1) {
                    creep.getConsumerEnergy(Memory, room);
                }
                else {
                    if (!creep.pos.isEqualTo(flag.pos)) creep.moveTo(flag, {range: 0});
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
            if (CONTROLLER_STRUCTURES.spawn[room.controller.level] > room.find(FIND_MY_SPAWNS).length) {
                var flag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'fillSpawn'})[0];
                var cnt = room.find(FIND_MY_SPAWNS).length;

                for (let pos_it of this.spawns) {
                    let pos = new RoomPosition(flag.pos.x + pos_it.x, flag.pos.y + pos_it.y, room.name);
                    if (!pos.findInRange(FIND_MY_SPAWNS, 0)[0] && !pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 0)[0]) {
                        global.Mem.cs.push(room.name + ',' + pos.x + ',' + pos.y + ',' + STRUCTURE_SPAWN);

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
                        else creep.moveTo(extension);
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
            if (!creeps) return Memory.crps = [];

            var flag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
            if (!room.storage || !flag) return;
            if (!flag.pos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_LINK})[0]) {
                if (Game.time % 99 == 0) return this.placeStrucs(room, flag);
                else return;
            }
            if (Game.time % 18000 == 0) this.placeStrucs(room, flag);

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
                        if (!flag.pos.findInRange(FIND_MY_CREEPS, 1)[0]) creep.moveTo(flag, {range: 0});
                        else creep.moveTo(flag, {range: 2});
                    }
                    else { // do stuff

                        if (creep.memory.w == true && _.sum(creep.carry) == 0) {
                            creep.memory.w = false;
                        }
                        else if (creep.memory.w == false && _.sum(creep.carry) == creep.carryCapacity) {
                            creep.memory.w = true;
                        }

                        if (creep.memory.w == true) {
                            switch (creep.memory.doing) {
                                case 'link':
                                    this.linkToStorage(room, creep);
                                    break;
                                default:
                                    console.errorLog('creep.memory.doing is undefined', creep, room);
                                    creep.memory.doing = 'link';
                            }
                        }
                        else {
                            if (this.linkToStorage(room, creep) == OK) creep.memory.doing = 'link';
                            else if (room.storage.store.energy < 50000 && room.terminal && room.terminal.store.energy > 100) creep.withdraw(room.terminal, RESOURCE_ENERGY);
                        }
                    }
                }
            }

            //get more creeps
            if (creeps.length < 1) Memory.crps.push(module.exports.room.addToSQ('room:' + room.name, 'strgDistr'));
        },

        structs: [{x: 1, y: 1, s: STRUCTURE_TOWER}, {x: 1, y: 0, s: STRUCTURE_STORAGE}, {x: 1, y: -1, s: STRUCTURE_TERMINAL}, {x: 0, y: -1, s: STRUCTURE_NUKER}, {x: -1, y: -1, s: STRUCTURE_POWER_SPAWN},
            {x: -1, y: 0, s: STRUCTURE_OBSERVER}, {x: -1, y: 1, s: STRUCTURE_LINK}],

        placeStrucs: function (room, flag) {
            for (let struc of this.structs) {
                if (CONTROLLER_STRUCTURES[struc.s][room.controller.level] > room.find(FIND_STRUCTURES, {filter: (s) => s.structureType == struc.s}).length) {
                    let strucPos = new RoomPosition(flag.pos.x + struc.x, flag.pos.y + struc.y, room.name);

                    if (!strucPos.findInRange(FIND_STRUCTURES, 1, {filter: (s) => s.structureType == struc.s})[0]) global.Mem.cs.push(room.name + ',' + strucPos.x + ',' + strucPos.y + ',' + struc.s);
                }
            }

            _.filter(FIND_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_ROAD}, (s) => s.destroy());
        },

        linkToStorage: function (room, creep) {
            if (creep.memory.w == true) {
                //if carry is full
                var storage = room.storage;
                creep.transfer(storage, RESOURCE_ENERGY);
            }
            else {
                //if carry is empty

                var randomHash = Memory.RH;

                if (!randomHash || !global[randomHash]) {
                    Memory.RH = makeid;
                    global[Memory.RH] = {};
                    randomHash = Memory.RH;
                }

                if (global[randomHash] && (!global[randomHash].l || !Memory.lt || Game.time-Memory.lt > 101)) {
                    global[randomHash].l = creep.pos.findInRange(FIND_MY_STRUCTURES, 1, {filter: (s) => s.structureType == STRUCTURE_LINK})[0].id;
                    Memory.lt = Game.time;
                }

                var linkWithEnergy = Game.getObjectById(global[randomHash].l) && Game.getObjectById(global[randomHash].l).energy > 0 ? Game.getObjectById(global[randomHash].l) : undefined;
                if (linkWithEnergy) {
                    creep.memory.w = true;
                    creep.withdraw(linkWithEnergy, RESOURCE_ENERGY);
                    return OK;
                }
                else return 'no structure'
            }
        }
    },

    iRmHaul: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
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
                        else creep.moveTo(room.storage);
                    }

                }
            }

            //get more creeps
            if (creeps.length < this.getNumberOfCarriers(room)) Memory.crps.push(module.exports.room.addToSQ('room:' + room.name, 'iRmHaul'));
        },

        getNumberOfCarriers: function (room) {
            return room.find(FIND_MY_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_LINK}).length < 2 ? 2 : 1;
        },

        placeStorage: function (room) {
            if (room.storage) return;
            if (Game.time % 11 == 0) {

                var distrFlag = room.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'distrSquare'})[0];
                if (!distrFlag || distrFlag.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1)[0]) return;

                global.Mem.cs.push(room.name + ',' + (distrFlag.pos.x + 1) + ',' + (distrFlag.pos.y) + ',' + STRUCTURE_STORAGE);
            }
        }
    },

    praiseRC: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creeps = Memory.crps ? Memory.crps : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';
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

                    if (creep.carry.energy == 0) Memory.w = 1;
                    else if (creep.carry.energy == creep.carryCapacity) Memory.w = 0;

                    if (Memory.w == 1) {
                        creep.getConsumerEnergy(Memory, room);
                    }
                    else {
                        if (creep.pos.getRangeTo(room.controller) > 3) creep.moveTo(room.controller);
                        else creep.transfer(room.controller, RESOURCE_ENERGY);
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
                    else return 1;
            }
        }
    },

    takeCare: {
        run: function (Memory_it) {
            var Memory = global.Mem.p[Memory_it];

            var creep = Memory.creep ? getCreep(Memory.creep, 'takeCare') : undefined;
            var room = Game.rooms[Memory.rmN];
            if (!room) return 'end';

            if (creep) {
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

                if (Memory.w == 1) {
                    creep.getConsumerEnergy(Memory, room);
                }
                else {
                    var structureToRepair = this.findStructureToRepair(Memory, room, creep);
                    if (structureToRepair) {
                        if (creep.pos.getRangeTo(structureToRepair) > 3) creep.moveTo(structureToRepair, {
                            reusePath: 7,
                            range: 3
                        });
                        else creep.repair(structureToRepair);
                    }
                    else {
                        var structureToBuild = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);
                        if (structureToBuild) {
                            if (creep.pos.getRangeTo(structureToBuild) > 3) creep.moveTo(structureToBuild, {
                                reusePath: 7,
                                range: 3
                            });
                            else creep.build(structureToBuild);
                        }
                        else {
                            var towerToRefill = this.getTowerToRefill(Memory, room);
                            if (towerToRefill) {
                                if (!creep.pos.isNearTo(towerToRefill)) creep.transfer(towerToRefill, RESOURCE_ENERGY);
                                else creep.moveTo(towerToRefill, {reusePath: 7, range: 3});
                            }
                            else {
                                var defenseToRepair = this.findDefence(Memory, room, creep);
                                if (defenseToRepair) {
                                    if (creep.pos.getRangeTo(defenseToRepair) > 3) creep.moveTo(defenseToRepair, {
                                        reusePath: 7,
                                        range: 3
                                    });
                                    else creep.repair(defenseToRepair);
                                }
                            }
                        }
                    }

                }
            }
            else {
                Memory.creep = module.exports.room.addToSQ('room:' + room.name, 'takeCare', {name: Memory.creep});
            }
        },

        findStructureToRepair: function (Memory, room, creep) {
            var structure = Memory.str ? Game.getObjectById(Memory.str) : undefined;

            if (!structure || structure.hits >= structure.hitsMax || (structure.structureType == STRUCTURE_RAMPART && structure.hits > (structure.hitsMax * 0.001))) {
                structure = creep.pos.findClosestByRange(room.find(FIND_STRUCTURES, {
                    filter: (s) => s.structureType != STRUCTURE_WALL && s.structureType != STRUCTURE_RAMPART
                    && s.hits < (s.hitsMax * 0.5) || (s.structureType == STRUCTURE_RAMPART && s.hits < (s.hitsMax * 0.001))
                }));
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
            var towers = room.find(FIND_MY_STRUCTURES, {filter: (s) => s.energy && s.energy < s.energyCapacity && s.structureType == STRUCTURE_TOWER});

            if (!towers.length > 0) return undefined;

            var tower = _.min(towers, 'energy');

            return tower ? tower : undefined;

        }
    }
};
