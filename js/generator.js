import { IDS } from './constants.js';
import { LogicEngine } from './logic-engine.js';
import { state, updateState } from './game-state.js';

const FACT_TYPES = {
    SUSPECT_LOCATION: 'SUSPECT_LOCATION',
    SUSPECT_ITEM: 'SUSPECT_ITEM',
    SUSPECT_ROLE: 'SUSPECT_ROLE',
    SUSPECT_NOT_ROLE: 'SUSPECT_NOT_ROLE',
    SUSPECT_LOCATION_ITEM: 'SUSPECT_LOCATION_ITEM',
    ROOM_ITEM: 'ROOM_ITEM',
    ROOM_EMPTY: 'ROOM_EMPTY'
};

const getVal = (a, id, type) => a[`${id}_${type}`];
const checkVal = (a, subId, type, val) => getVal(a, subId, type) === val;

export function generateTruth() {
    const activeRoles = ['Killer', 'Victim'];
    if (Math.random() > 0.6) activeRoles.push('Witness');
    if (Math.random() > 0.7) activeRoles.push('Accomplice');
    while (activeRoles.length < 5) activeRoles.push('Innocent');
    
    const shuffle = (a) => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; };
    const sRoles = shuffle([...activeRoles]);
    const sItems = shuffle([...IDS]);
    const sRooms = IDS.map(() => Math.floor(Math.random() * 5));

    const truth = IDS.map(id => ({ id, roomId: sRooms[id], itemId: sItems[id], role: sRoles[id] }));
    return { truth, roles: sRoles };
}

function generateSuspectFacts(truth, roles) {
    const facts = [];
    truth.forEach(p => {
        facts.push({ type: FACT_TYPES.SUSPECT_LOCATION, suspectId: p.id, roomId: p.roomId });
        facts.push({ type: FACT_TYPES.SUSPECT_ITEM, suspectId: p.id, itemId: p.itemId });
        
        if (!['Killer', 'Victim'].includes(p.role)) {
            facts.push({ type: FACT_TYPES.SUSPECT_ROLE, suspectId: p.id, role: p.role });
        }

        ['Killer', 'Victim'].forEach(bad => {
            if (p.role !== bad) {
                facts.push({ type: FACT_TYPES.SUSPECT_NOT_ROLE, suspectId: p.id, role: bad });
            }
        });
    });
    return facts;
}

function generateRoomFacts(truth) {
    const facts = [];
    IDS.forEach(rid => {
        const residents = truth.filter(p => p.roomId === rid);
        if (residents.length === 1) {
            facts.push({ type: FACT_TYPES.ROOM_ITEM, roomId: rid, itemId: residents[0].itemId });
        } else if (residents.length === 0) {
            facts.push({ type: FACT_TYPES.ROOM_EMPTY, roomId: rid });
        }
    });
    return facts;
}

function mergeFacts(facts) {
    const merged = [];
    const suspectFacts = {}; // Maps suspectId to { location, item }

    facts.forEach(f => {
        if (f.type === FACT_TYPES.SUSPECT_LOCATION) {
            if (!suspectFacts[f.suspectId]) suspectFacts[f.suspectId] = {};
            suspectFacts[f.suspectId].location = f;
        } else if (f.type === FACT_TYPES.SUSPECT_ITEM) {
            if (!suspectFacts[f.suspectId]) suspectFacts[f.suspectId] = {};
            suspectFacts[f.suspectId].item = f;
        } else {
            merged.push(f);
        }
    });

    Object.keys(suspectFacts).forEach(sidStr => {
        const sid = parseInt(sidStr);
        const { location, item } = suspectFacts[sid];
        // 70% chance to merge if both exist
        if (location && item && Math.random() > 0.3) {
            merged.push({
                type: FACT_TYPES.SUSPECT_LOCATION_ITEM,
                suspectId: sid,
                roomId: location.roomId,
                itemId: item.itemId
            });
        } else {
            if (location) merged.push(location);
            if (item) merged.push(item);
        }
    });

    return merged;
}

function renderFact(fact, mapping, roles) {
    const fmt = (type, id) => mapping[type][id];
    let text, fn, masks = [];

    switch (fact.type) {
        case FACT_TYPES.SUSPECT_LOCATION: {
            const name = fmt('suspects', fact.suspectId);
            const rName = fmt('rooms', fact.roomId);
            text = `${name} was in the ${rName}.`;
            fn = (a) => checkVal(a, fact.suspectId, 'Room', fact.roomId);
            masks = [{ varIdx: 10 + fact.suspectId, mask: (1 << fact.roomId) }];
            break;
        }
        case FACT_TYPES.SUSPECT_ITEM: {
            const name = fmt('suspects', fact.suspectId);
            const item = fmt('items', fact.itemId);
            text = `${name} had the ${item}.`;
            fn = (a) => checkVal(a, fact.suspectId, 'Item', fact.itemId);
            masks = [{ varIdx: 5 + fact.suspectId, mask: (1 << fact.itemId) }];
            break;
        }
        case FACT_TYPES.SUSPECT_LOCATION_ITEM: {
            const name = fmt('suspects', fact.suspectId);
            const rName = fmt('rooms', fact.roomId);
            const item = fmt('items', fact.itemId);
            text = `${name} was in the ${rName} with the ${item}.`;
            fn = (a) => checkVal(a, fact.suspectId, 'Room', fact.roomId) && checkVal(a, fact.suspectId, 'Item', fact.itemId);
            masks = [
                { varIdx: 10 + fact.suspectId, mask: (1 << fact.roomId) },
                { varIdx: 5 + fact.suspectId, mask: (1 << fact.itemId) }
            ];
            break;
        }
        case FACT_TYPES.SUSPECT_ROLE: {
            const name = fmt('suspects', fact.suspectId);
            const roleIndices = roles.map((r, i) => r === fact.role ? i : -1).filter(i => i !== -1);
            let roleMask = 0; roleIndices.forEach(i => roleMask |= (1 << i));
            let rText = fact.role === 'Innocent' ? 'innocent' : `the ${fact.role.toLowerCase()}`;
            text = `${name} is ${rText}.`;
            fn = (a) => checkVal(a, fact.suspectId, 'Role', fact.role);
            masks = [{ varIdx: fact.suspectId, mask: roleMask }];
            break;
        }
        case FACT_TYPES.SUSPECT_NOT_ROLE: {
            const name = fmt('suspects', fact.suspectId);
            const badIndices = roles.map((r, i) => r === fact.role ? i : -1).filter(i => i !== -1);
            let badMask = 0; badIndices.forEach(i => badMask |= (1 << i));
            text = `${name} is not the ${fact.role.toLowerCase()}.`;
            fn = (a) => getVal(a, fact.suspectId, 'Role') !== fact.role;
            masks = [{ varIdx: fact.suspectId, mask: ~badMask }];
            break;
        }
        case FACT_TYPES.ROOM_ITEM: {
            const rName = fmt('rooms', fact.roomId);
            const item = fmt('items', fact.itemId);
            text = `The person in the ${rName} had the ${item}.`;
            fn = (a) => {
                 const r = IDS.filter(i => getVal(a, i, 'Room') === fact.roomId);
                 return r.length > 0 && r.some(id => checkVal(a, id, 'Item', fact.itemId));
            };
            break;
        }
        case FACT_TYPES.ROOM_EMPTY: {
            const rName = fmt('rooms', fact.roomId);
            text = `The ${rName} was empty.`;
            fn = (a) => {
                for (let i of IDS) if (getVal(a, i, 'Room') === fact.roomId) return false;
                return true;
            };
            masks = IDS.map(pid => ({ varIdx: 10 + pid, mask: ~(1 << fact.roomId) }));
            break;
        }
    }

    return { text, fn, masks, id: Math.random() };
}

export function generateClues(truth, roles, mapping) {
    const rawFacts = [
        ...generateSuspectFacts(truth, roles),
        ...generateRoomFacts(truth)
    ];

    const mergedFacts = mergeFacts(rawFacts);
    
    return mergedFacts.map(f => renderFact(f, mapping, roles));
}

export async function handleNewCase(uiCallbacks) {
    const { addLog, renderUI } = uiCallbacks;
    if (state.isGenerating) return;
    updateState({ isGenerating: true });
    addLog(`Generating Universe...`);
    
    const shuffle = (a) => { for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; };
    const getSubset = (arr, count) => shuffle([...arr]).slice(0, count);
    
    const gameMapping = {
        suspects: getSubset(state.activeScenario.suspects, 5),
        rooms: getSubset(state.activeScenario.rooms, 5),
        items: getSubset(state.activeScenario.items, 5)
    };

    const { truth, roles } = generateTruth();
    let allClues = generateClues(truth, roles, gameMapping);
    allClues = shuffle(allClues);
    addLog(`Universe: ${allClues.length} facts. Pruning...`);

    let keptClues = [...allClues];
    for (let i = keptClues.length - 1; i >= 0; i--) {
        const clue = keptClues[i];
        const testSet = keptClues.filter((_, idx) => idx !== i);
        
        const engine = new LogicEngine(roles);
        
        testSet.forEach(c => {
            engine.addConstraint(c.fn);
            if (c.masks) c.masks.forEach(m => engine.restrict(m.varIdx, m.mask));
        });

        if (i % 10 === 0) await new Promise(r => setTimeout(r, 0));

        const solutions = engine.solve(2);

        if (solutions.length === 1) {
            let essential = false;
            const req = [...gameMapping.suspects, ...gameMapping.rooms];
            for (let term of req) {
                if (clue.text.includes(term) && !testSet.some(c => c.text.includes(term))) {
                    essential = true; break;
                }
            }
            if (!essential) keptClues.splice(i, 1);
        }
    }

    updateState({
        gameMapping,
        puzzle: keptClues,
        solution: { truth, roles },
        userGuesses: {},
        isGenerating: false
    });
    
    renderUI();
    addLog(`Success. Pruned to ${keptClues.length} clues.`, 'system');
}
