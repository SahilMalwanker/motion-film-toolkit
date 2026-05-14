// Demo: every beat in the kit, on placeholder screens (see demo-screens.js). Open it with
//   http://127.0.0.1:8020/?story=examples/demo.js
// Read it next to docs/beats.md; storyboard.js is where your own film goes.
import { makeFilm, beats as B } from '../lib/kit.js';
import { all } from './demo-screens.js';

const AVERY = { role: 'Manager', name: 'Avery Cole', initials: 'AC', color: 'accent' };
const JORDAN = { role: 'Engineer', name: 'Jordan Lee', initials: 'JL', color: 'teal' };

export default makeFilm({
  brand: {
    name: 'Acme',
    tagline: 'Your product tagline goes here',
    url: 'example.com',
    line: 'Made with the motion film template.',
  },
  theme: { accent: '#8B7CF6', accent2: '#60A5FA', accent3: '#2DD4BF' },
  screens: all,
  beats: [
    // Hook, then the logo, then the product rises into view.
    B.title({ lines: ['Your product.', ['Told in', { text: 'motion.', serif: true, accent: true }]] }),
    B.logo(),
    B.rise({ screen: 'dash', headline: ['One clear view of', { text: 'everything that matters.', accent: true }] }),

    // A guided tour that ends by diving into one data point.
    B.tour({
      screen: 'dash',
      caption: ['See where everything stands.', 'Every number comes straight from your data.'],
      steps: [
        { box: 'users', say: 'Live from your data', look: 'spotlight' },
        { box: 'activity', say: 'Trends at a glance', color: 'teal' },
        { box: 'recent-item5', say: 'Problems surface early', color: 'red' },
      ],
      end: { dive: 'activity-peak' },
    }),

    // A second tour: a changing value, then a bracket arrow linking two rows.
    B.tour({
      screen: 'dash',
      enter: 'blur',
      start: 'projects',
      caption: ["Know what's slipping, and why.", 'Plans, owners and status in one table.'],
      steps: [
        { box: 'projects-row3', say: 'Blocked work stands out', color: 'red', value: { label: 'Forecast launch', from: '12 Mar', to: '30 Apr', badge: '+49 days' } },
        { box: 'projects-status1', color: 'amber', arrow: { to: 'projects-status3', style: 'bracket' }, say: 'Status at a glance', side: 'left' },
      ],
    }),

    // A chapter title over a blurred screen that sharpens; the typing beat continues on the same screen.
    B.title({ lines: [['Just', { text: 'ask.', accent: true }]], sub: 'Plain requests. The right team, at once.', over: 'compose', sparkle: true }),
    B.type({
      screen: 'compose', field: 'title', text: 'Onboarding checklist for new hires', send: 'submit', after: 'compose-done',
      caption: ['Ask in plain words.', 'Requests reach the right team at once.'], who: AVERY,
    }),

    // A phone screen: the pointer taps a list item and a button, and the next screen appears.
    B.click({
      screen: 'phone', after: 'phone-next', who: JORDAN,
      targets: [{ box: 'tasks-item2', say: 'Pick up where you left off' }, { box: 'start' }],
      caption: ['Works on the go.', 'The same data on every device.'],
    }),

    // A drawer slides over the dashboard; then two of its fields are pointed out.
    B.drawer({
      screen: 'dash', panel: 'dash-drawer', who: AVERY,
      steps: [{ box: 'progress', say: '60% complete', color: 'teal' }, { box: 'save', say: 'One click to update' }],
      caption: ['Details without losing your place.', 'Open, update, close.'],
    }),

    B.statement({ lines: ['Clear data.', 'Fast answers.', 'Better decisions.'], over: 'dash' }),

    B.grid({
      title: ['Every team,', { text: 'the right view.', accent: true }],
      sub: 'Each role sees what it needs.',
      tiles: [
        { screen: 'dash', label: 'Managers', sub: 'the big picture', color: 'accent', ring: 'top-avatar' },
        { screen: 'compose', label: 'Requesters', sub: 'quick asks', color: 'teal', ring: 'submit' },
        { screen: 'phone', label: 'Field teams', sub: 'on the go', color: 'amber', ring: 'start' },
        { screen: 'dash-drawer', label: 'Owners', sub: 'the details', color: 'pink', ring: 'drawer' },
        { screen: 'compose-done', label: 'Everyone', sub: 'kept informed', color: 'green', ring: 'toast' },
        { screen: 'phone-next', label: 'Specialists', sub: 'deep focus', color: 'silver', ring: 'clock' },
      ],
    }),

    B.wall({
      screens: ['compose', 'phone', 'dash-drawer', 'compose-done', 'phone-next', 'dash', 'phone', 'compose', 'dash-drawer', 'phone-next', 'compose-done', 'dash'],
      focus: 'dash',
      title: ['One workspace.', 'Every connection.'],
    }),

    B.end({ tagline: ['Your product. Told in', { text: 'motion.', serif: true, accent: true }] }),
  ],
});
