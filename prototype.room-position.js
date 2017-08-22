RoomPosition.prototype.findNearbyStructure = function (structureType, filter) {
    if (!Game.rooms[this.roomName]) return [];
    
    return this.findInRange(Game.rooms[this.roomName].getStructures(structureType), 1, (filter && filter instanceof Function ? filter : undefined));
};
