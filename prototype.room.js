const structureTimeToSaveFor = 13;
Room.prototype.getStructures =
    function (structureType, filter) {
        if (!global[this.name]) global[this.name] = {};
        if (!global[this.name].structures || Game.time-global[this.name].structures.lc > structureTimeToSaveFor) {
            global[this.name].structures = {lc: Game.time};

            var grouped = _.groupBy(this.find(FIND_STRUCTURES), (s) => s.structureType);
            var mappedGroup = {};

            for (let group in grouped) mappedGroup[group] = _.map(grouped[group], (s) => {return s ? s.id : null});

            global[this.name].structures.structures = mappedGroup;
        }

        var needed = global[this.name].structures.structures[structureType].map(Game.getObjectById).filter(obj => obj !== null);
        return filter ? _.filter(needed, filter) : needed;
    };