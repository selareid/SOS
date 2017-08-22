RoomPosition.prototype.findNearbyStructure = function (structureType, filter) {
    if (!this.room) return [];
    
    return this.findInRange(this.room.getStructures(structureType), 1, (filter && filter instanceof Function ? filter : undefined));
};
