Creep.prototype.moveWithPath =
    function (dest, opts = {range: 1, maxRooms: 1, obstacles: getObstacles(this.room)}) {
        try {
            if (dest.pos) dest = dest.pos;

            if (dest && dest.roomName == this.pos.roomName) {
                if (!global[this.room.name]) global[this.room.name] = {};
                if (!global[this.room.name].paths) global[this.room.name].paths = {};

                var thisPosName = (this.pos.x * 100 + this.pos.y).toString(36);
                var destPosName = (dest.x * 100 + dest.y).toString(36);

                if (this.memory.path && this.memory.path.split(',')[1] == destPosName) thisPosName = this.memory.path.split(',')[1];

                if (global[this.room.name].paths[thisPosName + ',' + destPosName]) {
                    this.moveByPath(global[this.room.name].paths[thisPosName + ',' + destPosName]);
                    this.memory.goto++;

                    if (!global[this.room.name].paths[thisPosName + ',' + destPosName][this.memory.goto + 1]) {
                        delete this.memory.goto;
                        delete this.memory.path;
                    }
                }
                else {
                    global[this.room.name].paths[thisPosName + ',' + destPosName] = this.pos.findPathTo(dest, opts);

                    this.moveByPath(global[this.room.name].paths[thisPosName + ',' + destPosName]);
                    this.memory.goto = 1;
                    this.memory.path = thisPosName + ',' + destPosName;
                }
            }
            else if (dest) {
                this.travelTo(dest, opts);
            }
        }
        catch (err) {
            err && err.stack ? console.pathError(err.stack) : console.pathError(err);
        }
    };