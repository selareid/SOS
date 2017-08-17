module.exports = () => {

    profile = (callback) => {var before = Game.cpu.getUsed(); callback(); return Game.cpu.getUsed()-before;};

    isUndefinedOrNull = function (val) {
        return val === undefined || val === null;
    };

    Process = class {
        constructor(processType, roomName, object) {
            this.pN = processType;
            this.prio = getPrio(processType);
            this.rmN = roomName;
            if (object) this.oNCreation = object;
        }
    };

    getPrio = function(process) {
        switch (process) {
            case 'doStats': return 0;
            case 'doTowers': return 0;

            case 'checkRooms': return 1;

            case 'checkCreeps': return 2;
            case 'room': return 2;

            case 'doHarvest': return 3;
            case 'fillSpawn': return 3;
            case 'fillExt': return 3;
            case 'strgDistr': return 3;

            case 'praiseRC': return 5;
            case 'takeCare': return 5;

            case 'checkGlobalProcesses': return 11;
            case 'doTerminal': return 11;
            case 'doPowerProc': return 11;
            case 'placeTowers': return 11;
            case 'placeExtensions': return 12;
            case 'buildRoads': return 12;

            default: return 10;
        }
    };

    processExists = function(processType, roomName) {
        return roomName ? _.filter(global.Mem.p, (p) => p.rmN == roomName && p.pN == processType).length > 0 || _.filter(global.Mem.iP, (p) => p[1].rmN == roomName && p[1].pN == processType).length > 0
            : _.filter(global.Mem.p, (p) => p.pN == processType).length > 0 || _.filter(global.Mem.iP, (p) => p[1].pN == processType).length > 0;
    };

    spawnNewProcess = function(processType, roomName, oNCreation) {
        var newProcess = new Process(processType, roomName, oNCreation);
        global.Mem.p.splice(_.sortedIndex(global.Mem.p, newProcess, 'prio'), 0, newProcess);
    };

    reinsertProcess = function(process_it, prio, process = global.Mem.p[process_it]) {
        switch (prio) {
            case 1:
                if (process.prio) process.prio++;
                else process.prio = getPrio(process.pN);
                break;
            default:
                if (getPrio(process.pN) === process.prio) return;
                process.prio = getPrio(process.pN);
        }

        global.Mem.p.splice(_.sortedIndex(global.Mem.p, process, 'prio'), 0, process);
        global.Mem.p.splice(process_it, 1);
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
        return global[room.name].distrSquareFlag ? [global[room.name].distrSquareFlag, {pos: room.getPositionAt(global[room.name].distrSquareFlag.pos.x, global[room.name].distrSquareFlag.pos.y+1)}].concat(room.find(FIND_MY_SPAWNS)) : room.find(FIND_MY_SPAWNS);
    };

    storageEnergy = 50000;

    terminalGoals = {
        [RESOURCE_ENERGY]: 150000,

        [RESOURCE_HYDROGEN]: 6000,
        [RESOURCE_OXYGEN]: 6000,
        [RESOURCE_UTRIUM]: 6000,
        [RESOURCE_KEANIUM]: 6000,
        [RESOURCE_LEMERGIUM]: 6000,
        [RESOURCE_ZYNTHIUM]: 6000,
        [RESOURCE_CATALYST]: 6000,

        [RESOURCE_HYDROXIDE]: 6000,
        [RESOURCE_GHODIUM]: 6000,
        [RESOURCE_ZYNTHIUM_KEANITE]: 6000,
        [RESOURCE_UTRIUM_LEMERGITE]: 6000,


        [RESOURCE_UTRIUM_HYDRIDE]: 6000,
        [RESOURCE_UTRIUM_OXIDE]: 6000,
        [RESOURCE_KEANIUM_HYDRIDE]: 6000,
        [RESOURCE_KEANIUM_OXIDE]: 6000,
        [RESOURCE_LEMERGIUM_HYDRIDE]: 6000,
        [RESOURCE_LEMERGIUM_OXIDE]: 6000,
        [RESOURCE_ZYNTHIUM_HYDRIDE]: 6000,
        [RESOURCE_ZYNTHIUM_OXIDE]: 6000,
        [RESOURCE_GHODIUM_HYDRIDE]: 6000,
        [RESOURCE_GHODIUM_OXIDE]: 6000,

        [RESOURCE_UTRIUM_ACID]: 3000,
        [RESOURCE_UTRIUM_ALKALIDE]: 3000,
        [RESOURCE_KEANIUM_ACID]: 3000,
        [RESOURCE_KEANIUM_ALKALIDE]: 3000,
        [RESOURCE_LEMERGIUM_ACID]: 3000,
        [RESOURCE_LEMERGIUM_ALKALIDE]: 3000,
        [RESOURCE_ZYNTHIUM_ACID]: 3000,
        [RESOURCE_ZYNTHIUM_ALKALIDE]: 3000,
        [RESOURCE_GHODIUM_ACID]: 3000,
        [RESOURCE_GHODIUM_ALKALIDE]: 3000,

        [RESOURCE_CATALYZED_UTRIUM_ACID]: 6000,
        [RESOURCE_CATALYZED_UTRIUM_ALKALIDE]: 6000,
        [RESOURCE_CATALYZED_KEANIUM_ACID]: 6000,
        [RESOURCE_CATALYZED_KEANIUM_ALKALIDE]: 6000,
        [RESOURCE_CATALYZED_LEMERGIUM_ACID]: 6000,
        [RESOURCE_CATALYZED_LEMERGIUM_ALKALIDE]: 6000,
        [RESOURCE_CATALYZED_ZYNTHIUM_ACID]: 6000,
        [RESOURCE_CATALYZED_ZYNTHIUM_ALKALIDE]: 6000,
        [RESOURCE_CATALYZED_GHODIUM_ACID]: 6000,
        [RESOURCE_CATALYZED_GHODIUM_ALKALIDE]: 6000
    };
};
