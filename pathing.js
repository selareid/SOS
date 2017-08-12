Creep.prototype.moveWithPath =
    function (dest, opts = {range: 1, maxRooms: 1, obstacles: getObstacles(this.room)}) {
        try {
            if (dest.pos) dest = dest.pos;

            if (!global[this.room.name]) global[this.room.name] = {};
            if (!global[this.room.name].paths) global[this.room.name].paths = {};

            var thisPosName = (this.pos.x * 100 + this.pos.y).toString(36);
            var destPosName = (dest.x * 100 + dest.y).toString(36);
            var roomTag = this.pos.roomName + dest.roomName;

            if (this.memory.path && this.memory.path.split(',')[2] == destPosName) thisPosName = this.memory.path.split(',')[1];

            if (global[this.room.name].paths[roomTag + ',' + thisPosName + ',' + destPosName]) {
                var rsl = this.moveByPath(global[this.room.name].paths[roomTag + ',' + thisPosName + ',' + destPosName]);
                this.memory.goto++;

                if (rsl == ERR_NOT_FOUND || !global[this.room.name].paths[roomTag + ',' + thisPosName + ',' + destPosName][this.memory.goto + 1]) {
                    delete this.memory.goto;
                    delete this.memory.path;
                }
            }
            else {
                global[this.room.name].paths[roomTag + ',' + thisPosName + ',' + destPosName] = this.pos.findPathTo(dest, opts);

                this.moveByPath(global[this.room.name].paths[roomTag + ',' + thisPosName + ',' + destPosName]);
                this.memory.goto = 1;
                this.memory.path = roomTag + ',' + thisPosName + ',' + destPosName;
            }
        }
        catch (err) {
            err && err.stack ? console.pathError(err.stack) : console.pathError(err);
        }
    };