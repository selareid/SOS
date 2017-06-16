Creep.prototype.getConsumerEnergy = function (Memory, room = this.room, creep = this) {
    var storage = room.storage;
    var droppedEnergy = creep.pos.findClosestByRange(FIND_DROPPED_RESOURCES, {filter: (r) => r.amount > 20 && r.resourceType == RESOURCE_ENERGY});
    var container = function () {
        return creep.pos.findClosestByRange(FIND_STRUCTURES, {filter: (s) => s.store && s.structureType == STRUCTURE_CONTAINER && s.store.energy > 0});
    }();

    if (!storage) {

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
    else {

        if (storage.store[RESOURCE_ENERGY] > 50) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, {
                    visualizePathStyle: {
                        fill: 'transparent',
                        stroke: '#f46464',
                        lineStyle: 'dashed',
                        strokeWidth: .2,
                        opacity: .5
                    }
                });
            }
        }
        else {
            if (container) {
                pickFromContainer(creep, container)
            }
            else {
                if (droppedEnergy) {
                    pickFromDroppedEnergy(creep, droppedEnergy)
                }
            }
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

function pickFromDroppedEnergy(creep, droppedResource) {
    if (creep.pickup(droppedResource) == ERR_NOT_IN_RANGE) {
        creep.moveTo(droppedResource, {
            visualizePathStyle: {
                fill: 'transparent',
                stroke: '#f46464',
                lineStyle: 'dashed',
                strokeWidth: .2,
                opacity: .5
            }
        });
    }
}

function pickFromContainer(creep, container, resourceType = RESOURCE_ENERGY) {
    if (creep.withdraw(container, resourceType) == ERR_NOT_IN_RANGE) {
        creep.moveTo(container, {
            visualizePathStyle: {
                fill: 'transparent',
                stroke: '#f46464',
                lineStyle: 'dashed',
                strokeWidth: .2,
                opacity: .5
            }
        });
    }
}

function harvestEnergy(creep) {
    var source = creep.pos.findClosestByRange(FIND_SOURCES_ACTIVE);

    if (!source) creep.runInSquares();

    if (creep.pos.isNearTo(source)) creep.harvest(source);
    else creep.moveTo(source);
}

Creep.prototype.runInSquares =
    function () {
        var creep = this;
        switch (creep.memory.lastMove) {
            case TOP:
                creep.memory.lastMove = LEFT;
                creep.move(LEFT);
                break;
            case LEFT:
                creep.memory.lastMove = BOTTOM;
                creep.move(BOTTOM);
                break;
            case BOTTOM:
                creep.memory.lastMove = RIGHT;
                creep.move(RIGHT);
                break;
            case RIGHT:
                creep.memory.lastMove = TOP;
                creep.move(TOP);
                break;
            default:
                creep.memory.lastMove = TOP;
                creep.move(TOP);
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
