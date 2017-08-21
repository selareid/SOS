RoomPosition.prototype.findNearbyStructure = function (structureType, filter) {
    if (!this || !this.roomName || !Game.rooms[this.roomName]) return [];

    var room = Game.rooms[this.roomName];
    var found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)))

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x, this.y - 1), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x, this.y + 1), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x - 1, this.y), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x + 1, this.y), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x - 1, this.y - 1), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x + 1, this.y - 1), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x + 1, this.y + 1), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    found = _.filter(room.lookForAt(LOOK_STRUCTURES, this.x - 1, this.y + 1), (s) => s.structureType == structureType && (!filter || !filter instanceof Function || (s)));
    if (found && found.length > 0) return found;

    return [];
};