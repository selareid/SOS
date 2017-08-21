Creep.prototype.getConsumerEnergy = function (Memory, room = this.room, creep = this) {
    var storage = room.storage;

    if (storage && storage.store[RESOURCE_ENERGY] > creep.carryCapacity) {
        if (creep.pos.isNearTo(storage)) creep.withdraw(storage, RESOURCE_ENERGY);
        else creep.moveWithPath(creep.room.storage, {range: 1, repath: 0.01, maxRooms: 1});
    }
    else {
        var droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {filter: (r) => r.amount > 20 && r.resourceType == RESOURCE_ENERGY});
        var container = function () {
            return creep.pos.findClosestByRange(FIND_STRUCTURES, {filter: (s) => s.store && s.structureType == STRUCTURE_CONTAINER && s.store.energy > 0});
        }();

        if (!droppedEnergy) droppedEnergy = {};

        if (droppedEnergy.amount == undefined || droppedEnergy.amount < 1010) {
            if (container) {
                pickFromContainer(creep, container)
            }
            else if (droppedEnergy) {
                pickFromDroppedEnergy(creep, droppedEnergy)
            }
            else if (room.find(FIND_MY_CREEPS, {filter: (c) => c.memory.p && c.memory.p == 'doHarvest'}).length < 1 && creep.hasActiveBodyparts(WORK)) {
                harvestEnergy(creep);
            }
        }
        else {
            pickFromDroppedEnergy(creep, droppedEnergy)
        }
    }
};

Creep.prototype.getCarrierResources = function (Memory, room = this.room, creep = this) {
    var droppedResources = _.sortBy(room.find(FIND_DROPPED_RESOURCES, {filter: (r) => r.amount > 50}), (r) => r.amount).reverse();
    var droppedResource = droppedResources[1] && droppedResources[0].amount-droppedResources[1].amount > 50 ? droppedResources[0] : creep.pos.findClosestByRange(droppedResources);

    if (droppedResource) {
        pickFromDroppedEnergy(creep, droppedResource);
    }
    else {
        var container = creep.pos.findClosestByRange(FIND_STRUCTURES, {filter: (s) => s.structureType == STRUCTURE_CONTAINER && _.sum(s.store) > 50});

        if (container && container) {
            pickFromContainer(creep, container, Object.keys(container.store)[0]);
        }
    }
};

function pickFromDroppedEnergy(creep, droppedResource, room=creep.room) {
    if (creep.pickup(droppedResource) == ERR_NOT_IN_RANGE) {
        creep.moveWithPath(droppedResource, {range: 1, repath: 0.01, maxRooms: 1});
    }
}

function pickFromContainer(creep, container, resourceType = RESOURCE_ENERGY, room=creep.room) {
    if (creep.withdraw(container, resourceType) == ERR_NOT_IN_RANGE) {
        creep.moveWithPath(container, {range: 1, repath: 0.01, maxRooms: 1});
    }
}

function harvestEnergy(creep, room=creep.room) {
    var source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

    if (!source) creep.runInSquares();

    if (creep.pos.isNearTo(source)) creep.harvest(source);
    else creep.moveWithPath(source, {range: 1, repath: 0.01, maxRooms: 1});
}

Creep.prototype.talk =
    function (message, public = true) {
        if (Game.cpu.bucket > 9000) this.say(message, public);
    };

Creep.prototype.runInSquares =
    function () {
        if (Game.time % 5 == 0) {
            switch (this.memory.lastMove) {
                case TOP:
                    this.memory.lastMove = LEFT;
                    this.move(LEFT);
                    break;
                case LEFT:
                    this.memory.lastMove = BOTTOM;
                    this.move(BOTTOM);
                    break;
                case BOTTOM:
                    this.memory.lastMove = RIGHT;
                    this.move(RIGHT);
                    break;
                case RIGHT:
                    this.memory.lastMove = TOP;
                    this.move(TOP);
                    break;
                default:
                    this.memory.lastMove = TOP;
                    this.move(TOP);
            }
        }
    };

/**
 * Creep method optimizations "getActiveBodyparts"
 * credits to proximo
 */
Creep.prototype.getActiveBodyparts = function (type) {
    var count = 0;
    for (var i = this.body.length; i-- > 0;) {
        if (this.body[i].hits > 0) {
            if (this.body[i].type === type) {
                count++;
            }
        } else break;
    }
    return count;
};

/**
 * Fast check if bodypart exists
 * credits to proximo
 */
Creep.prototype.hasActiveBodyparts = function (type) {
    for (var i = this.body.length; i-- > 0;) {
        if (this.body[i].hits > 0) {
            if (this.body[i].type === type) {
                return true;
            }
        } else break;
    }
    return false;
};

RoomPosition.prototype.findNearby = function (structureType, filter) {
    if (!this || !this.roomName || !Game.rooms[this.roomName]) return [];

    var room = Game.rooms[this.roomName];

    var positions = [room.getPositionAt(this.x, + this.y-1),
        room.getPositionAt(this.x, + this.y+1),
        room.getPositionAt(this.x-1, + this.y),
        room.getPositionAt(this.x+1, + this.y),
        room.getPositionAt(this.x-1, + this.y-1),
        room.getPositionAt(this.x+1, + this.y-1),
        room.getPositionAt(this.x+1, + this.y+1),
        room.getPositionAt(this.x-1, + this.y+1)];

    var structures = [];

    for (let position of positions) {
        if (!position) continue;

        var structure = _.filter(position.lookFor(LOOK_STRUCTURES), (s) => s.structureType == structureType && filter(s))[0];

        if (structure) structures.push(structure);
    }

    return structures;
};