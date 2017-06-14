module.exports = () => {

    isUndefinedOrNull = function (val) {
        return val === undefined || val === null;
    };

    Process = class {
        constructor(processType, roomName, object) {
            this.pN = processType;
            this.prio = getPrio(processType);
            this.rmN = roomName;
            if (object) this.obj = object.id;
        }
    };

    getPrio = function(process) {
        switch (process) {
            case 'checkRooms': return 11;
            case 'checkCreeps': return 10;
            case 'doTowers': return 15;
            case 'doHarvest': return 4;
            case 'fillSpawn': return 4;
            case 'praiseRC': return 3;
            case 'takeCare': return 3;
            case 'room': return 10;
            default: return 0;
        }
    };

    spawnNewProcess = function(processType, roomName, object) {
        var tag = processType + ':' + Game.time % 100 + Math.round(Math.random() * 100);

        global.Mem.p[tag] = new Process(processType, roomName, object);
    };

    makeid = function ()
    {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for( var i=0; i < 5; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    }
};