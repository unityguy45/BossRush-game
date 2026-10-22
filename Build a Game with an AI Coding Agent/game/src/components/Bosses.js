import { Golem } from './bosses/Golem.js';
import { Eye } from './bosses/Eye.js';
import { Queen } from './bosses/Queen.js';
import { Serpent } from './bosses/Serpent.js';

export const BOSSES = [
  {
    name: 'KILNHEART',
    title: 'The Magma Colossus',
    color: 0xff6a1a,
    hp: 300,
    speed: 55,
    rest: 0.9,
    make: (ctx, def) => new Golem(ctx, def),
    actions: ['slam', 'magmaBurst', 'slam', 'meteors', 'quake'],
    rage: ['slam', 'meteors', 'quake', 'magmaBurst', 'slam', 'quake'],
  },
  {
    name: 'OCULUS',
    title: 'The Storm Eye',
    color: 0x9b5cff,
    hp: 260,
    speed: 160,
    rest: 0.8,
    make: (ctx, def) => new Eye(ctx, def),
    actions: ['spiral', 'laser', 'shards', 'blink', 'storm'],
    rage: ['laser', 'storm', 'spiral', 'blink', 'shards', 'laser'],
  },
  {
    name: 'REGINA APIS',
    title: 'The Hive Queen',
    color: 0xffc21a,
    hp: 280,
    speed: 150,
    rest: 0.7,
    make: (ctx, def) => new Queen(ctx, def),
    actions: ['charge', 'stingers', 'swarm', 'honey', 'charge'],
    rage: ['charge', 'honey', 'swarm', 'stingers', 'charge'],
  },
  {
    name: 'NIDHOGG',
    title: 'The Void Serpent',
    color: 0xff2a8a,
    hp: 340,
    speed: 270,
    rest: 0.6,
    make: (ctx, def) => new Serpent(ctx, def),
    actions: ['barrage', 'dive', 'breath', 'orbs', 'barrage'],
    rage: ['dive', 'barrage', 'breath', 'dive', 'orbs'],
  },
];
