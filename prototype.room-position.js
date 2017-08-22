RoomPosition.prototype.findNearbyStructure = function (structureType, filter) {
    if (!Game.rooms[this.roomName] || structureType == STRUCTURE_EXTENSION) return [];
    
    return this.findInRange(Game.rooms[this.roomName].getStructures(structureType), 1, (filter && filter instanceof Function ? filter : undefined));
};
