module.exports = {run: spawn, canAfford: canAfford, reCalcBody: reCalcBody};

function getBodyCost(body) {
    var cost = 0;
    _.forEach(body, (s) => cost+=BODYPART_COST[s]);
    return cost;
}

function spawn(room, looped = [], single = [], defMaxParts) {
    var costs = {
        looped: getBodyCost(looped),
        single: getBodyCost(single)
    };

    var energyCapacityAvailable = room.energyCapacityAvailable;

    var maxParts = defMaxParts ? defMaxParts : Math.floor((50-single.length)/looped.length);
    var numberOfParts = Math.floor((energyCapacityAvailable-costs.single)/costs.looped);
    if (numberOfParts > maxParts) numberOfParts = maxParts;

    var body = single;
    Array.prototype.push.apply(body, looped);

    for (let i = 0; i < numberOfParts-1; i++) {
        Array.prototype.push.apply(body, looped);
    }

    var cost = costs.single+(numberOfParts*costs.looped);

    return {body, cost};
}

function canAfford (room, cost) {
    /*
     * 1 == true, canCreateCreep
     * 2 == false, cantCreateCreep... Yet
     * 3 == bad, shouldn't Create Creep
     */

    if (!room) throw 'Error Invalid Room';

    var energy = room.energyAvailable;
    var cost = cost ? cost : 0;

    if (energy >= cost) return 1;
    else {
        var energyCapacity = room.energyCapacityAvailable;
        var energyAvailable = _.sum(room.find(FIND_DROPPED_RESOURCES, {filter: (r) => r.resourceType == RESOURCE_ENERGY}), '.amount');
        var boxedEnrg = _.sum(room.find(FIND_STRUCTURES, {filter: (s) => (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE || s.structureType == STRUCTURE_TERMINAL)
        && s.store.energy > 0}), '.store.energy');

        energyAvailable = energyAvailable ? boxedEnrg ? energyAvailable+boxedEnrg : energyAvailable : boxedEnrg ? boxedEnrg : 0;

        if (cost > energyCapacity || 
            (((room.find(FIND_MY_CREEPS, {filter: (c) => c.memory.p && c.memory.p == 'doHarvest'}).length < 1 && room.find(FIND_MY_CREEPS, {filter: (c) => c.memory.p && c.memory.p == 'fillExt'}).length < 1)
            || room.find(FIND_MY_CREEPS, {filter: (c) => c.memory.p && c.memory.p == 'fillSpawn'}).length < 1) && cost > 300))  return 3;
        return 2;
    }
}

function reCalcBody(energy, looped = [], single = [], defMaxParts) {
    var costs = {
        looped: getBodyCost(looped),
        single: getBodyCost(single)
    };

    var energyCapacityAvailable = energy;

    var maxParts = defMaxParts ? defMaxParts : Math.floor((50-single.length)/looped.length);
    var numberOfParts = Math.floor((energyCapacityAvailable - costs.single) / costs.looped);
    if (numberOfParts > maxParts) numberOfParts = maxParts;

    var body = single;
    Array.prototype.push.apply(body, looped);

    for (let i = 0; i < numberOfParts - 1; i++) {
        Array.prototype.push.apply(body, looped);
    }

    var cost = costs.single + (numberOfParts * costs.looped);

    return {body, cost};
}
