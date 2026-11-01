import type { ImageMetadata } from 'astro';
import wizkids from '../assets/photos/life-wizkids.jpg';
import batch from '../assets/photos/music-audio-engineering-batch.jpg';
import raasta from '../assets/photos/music-dj-delhi-raasta-2014.jpg';
import decks from '../assets/photos/music-dj-festival.jpg';
import corridor from '../assets/photos/life-air-corridor.jpg';
import film from '../assets/photos/film-dd-bbc.jpg';
import zilch from '../assets/photos/life-zilch.jpg';
import believe from '../assets/logos/believe-red.png';
import fusion from '../assets/photos/life-fusion-finds.jpg';
import amla from '../assets/photos/life-zilch-amla.jpg';
import studio from '../assets/photos/life-amity-studio.jpg';
import saudi from '../assets/photos/life-mice-saudi.jpg';
import firstJob from '../assets/photos/life-first-job.jpg';
import script from '../assets/photos/life-script-app.jpg';
import foreign from '../assets/photos/startup-design-for-foreign-markets.jpg';
import sketches from '../assets/photos/isdi-sketch-wall.jpg';
import lathe from '../assets/photos/life-lathe.jpg';
import designThinking from '../assets/photos/life-design-thinking.jpg';
import jury from '../assets/linkedin/capstone-0.jpg';
import london from '../assets/photos/life-london.jpg';
import graduation from '../assets/photos/life-graduation.jpg';
import hololens from '../assets/photos/isdi-hololens.jpg';
import xrGuild from '../assets/linkedin/xr-guild-0.jpg';
import podcast from '../assets/photos/life-podcast.jpg';
import talking from '../assets/photos/life-talking-london.jpg';
import agents from '../assets/photos/life-agents.jpg';
import cohort from '../assets/photos/life-cohort.jpg';
import lecture from '../assets/photos/life-lecture.jpg';

export const TRACKS = {
  music: 'Music',
  radio: 'Radio',
  film: 'Film',
  stage: 'Stage',
  graphic: 'Graphic',
  ux: 'UX',
  xr: 'XR',
  ai: 'AI',
} as const;

export type TrackId = keyof typeof TRACKS;

export interface Milestone {
  id: string;
  track: TrackId;
  /** Decimal years. They run longer than the job or the event, so clips overlap and the arrangement never goes quiet. */
  from: number;
  to: number;
  date: string;
  title: string;
  line: string;
  photo?: ImageMetadata;
  alt?: string;
  /** A smaller second picture, arriving just after the first. */
  also?: ImageMetadata;
  alsoAlt?: string;
  /** Which side of the first it sits, left unless stated. */
  alsoSide?: 'left' | 'right';
  /** The share of its width that sits behind the first. With none, they stand apart. */
  alsoOverlap?: number;
  /** Always this track row, for the long clips that have to read as running side by side. */
  lane?: number;
  /** On the tracks and in the reading view, but it doesn't get its own stop in the fly-through. */
  quiet?: boolean;
  /** Left off the tracks. */
  noClip?: boolean;
}

export const END = 2028;

// My life, not my current projects: those are the Releases. Decimal years only place things.
export const MILESTONES: Milestone[] = ([
  { id: 'wizkids', track: 'stage', from: 2009, to: 2013.2, date: 'As a kid', title: 'Horlicks WizKids', line: 'It all started here, on a stage, with my hands in the air.', photo: wizkids, alt: 'Me as a kid on stage at Horlicks WizKids, both arms up.' },
  { id: 'audio', track: 'music', from: 2013.2, to: 2014.2, date: 'Before 2014', title: 'Audio engineering', line: 'Before design, there was music. I studied audio engineering and digital music production, as hooked on the software as I was on the sound.', photo: batch, alt: 'My audio engineering batch standing together, holding up a framed disc.' },
  { id: 'gigs', track: 'music', from: 2014, to: 2020.6, date: 'From 2014', title: 'Delhi Raasta, gigs and festivals', line: 'My first gigs, at Delhi Raasta in 2014, and then a lot of festivals. Gigs needed posters, so I learned Photoshop from YouTube.', photo: decks, alt: 'Me in dark glasses at a festival, in front of glowing neon wings.', also: raasta, alsoAlt: 'Me laughing behind the decks at Delhi Raasta in 2014, in black and white.' },
  { id: 'amity', track: 'film', from: 2015.2, to: 2018.3, date: '2015 to 2018', title: 'Journalism at Amity', line: 'Exploring the other horizons of media, from a studio floor. I learned Premiere from YouTube, and my public service short won first prize. It taught me to start with what I need to understand, not what I want to say.', photo: studio, alt: 'A studio audience on tiered seats at Amity, seen past a broadcast camera, with me in the second row.' },
  { id: 'air', track: 'radio', from: 2016.4, to: 2018.4, date: 'During college', title: 'All India Radio, Doordarshan and BBC India', line: "On-call at All India Radio while I was still in college, walking these corridors with my backpack on. A listener can't see you, so every word has to earn its place. Then came newsrooms, and a short film with Doordarshan and BBC India.", photo: corridor, alt: 'A selfie with my backpack on, in a corridor at All India Radio.', also: film, alsoAlt: 'Me holding a camera on a stabiliser, in red light.' },
  { id: 'mice', track: 'stage', from: 2016.6, to: 2018.4, date: 'During college', title: 'National and international MICE events', line: 'Through college I worked the big trade floors and conferences, in India and abroad.', photo: saudi, alt: 'Me in a lanyard beside a giant pink LED screen reading Welcome to Arabia.' },
  { id: 'clinic', track: 'graphic', from: 2018.35, to: 2019.9, date: 'May 2018', title: 'Junior graphic designer', line: 'My first job, for a non-profit. It was a good start, but I needed to pay the bills.', photo: firstJob, alt: 'A selfie with a room full of school children in pink uniforms, all waving at the camera.' },
  { id: 'zilch', track: 'graphic', from: 2019.9, to: 2020.7, date: 'Dec 2019 to Aug 2020', title: 'Video and graphics at Zilch', line: 'Product and lifestyle films, and ad artwork built to break the clutter.', photo: zilch, alt: 'Zilch Cosmetics serum bottles and boxes laid out on white.', also: amla, alsoAlt: 'A Zilch shampoo ad: a face whose hair is made of paper-cut amla and leaves, reading Bottled with Amla.' },
  { id: 'believe', track: 'music', from: 2020.8, to: END, date: 'Late 2020', title: 'Believe digital artist', line: "My first break. Bairaniya, from Nyun, went out through Believe and landed at the top of Spotify's Fusion Finds.", photo: fusion, alt: "Spotify's Fusion Finds playlist with Bairaniya by Nyun as its first track.", also: believe, alsoAlt: 'The Believe logo.', lane: 1 },
  { id: 'freelance', track: 'ux', from: 2021.4, to: 2024.3, date: 'Jun 2021 to Apr 2024', title: 'Freelance UX', line: "A client said: you're good at Photoshop, can you design the screens for my app? I had no background in UX. So naturally, I said yes.", photo: script, alt: 'Eleven screens of Script, a parenting app I designed, laid out on a pink background.' },
  { id: 'expobazaar', track: 'ux', from: 2022.25, to: 2023.6, date: 'Apr 2022 to Jul 2023', title: 'ExpoBazaar', line: 'The only designer, across five departments, onboarding artisans from across India to sell to the world.', photo: foreign, alt: 'A boardroom talk, with a slide reading How to design for foreign markets?' },
  { id: 'isdi', track: 'xr', from: 2023.6, to: 2024.6, date: 'Aug 2023 to Aug 2024', title: 'ISDI, Mumbai', line: "A postgraduate diploma in Design and Innovation. For that year, college and life were the same thing, and I think that's why it worked.", photo: sketches, alt: 'Me in front of a wall covered in product sketches, laughing, with a lanyard on.' },
  { id: 'lathe', track: 'xr', from: 2023.8, to: 2024.3, date: 'At ISDI', title: 'The makers lab', line: "I've loved woodwork since I was a kid, so a lathe at design school was less a module, more a relapse.", photo: lathe, alt: 'Me shaping a piece of wood on a lathe.', also: designThinking, alsoAlt: 'Presenting our design thinking project, with a model on the table and the title on a green screen.', alsoSide: 'right', alsoOverlap: 0.42 },
  { id: 'gp', track: 'ai', from: 2024.3, to: END, date: 'From Apr 2024', title: 'Global Philanthropic', line: "I joined as the designer, then kept running into problems that design alone couldn't solve.", photo: london, alt: 'Me on a terrace with the City of London skyline behind.', lane: 0 },
  { id: 'graduation', track: 'stage', from: 2024.2, to: 2024.3, date: '2024', title: 'Graduation and final jury', line: "My capstone on digitisation in philanthropy, the best day I had there. It's not about perfection, it's about continuous learning.", photo: graduation, alt: 'Me in a yellow graduation gown and cap, holding my scroll.', also: jury, alsoAlt: 'Presenting my capstone to the final jury in a classroom.' },
  { id: 'goldsmiths', track: 'xr', from: 2024.9, to: 2025.1, date: 'Dec 2024', title: 'Online VR specialisation, Goldsmiths', line: 'Completed the online Virtual Reality Specialisation from Goldsmiths, University of London.', photo: hololens, alt: 'Me trying a HoloLens headset at a stand.' },
  { id: 'xr-guild', track: 'xr', from: 2025.1, to: 2025.7, date: 'Feb 2025 to now', title: 'XR Guild', line: 'Member and mentee, mentored by Jay Van Buren, co-founder and CEO of Membit.', photo: xrGuild, alt: 'XR Guild membership announcement.' },
  { id: 'podcast', track: 'radio', from: 2024.4, to: END, date: 'Alongside it all', title: 'Back behind a mic', line: 'Years after All India Radio, running a podcast from a room in my studio while the day job kept growing.', photo: podcast, alt: 'Me in an armchair in a yellow podcast studio, talking, with a mic hanging in front of me.', lane: 2 },
  { id: 'talking', track: 'stage', from: 2026.34, to: 2026.6, date: 'May 2026', title: 'Talking Philanthropy London', line: "I'm the one clipping the mic on the CEO, in a room full of people talking about where the sector goes next.", photo: talking, alt: 'Me clipping a microphone onto a CEO in a chandeliered room at Talking Philanthropy London.' },
  { id: 'agents', track: 'ai', from: 2026.6, to: 2026.8, date: '2026', title: 'An agent army', line: "My head has always run on everything at once, so I built a desk that does too: three laptops, each on its own Claude session, with twenty-seven agents looping in the background. Every screen is a different client and a different job. I'm not a developer. I think in systems, and the agents do the building.", photo: agents, alt: 'Three laptops, a monitor and a tablet running on one desk.' },
  { id: 'cohort', track: 'stage', from: 2026.75, to: 2026.82, date: 'Oct 2026', title: 'Back at ISDI', line: "All of that brought me back to ISDI as an alumnus guest lecturer, and it's a little strange on this side of the classroom.", photo: cohort, alt: 'Me kneeling in front of the ISDI cohort in a classroom.' },
  { id: 'lecture', track: 'stage', from: 2026.82, to: END, date: 'Oct 2026', title: 'One word on the screen', line: 'I went back to talk about curiosity. It was always going to be that word.', photo: lecture, alt: 'Me giving the alumni lecture in front of a screen reading Curiosity.' },
  { id: 'next', track: 'ai', from: 2027, to: END, date: 'Next', title: 'What comes next', line: "I don't know yet. That's the part I like.", quiet: true, noClip: true },
] as Milestone[]).sort((a, b) => a.from - b.from);
