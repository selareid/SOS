RoomPosition.prototype.findNearbyStructure = function (structureType, filter) {
    if (!this || !this.roomName || !Game.rooms[this.roomName]) return [];

    var room = Game.rooms[this.roomName];

    var positions = [this,
        room.getPositionAt(this.x, + this.y-1),
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

        var structure;
        structure = _.filter(position.lookFor(LOOK_STRUCTURES), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)))[0];

        if (structure) structures.push(structure);
    }

    return structures;
};