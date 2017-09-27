module.exports = () => {

    profile = (callback) => {var before = Game.cpu.getUsed(); callback(); return Game.cpu.getUsed()-before;};

    isUndefinedOrNull = function (val) {
        return val == undefined;
    };

    Process = class {
        constructor(processType, roomName, object) {
            this.pN = processType;
            this.queue = getQueue(processType);
            this.rmN = roomName;
            if (object) this.oNCreation = object;
        }
    };

    getQueue = function(process) {
        switch (process) {
            case 'doStats': return 0;
            case 'doTowers': return 0;

            case 'checkRooms': return 1;
            case 'checkCreeps': return 1;
            case 'room': return 1;
                
            case 'doHarvest': return 2;
            case 'fillSpawn': return 2;
            case 'fillExt': return 2;
            case 'minimalist': return 2;

            case 'strgDistr': return 3;

            case 'praiseRC': return 4;
            case 'takeCare': return 4;

            case 'checkGlobalProcesses': return 6;
            case 'doTerminal': return 6;

            case 'doPowerProc': return 10;
            case 'placeTowers': return 10;
            case 'placeExtensions': return 10;
            case 'buildRoads': return 10;

            default: return 5;
        }
    };

    processExists = function(processType, roomName) {
        return roomName ? _.filter(global.Mem.p, (p) => p.rmN == roomName && p.pN == processType).length > 0
            : _.filter(global.Mem.p, (p) => p.pN == processType).length > 0;
    };

    spawnNewProcess = function(processType, roomName, oNCreation) {
        do {
            var tag = processType + '-' + Math.round(Math.random() * 1000);
        }
        while (Memory.p[tag]);

        global.Mem.p[tag] = new Process(processType, roomName, oNCreation);
    };

    makeid = function ()
    {
        var text = "";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

        for( var i=0; i < 5; i++ )
            text += possible.charAt(Math.floor(Math.random() * possible.length));

        return text;
    };

    getObstacles = function (room) {
        if (!room) return [];
        return global[room.name] && global[room.name].distrSquareFlag ? [global[room.name].distrSquareFlag, {pos: room.getPositionAt(global[room.name].distrSquareFlag.pos.x, global[room.name].distrSquareFlag.pos.y+1)}].concat(room.getStructures(STRUCTURE_SPAWN)) : room.getStructures(STRUCTURE_SPAWN);
    };

    storageEnergy = 50000;

    terminalGoals = {
        [RESOURCE_ENERGY]: 50000,
        [RESOURCE_POWER]: 100,

        [RESOURCE_HYDROGEN]: 5000,
        [RESOURCE_OXYGEN]: 1000,
        [RESOURCE_UTRIUM]: 5000,
        [RESOURCE_KEANIUM]: 5000,
        [RESOURCE_LEMERGIUM]: 1000,
        [RESOURCE_ZYNTHIUM]: 5000,
        [RESOURCE_CATALYST]: 5000,

        [RESOURCE_HYDROXIDE]: 5000,
        [RESOURCE_GHODIUM]: 1000,
        [RESOURCE_ZYNTHIUM_KEANITE]: 5000,
        [RESOURCE_UTRIUM_LEMERGITE]: 5000,


        [RESOURCE_UTRIUM_HYDRIDE]: 5000,
        [RESOURCE_UTRIUM_OXIDE]: 5000,
        [RESOURCE_KEANIUM_HYDRIDE]: 5000,
        [RESOURCE_KEANIUM_OXIDE]: 5000,
        [RESOURCE_LEMERGIUM_HYDRIDE]: 5000,
        [RESOURCE_LEMERGIUM_OXIDE]: 5000,
        [RESOURCE_ZYNTHIUM_HYDRIDE]: 5000,
        [RESOURCE_ZYNTHIUM_OXIDE]: 5000,
        [RESOURCE_GHODIUM_HYDRIDE]: 5000,
        [RESOURCE_GHODIUM_OXIDE]: 5000,

        [RESOURCE_UTRIUM_ACID]: 5000,
        [RESOURCE_UTRIUM_ALKALIDE]: 5000,
        [RESOURCE_KEANIUM_ACID]: 5000,
        [RESOURCE_KEANIUM_ALKALIDE]: 5000,
        [RESOURCE_LEMERGIUM_ACID]: 5000,
        [RESOURCE_LEMERGIUM_ALKALIDE]: 5000,
        [RESOURCE_ZYNTHIUM_ACID]: 5000,
        [RESOURCE_ZYNTHIUM_ALKALIDE]: 5000,
        [RESOURCE_GHODIUM_ACID]: 5000,
        [RESOURCE_GHODIUM_ALKALIDE]: 5000,

        [RESOURCE_CATALYZED_UTRIUM_ACID]: 5000,
        [RESOURCE_CATALYZED_UTRIUM_ALKALIDE]: 5000,
        [RESOURCE_CATALYZED_KEANIUM_ACID]: 5000,
        [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: 5000,
        [RESOURCE_CATALYZED_LEMERGIUM_ACID]: 5000,
        [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: 5000,
        [RESOURCE_CATALYZED_ZYNTHIUM_ACID]: 5000,
        [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]: 5000,
        [RESOURCE_CATALYZED_GHODIUM_ACID]: 5000,
        [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: 5000
    }
};
