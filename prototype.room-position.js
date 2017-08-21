RoomPosition.prototype.findNearbyStructure = function (structureType, filter) {
    if (!this || !this.roomName || !Game.rooms[this.roomName]) return [];

    var room = Game.rooms[this.roomName];

    var founds = [room.lookForAt(LOOK_STRUCTURES, this),
        room.lookForAt(LOOK_STRUCTURES, this.x, this.y-1),
        room.lookForAt(LOOK_STRUCTURES, this.x, this.y+1),
        room.lookForAt(LOOK_STRUCTURES, this.x-1, this.y),
        room.lookForAt(LOOK_STRUCTURES, this.x+1, this.y),
        room.lookForAt(LOOK_STRUCTURES, this.x-1, this.y-1),
        room.lookForAt(LOOK_STRUCTURES, this.x+1, this.y-1),
        room.lookForAt(LOOK_STRUCTURES, this.x+1, this.y+1),
        room.lookForAt(LOOK_STRUCTURES, this.x-1, this.y+1)];

    var structures = [];

    for (let found of founds) {
        if (!found) continue;

        var structure;
        structure = _.filter(found, (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)))[0];

        if (structure) structures.push(structure);
    }

    return structures;
};