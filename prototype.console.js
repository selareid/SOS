module.exports = () => {
    objectLinker = function (roomArg, text = undefined, select = true) {
        let roomName;
        let id = roomArg.id;
        if (roomArg instanceof Room) {
            roomName = roomArg.name;
        } else if (roomArg.pos != undefined) {
            roomName = roomArg.pos.roomName;
        } else if (roomArg.roomName != undefined) {
            roomName = roomArg.roomName;
        } else if (typeof roomArg === 'string') {
            roomName = roomArg;
        } else {
            console.log(`Invalid parameter to roomLink console function: ${roomArg} of type ${typeof roomArg}`);
        }
        text = text || (id ? roomArg : roomName);
        return `<a style="color: #c49e4c" href="#!/room/${roomName}" ${select && id ? `onclick="angular.element('body').injector().get('RoomViewPendingSelector').set('${id}')"` : ``}>${text}</a>`;
    };

    errorString = "[" + "<p style=\"display:inline; color: #ed4543\">ERROR</p>" + "] ";
    kernelString = "[" + "<p style=\"display:inline; color: rgba(228, 231, 17, 0.81)\">KERNEL</p>" + "] ";
    processString = "[" + "<p style=\"display:inline; color: rgba(110, 231, 95, 0.81)\">PROCESS</p>" + "] ";

    timeString = "[" + "<p style=\"display:inline; color: #abd7ed\">" + Game.time + "</p>" + "] ";
    spawnString = "[" + "<p style=\"display:inline; color: #71ed7c\">SPAWN</p>" + "] ";
    marketString = "[" + "<p style=\"display:inline; color: #5bc2ed\">MARKET</p>" + "] ";

    roomLink = function (room) {
        return "[" + "<p style='display:inline; color: #edea94'>" + objectLinker(room.name) + "</p>" + "] ";
    };

    marketHeader = function () {
        return "[" + "<p style='display:inline'>" + 'MARKET' + "</p>" + "] ";
    };


    console.errorLog = function (errorMessage) {
        console.log(timeString + errorString + errorMessage);
        Game.notify(timeString + errorString + errorMessage);
    };

    console.kernelError = function (errorMessage) {
        console.log(timeString + kernelString + errorString + errorMessage);
        Game.notify(timeString + kernelString + errorString + errorMessage);
    };

    console.processError = function (errorMessage) {
        console.log(timeString + processString + errorString + errorMessage);
        Game.notify(timeString + processString + errorString + errorMessage);
    };

    console.logTickStart = function () {
        console.log(timeString + 'Tick Started ' + 'CPU: ' + Game.cpu.getUsed().toFixed(3));
    };

    console.logTickSummary = function () {
        console.log(timeString + 'Tick Ended ' + 'CPU: ' + Game.cpu.getUsed().toFixed(3)
            + '\n' + ' Processes Run: ' + (global.processesRun/global.processesTotal*100).toFixed(3) + '%'
            + '\n' + ' Creeps: ' + _.size(Game.creeps)
            + (global.processesSkipped ? '\n'+ ' Processes Skipped: ' + global.processesSkipped: ''));
    };

    console.roomLog = function (room, message) {
        console.log(timeString + roomLink(room) + message);
    };

    console.terminalLog = function (room, message) {
        console.log(timeString + roomLink(room) + marketString + message);
    };

    console.logSpawn = function (room, creepName) {
        console.log(timeString + roomLink(room) + spawnString + creepName);
    };

    console.notify = function (message) {
        console.log(timeString + message);
        Game.notify(timeString + message);
    };
};
