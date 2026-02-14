export const IDS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
export const ROLES_DEF = ['Killer', 'Victim', 'Witness', 'Accomplice', 'Innocent'];
export const SCENARIOS = [
    {
        id: 'tng', name: 'Star Trek: TNG',
        suspects: ['Capt. Picard', 'Cmdr. Riker', 'Lt. Cmdr. Data', 'Counselor Troi', 'Lt. Worf', 'Dr. Crusher', 'Lt. Cmdr. La Forge', 'Guinan', 'Lt. Barclay', 'Chief O\'Brien', 'Q', 'Ro Laren', 'Tasha Yar'],
        rooms: [
            { name: 'Bridge', noArticle: false },
            { name: 'Ten Forward', noArticle: true },
            { name: 'Engineering', noArticle: true },
            { name: 'Holodeck', noArticle: false },
            { name: 'Sickbay', noArticle: true },
            { name: 'Transporter Room', noArticle: false },
            { name: 'Ready Room', noArticle: false },
            { name: 'Science Lab', noArticle: false },
            { name: 'Shuttlebay', noArticle: false },
            { name: 'Observation Lounge', noArticle: false },
            { name: 'Cargo Bay', noArticle: false }
        ],
        roomFeatures: { 
            'Bridge': ['Captain\'s chair', 'tactical station'], 
            'Ten Forward': ['bar', 'large windows'], 
            'Engineering': ['warp core', 'isolinear racks'], 
            'Holodeck': ['arch', 'yellow grid'], 
            'Sickbay': ['biobed', 'medical scanner'], 
            'Transporter Room': ['pad', 'control console'], 
            'Ready Room': ['fish tank', 'desk'],
            'Science Lab': ['microscopes', 'sensors'],
            'Shuttlebay': ['shuttlecraft', 'launch pad'],
            'Observation Lounge': ['model ships', 'long table'],
            'Cargo Bay': ['containers', 'anti-grav sled']
        },
        items: ['Type-2 Phaser', 'Bat\'leth', 'Tricorder', 'Hypospray', 'Disruptor', 'PADD', 'Horga\'hn', 'Ressikan Flute', 'Self-Sealing Stem Bolt', 'Isolinear Chip', 'Klingon Dagger']
    },
    {
        id: 'classic', name: 'Classic Mansion',
        suspects: ['Col. Mustard', 'Miss Scarlet', 'Prof. Plum', 'Mr. Green', 'Mrs. Peacock', 'Mme. Rose', 'Sgt. Gray', 'Miss Peach', 'Mrs. White', 'Capt. Brown'],
        rooms: [
            { name: 'Kitchen', noArticle: false },
            { name: 'Ballroom', noArticle: false },
            { name: 'Conservatory', noArticle: false },
            { name: 'Library', noArticle: false },
            { name: 'Study', noArticle: false },
            { name: 'Hall', noArticle: false },
            { name: 'Lounge', noArticle: false },
            { name: 'Dining Room', noArticle: false },
            { name: 'Billiard Room', noArticle: false },
            { name: 'Cellar', noArticle: false },
            { name: 'Attic', noArticle: false }
        ],
        roomFeatures: { 
            'Kitchen': ['stove', 'pantry'], 
            'Ballroom': ['piano', 'chandelier'], 
            'Conservatory': ['exotic plants'], 
            'Library': ['bookshelves', 'ladder'], 
            'Study': ['fireplace', 'safe'], 
            'Hall': ['staircase'], 
            'Lounge': ['sofa', 'gramophone'],
            'Dining Room': ['silverware', 'large table'],
            'Billiard Room': ['pool table', 'cue rack'],
            'Cellar': ['wine barrels'],
            'Attic': ['old trunks', 'dusty mirrors']
        },
        items: ['Candlestick', 'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench', 'Poison', 'Horseshoe', 'Trophy', 'Poker', 'Axe']
    },
    {
        id: 'medieval', name: 'Medieval Mystery',
        suspects: ['Sir Alistair', 'Lady Eleanor', 'The Friar', 'The Minstrel', 'The Blacksmith', 'Princess Isabella', 'The Jester', 'The Alchemist', 'The Squire', 'The Abbess', 'The Huntsman', 'The Herbalist', 'The Knight'],
        rooms: [
            { name: 'Throne Room', noArticle: false },
            { name: 'Great Hall', noArticle: false },
            { name: 'Dungeon', noArticle: false },
            { name: 'Armory', noArticle: false },
            { name: 'Chapel', noArticle: false },
            { name: 'Stable', noArticle: false },
            { name: 'Tower', noArticle: false },
            { name: 'Courtyard', noArticle: false },
            { name: 'Barracks', noArticle: false },
            { name: 'Gatehouse', noArticle: false }
        ],
        roomFeatures: { 
            'Throne Room': ['throne', 'banners'], 
            'Great Hall': ['long table', 'hearth'], 
            'Dungeon': ['chains', 'straw'], 
            'Armory': ['shield rack', 'swords'], 
            'Chapel': ['altar', 'stained glass'], 
            'Stable': ['hay', 'stalls'], 
            'Tower': ['spiral stairs', 'arrow slit'],
            'Courtyard': ['well', 'target dummies'],
            'Barracks': ['bunks', 'armor stands'],
            'Gatehouse': ['portcullis', 'winch']
        },
        items: ['Broadsword', 'Chalice', 'Crossbow', 'Poison Ring', 'Mace', 'Scroll', 'Morning Star', 'Mandragora', 'Gauntlet', 'Dagger', 'Poisoned Wine']
    }
];

export const CONFIG = {
    // 85% for classic, the rest shared among others
    classicWeight: 0.85
};
