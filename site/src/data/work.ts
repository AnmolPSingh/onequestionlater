import type { ImageMetadata } from 'astro';
import penname from '../assets/work/penname-poster.jpg';
import cohort from '../assets/work/catalyst-cohort.jpg';
import philanthropel from '../assets/work/philanthropel-site.png';
import talking from '../assets/work/talking-philanthropy-site.png';
import intelligence from '../assets/work/philanthropic-intelligence-site.png';
import dfs from '../assets/work/dfs-system.jpg';
import proposalFlow from '../assets/work/proposal-flow.png';
import gpSite from '../assets/work/gp-site.png';
import systems from '../assets/work/gp-systems.jpg';
import alumnus from '../assets/linkedin/isdi-alumnus-1.jpg';
import jivamoda from '../assets/photos/jivamoda.jpg';
import expobazaar from '../assets/photos/startup-delhi-fair-namecard.jpg';
import expobazaarLogo from '../assets/logos/expobazaar.png';
import documentAssistant from '../assets/work/cases/document-assistant.svg';
import voiceReceptionist from '../assets/work/cases/voice-receptionist.svg';
import invoiceProcessing from '../assets/work/cases/invoice-processing.svg';
import researchAssistant from '../assets/work/cases/research-assistant.svg';

export interface Release {
  slug: string;
  title: string;
  group: string;
  kind?: string;
  year?: string;
  summary: string;
  cover: ImageMetadata;
  coverAlt: string;
  stats?: [string, string][];
  links?: { label: string; href: string }[];
  /** The steps of the diagram on its slide. */
  flow?: string[];
  /** Sites shown on the slide instead of a diagram. */
  sites?: { name: string; href: string; image: ImageMetadata; alt: string; line: string }[];
  logo?: ImageMetadata;
  /** The website pages stay, but these don't get a slide of their own. */
  noSlide?: boolean;
  /** One of the four cases that lead Selected Work, each with its isometric figure as the cover. */
  featured?: boolean;
}

const GP = 'Global Philanthropic';
const SELECTED = 'Selected work';

export const RELEASES: Release[] = [
  {
    slug: 'document-assistant', title: 'AI document assistant', group: SELECTED, featured: true,
    summary: 'I built a shared place for consultants to collect project knowledge and find earlier work. A case study from ten years earlier helped win a new contract.',
    cover: documentAssistant, coverAlt: 'Notes, research, and reports enter a shared filing cabinet. The cabinet makes earlier work available to consultants.',
  },
  {
    slug: 'voice-receptionist', title: 'AI voice receptionist', group: SELECTED, featured: true,
    summary: 'I built a shared voice receptionist for a restaurant group. Callers could ask about catering and book on the same call, and the owner reported more catering bookings.',
    cover: voiceReceptionist, coverAlt: "An incoming call enters a telephone switchboard and branches to the location's front desk or to the catering owner.",
  },
  {
    slug: 'invoice-processing', title: 'AI invoice processing', group: SELECTED, featured: true,
    summary: 'I built an assistant that organised scattered invoices, flagged those that needed review, and prepared emails for an admin to approve.',
    cover: invoiceProcessing, coverAlt: 'Invoice documents pass through a scanner to an admin review desk. The email remains a draft until the admin approves it.',
  },
  {
    slug: 'research-assistant', title: 'AI research assistant', group: SELECTED, featured: true,
    summary: "I built an assistant that gathered sources on request and answered from the collected material. When I tested it with a made-up claim, it told me the sources didn't support it.",
    cover: researchAssistant, coverAlt: 'Source documents enter an evidence cabinet. A research desk answers with citations when the collected material supports the answer or reports missing evidence.',
  },
  {
    slug: 'philanthropel', title: 'Philanthropel', group: 'Philanthropel', kind: 'What I build now', year: '2026',
    summary: "AI made with the third sector, not just for it. I'm building the company with Srishti Bakshi. It's where we wield intelligence for good.",
    cover: philanthropel, coverAlt: 'The Philanthropel website, with the headline Wielding intelligence for impact.',
    flow: ['Their data', 'Agents built with them', 'Theirs to run afterwards'],
    links: [{ label: 'philanthropel.com', href: 'https://philanthropel.com' }],
  },
  {
    slug: 'penname', title: 'Penname', group: 'Philanthropel', kind: 'App for iPhone, iPad, Mac, Android and Windows', year: '2026',
    summary: 'Use AI on confidential documents without the confidential part. Penname gives every private detail a stand-in, then puts the real details back.',
    cover: penname, coverAlt: 'Penname launch frame: three documents with their private details highlighted.',
    flow: ['Confidential document', 'Every private detail gets a stand-in', 'Share the safe copy with AI', 'Real details go back'],
    stats: [['5', 'platforms'], ['0', 'things uploaded'], ['Free', 'no account, no sign-up']],
    links: [{ label: 'App Store', href: 'https://apps.apple.com/app/id6819083093' }, { label: 'Product page', href: 'https://philanthropel.com/penname' }],
  },
  {
    slug: 'catalyst', title: 'Catalyst', group: 'Philanthropel', kind: 'AI training for women leading in the third sector', year: '2026',
    summary: 'I train the Catalyst cohort: amazing women leading non-profits and impact organisations, learning to wield AI on the decisions already on their desk.',
    cover: cohort, coverAlt: 'Spotlight cards of ten women from the Catalyst cohort.',
    links: [
      { label: 'What a few sessions taught me', href: 'https://www.linkedin.com/posts/anmolps_catalyst-aiforgood-womeninleadership-activity-7513116343991312384-mKOk' },
      { label: 'Philanthropel', href: 'https://philanthropel.com' },
    ],
  },
  {
    slug: 'digital-feasibility-study', title: 'Digital Feasibility Study', group: GP, kind: 'AI donor research product', year: '2024 to now',
    summary: 'Weeks of manual consultant interviews became an agent system, and a new revenue stream for the company.',
    cover: dfs, coverAlt: 'Diagram: many donor dots feed three agent nodes, which produce one feasibility report.',
    flow: ['Many donors', 'Three agents', 'One feasibility report'],
    stats: [['£25,000', 'per engagement'], ['£175k to £200k', 'delivered so far'], ['7 to 8', 'client engagements']],
  },
  {
    slug: 'proposal-system', title: 'Proposal system', group: GP, kind: 'Multi-agent proposal product', year: '2024 to now',
    summary: 'A client-ready proposal used to take three weeks. It now takes about seven minutes.',
    cover: proposalFlow, coverAlt: 'Diagram: a client brief goes through brief analysis and drafting agents and comes out as a client-ready proposal.',
    flow: ['Client brief', 'Brief analysis', 'Drafting agents', 'Client-ready proposal'],
    stats: [['3 weeks', 'before'], ['4 days', 'first dashboard'], ['7 minutes', 'today']],
  },
  {
    slug: 'gp-website', title: 'Three websites', group: GP, kind: 'Design, build and upkeep', year: '2024 to now',
    summary: "I look after three websites for this sector: the company's own, the convening that has shaped global giving for ten years, and a place to think clearly about AI and philanthropy.",
    cover: gpSite, coverAlt: 'The Global Philanthropic website home page.',
    stats: [['35 to 95', 'UX score, company website']],
    sites: [
      { name: 'Global Philanthropic', href: 'https://globalphilanthropic.com', image: gpSite, alt: 'The Global Philanthropic website home page.', line: 'Rebuilt from the structure up.' },
      { name: 'Talking Philanthropy', href: 'https://talkingphilanthropy.com', image: talking, alt: 'The Talking Philanthropy website, announcing the Geneva Summit.', line: 'Ten years of convening, and a first Summit in Geneva.' },
      { name: 'Philanthropic Intelligence', href: 'https://philanthropicintelligence.org', image: intelligence, alt: 'The Philanthropic Intelligence website.', line: 'The questions worth sitting with before you act.' },
    ],
  },
  {
    slug: 'talking-philanthropy', title: 'Talking Philanthropy', group: GP, kind: 'Event website', year: '2026', noSlide: true,
    summary: 'I maintain the website for Talking Philanthropy, the convening that has brought together the people who shape global giving for ten years.',
    cover: talking, coverAlt: 'The Talking Philanthropy website, announcing the Geneva Summit.',
    links: [{ label: 'talkingphilanthropy.com', href: 'https://talkingphilanthropy.com' }],
  },
  {
    slug: 'philanthropic-intelligence', title: 'Philanthropic Intelligence', group: GP, kind: 'Website', year: '2026', noSlide: true,
    summary: 'I maintain the website for Philanthropic Intelligence, a place to think clearly about how AI and a fast changing world apply to the way philanthropy is funded and led.',
    cover: intelligence, coverAlt: 'The Philanthropic Intelligence website, reading: AI is changing philanthropy. The question is how you meet it.',
    links: [{ label: 'philanthropicintelligence.org', href: 'https://philanthropicintelligence.org' }],
  },
  {
    slug: 'gp-systems', title: 'Systems thinking', group: GP, kind: 'How I work, across everything I can and can\'t show', year: '2024 to now',
    summary: "Most of what I've deployed stays private, so here's what I can show you: how I think. One kind of automation makes a task faster. The other asks why the task exists.",
    cover: systems, coverAlt: 'Diagram: a tangle of boxes and lines simplifies into three clean connected steps.',
    stats: [['~35%', 'less manual work']],
    flow: ['The numbers: where most fixes stop', 'The information: who sees what, and when', 'The rules: what the work rewards', 'The goal: what it is all for'],
  },
  {
    slug: 'back-at-isdi', title: 'Back at ISDI', group: 'Talks', kind: 'Alumni lecture', year: '2026', noSlide: true,
    summary: 'A little strange being on this side of the classroom. I went back to ISDI Mumbai as an alumnus to talk about curiosity.',
    cover: alumnus, coverAlt: 'Anmol presenting at ISDI in front of a screen reading Curiosity.',
  },
  {
    slug: 'jivamoda', title: 'JivaModa', group: 'Earlier', kind: 'XR concept', year: '2024',
    summary: 'What happens to luxury fashion when scarcity is no longer about materials? An XR concept, shortlisted for the XR Awards 2025.',
    cover: jivamoda, coverAlt: 'The JivaModa XR interface, a virtual fashion store floating in space.',
    links: [{ label: 'The video presentation on LinkedIn', href: 'https://www.linkedin.com/posts/anmolps_digitalfashion-xr-sustainability-activity-7300198294364794880-_NgP' }],
  },
  {
    slug: 'expobazaar', title: 'ExpoBazaar', group: 'Earlier', kind: 'B2B dashboards', year: '2022 to 2023',
    summary: 'The only designer across five departments and three B2B platforms.',
    cover: expobazaar, coverAlt: 'A table name card reading Anmol Pratap Singh on Delhi Fair 2023 brochures.',
    stats: [['25%', 'more supplier engagement'], ['3', 'B2B platforms'], ['200+', 'global buyers']],
    logo: expobazaarLogo,
    links: [{ label: 'expobazaar.com', href: 'https://expobazaar.com' }],
  },
];
