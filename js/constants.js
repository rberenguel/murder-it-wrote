export const IDS = [0, 1, 2, 3, 4];
export const ROLES_DEF = ['Killer', 'Victim', 'Witness', 'Accomplice', 'Innocent'];
export const SCENARIOS = [
    {
        id: 'tng', name: 'Star Trek: TNG',
        suspects: ['Capt. Picard', 'Cmdr. Riker', 'Lt. Cmdr. Data', 'Counselor Troi', 'Lt. Worf', 'Dr. Crusher', 'Lt. Cmdr. La Forge', 'Guinan'],
        rooms: [
            { name: 'Bridge', noArticle: false },
            { name: 'Ten Forward', noArticle: true },
            { name: 'Engineering', noArticle: true },
            { name: 'Holodeck', noArticle: false },
            { name: 'Sickbay', noArticle: true },
            { name: 'Transporter Room', noArticle: false },
            { name: 'Ready Room', noArticle: false }
        ],
        roomFeatures: { 'Bridge': ['Captain\'s chair', 'tactical station'], 'Ten Forward': ['bar', 'windows'], 'Engineering': ['warp core'], 'Holodeck': ['arch'], 'Sickbay': ['biobed'], 'Transporter Room': ['pad'], 'Ready Room': ['fish tank'] },
        items: ['Type-2 Phaser', 'Bat\'leth', 'Tricorder', 'Hypospray', 'Disruptor', 'PADD']
    },
    {
        id: 'classic', name: 'Classic Mansion',
        suspects: ['Col. Mustard', 'Miss Scarlet', 'Prof. Plum', 'Mr. Green', 'Mrs. Peacock', 'Mme. Rose'],
        rooms: [
            { name: 'Kitchen', noArticle: false },
            { name: 'Ballroom', noArticle: false },
            { name: 'Conservatory', noArticle: false },
            { name: 'Library', noArticle: false },
            { name: 'Study', noArticle: false },
            { name: 'Hall', noArticle: false },
            { name: 'Lounge', noArticle: false }
        ],
        roomFeatures: { 'Kitchen': ['stove'], 'Ballroom': ['piano'], 'Conservatory': ['plants'], 'Library': ['books'], 'Study': ['fireplace'], 'Hall': ['staircase'], 'Lounge': ['sofa'] },
        items: ['Candlestick', 'Dagger', 'Lead Pipe', 'Revolver', 'Rope', 'Wrench']
    }
];
