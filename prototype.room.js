Room.prototype.getStructures =
    function (structureType, filter = () => true) {
    if (!global[this.name]) global[this.name] = {};
        if (!global[this.name].structures || global[this.name].structures.lc != Game.time) {
            global[this.name].structures = {lc: Game.time};
            global[this.name].structures.structures = _.groupBy(this.find(FIND_STRUCTURES), (s) => s.structureType);
        }

        return _.filter(global[this.name].structures.structures[structureType], filter);
    };