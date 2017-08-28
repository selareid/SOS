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

        var needed = _.compact(_.map(global[this.name].structures.structures[structureType], (s) => Game.getObjectById(s)));
        return filter ? _.filter(needed, filter) : needed;
    };

Object.defineProperty(Room.prototype, 'extensionFlag', {
    get: function() {
        if (Game.flags[this.flagName]) return Game.flags[this.flagName];

        var flag = this.find(FIND_FLAGS, {filter: (f) => f.name.split(':')[0] == 'extensionFlag'})[0];

        this.flagName = flag ? flag.name : undefined;
        return flag || undefined;
    },
    enumerable: false,
    configurable: false
});