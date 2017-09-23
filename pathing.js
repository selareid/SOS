const HIGH_MASK = 0x8000;
/* eslint-disable no-bitwise*/

/**
 *
 * @param {int} value, needs to be lower than {HIGH_MASK}, as it will be or-ed to avoid unavailable char values
 * @returns {string} a char on which {decodeChar} will return the original value
 */
function encodeChar(value) {
    if (HIGH_MASK === value & HIGH_MASK) {
        throw new Error('attempt to encode too high value' + value);
    }

    return String.fromCharCode(value | HIGH_MASK);
}

/**
 *
 * @param {string} char 1 char string
 * @returns {number} the value previously encoded using {encodeChar}
 */
function decodeChar(char) {
    return char.charCodeAt(0) & (~HIGH_MASK);
}

RoomPosition.prototype.customFindPathTo = function (dest, opts) {
    if (isUndefinedOrNull(opts.range)) opts.range = 1;
    if (isUndefinedOrNull(opts.obstacles)) opts.obstacles = getObstacles(Game.rooms[this.roomName]);
    if (isUndefinedOrNull(opts.plainCost)) opts.plainCost = 2;
    if (isUndefinedOrNull(opts.swampCost)) opts.swampCost = 10;
    if (isUndefinedOrNull(opts.ignoreCreeps)) opts.ignoreCreeps = true;
    if (isUndefinedOrNull(opts.roomCallback)) opts.roomCallback = function getCostMatrix (roomName) {
        var room = Game.rooms[roomName];
        if (!room) return;
        if (!global[room.name]) global[room.name] = {};

        if (opts.ignoreCreeps && global[room.name].CostMatrix && global[room.name].CostMatrix instanceof PathFinder.CostMatrix && global[room.name].CostMatrixCount && global[room.name].CostMatrixCount > Game.time) return global[room.name].CostMatrix;
        else if (global[room.name].CostMatrixIG && global[room.name].CostMatrixIG instanceof PathFinder.CostMatrix && global[room.name].CostMatrixIGCount && global[room.name].CostMatrixIGCount > Game.time) return global[room.name].CostMatrixIG;

        var costs = new PathFinder.CostMatrix;

        room.find(FIND_STRUCTURES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                // Favor roads over plain tiles
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                (struct.structureType !== STRUCTURE_RAMPART ||
                !struct.my)) {
                // Can't walk through non-walkable buildings
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        room.find(FIND_CONSTRUCTION_SITES).forEach(function(struct) {
            if (struct.structureType === STRUCTURE_ROAD) {
                // Favor roads over plain tiles
                costs.set(struct.pos.x, struct.pos.y, 1);
            } else if (struct.structureType !== STRUCTURE_CONTAINER &&
                (struct.structureType !== STRUCTURE_RAMPART ||
                !struct.my)) {
                // Can't walk through non-walkable buildings
                costs.set(struct.pos.x, struct.pos.y, 0xff);
            }
        });

        room.find(FIND_FLAGS).forEach(function(creep) {
            costs.set(creep.pos.x, creep.pos.y, 15);
        });

        room.find(FIND_CREEPS).forEach(function(creep) {
            if (!opts.ignoreCreeps || (creep.memory && (creep.memory.p == 'doHarvest' || creep.memory.p == 'takeCare'))) costs.set(creep.pos.x, creep.pos.y, 0xff);
        });

        if (opts.ignoreCreeps) {
            global[room.name].CostMatrixCount = Game.time + 75;
            global[room.name].CostMatrix = costs;
        }
        else {
            global[room.name].CostMatrixIG = costs;
            global[room.name].CostMatrixIGCount = Game.time + 75;
        }

        return costs;
    };


    var path = PathFinder.search(this, {pos: dest, range: opts.range}, opts);

    return path.path;
};

Creep.prototype.customMoveByPath = function (path) {
    if (this.fatigue > 0) return ERR_TIRED;

    this.memory.goto = !isUndefinedOrNull(this.memory.goto) && this.pos.isEqualTo(path[this.memory.goto]) ? this.memory.goto + 1 : 0;

    if (encodeChar(this.pos.x * 100 + this.pos.y) == this.memory.lastPos) this.memory.SPC = this.memory.SPC ? this.memory.SPC + 1 : 1;
    else this.memory.SPC = 0;

    if (!path[this.memory.goto] || this.memory.SPC >= 3) {
        delete this.memory.SPC;
        delete this.memory.goto;
        delete this.memory.lastPos;

        return 'failed';
    }

    if (this.memory.SPC >= 2 && this.fatigue == 0 && path[this.memory.goto].lookFor(LOOK_CREEPS).length > 0) {
        var badCreep = path[this.memory.goto].lookFor(LOOK_CREEPS)[0];
        if (badCreep.my) {
            badCreep.move(badCreep.pos.getDirectionTo(this.pos));
        }
    }

    this.memory.lastPos = encodeChar(this.pos.x * 100 + this.pos.y);
    this.move(this.pos.getDirectionTo(path[this.memory.goto]));
};

Creep.prototype.moveWithPath =
    function (dest, opts = {}) {
        try {
            (() => {
                if (!dest || !dest instanceof RoomPosition) return ERR_INVALID_ARGS;
                if (dest.pos) dest = dest.pos;

                if (!global[this.room.name]) global[this.room.name] = {};
                if (!global[this.room.name].paths) global[this.room.name].paths = {};

                var thisPosName = encodeChar(this.pos.x.toString() + this.pos.y.toString());
                var destPosName = encodeChar(dest.x.toString() + dest.y.toString());
                var roomTag = this.pos.roomName + dest.roomName;

                var has = {
                    range: !isUndefinedOrNull(opts.range) ? encodeChar(opts.range) : 'd',
                    obstacles: !isUndefinedOrNull(opts.obstacles) ? opts.obstacles : 'd',
                    plainCost: !isUndefinedOrNull(opts.plainCost) ? encodeChar(opts.plainCost) : 'd',
                    swampCost: !isUndefinedOrNull(opts.swampCost) ? encodeChar(opts.swampCost) : 'd',
                    ignoreCreeps: opts.ignoreCreeps ? encodeChar(1) : encodeChar(0)
                };

                var optsTag = has.range + has.obstacles + has.plainCost + has.swampCost;

                if (this.memory.path && this.memory.path.split(',')[2] == destPosName) thisPosName = this.memory.path.split(',')[1];

                if (/*(opts.Memory && opts.Memory[roomTag+thisPosName+destPosName+optsTag]) || */global[this.room.name].paths[roomTag+thisPosName+destPosName+optsTag]) {
                    var rsl = this.customMoveByPath(/*opts.Memory ? opts.Memory[roomTag+thisPosName+destPosName+optsTag] : */global[this.room.name].paths[roomTag+thisPosName+destPosName+optsTag]);

                    if (rsl == 'failed') {
                        delete this.memory.path;
                    }
                }
                else {
                    /*if (!opts.Memory) */global[this.room.name].paths[roomTag+thisPosName+destPosName+optsTag] = this.pos.customFindPathTo(dest, opts);
                    //else opts.Memory[roomTag+thisPosName+destPosName+optsTag] = this.pos.customFindPathTo(dest, opts);

                    this.customMoveByPath(/*opts.Memory ? opts.Memory[roomTag+thisPosName+destPosName+optsTag] : */global[this.room.name].paths[roomTag+thisPosName+destPosName+optsTag]);
                    this.memory.path = roomTag+thisPosName+destPosName+optsTag;
                }
            })();
        }
        catch (err) {
            err && err.stack ? console.pathError(err.stack) : console.pathError(err);
        }
    };
