// Your film. index.html plays this file; examples/demo.js shows every beat.
//
// Agents: follow AGENTS.md. Replace the placeholder screen below with real screens of the product
// (docs/screens.md), keep box names meaningful, and rewrite the beats from the brief (docs/beats.md).
// Every caption and callout must be true of the product.
import { makeFilm, beats as B, placeholder } from './lib/kit.js';

// A stand-in until real screens exist. A capture named 'home' with the same box names replaces it:
// delete this placeholder from `screens` and the storyboard keeps working.
const home = placeholder({
  name: 'home', theme: 'dark', accent: '#6366F1', blocks: [
    { kind: 'nav', key: 'nav', box: [0, 0, 248, 1080], title: 'Product', items: ['Home', 'Projects', 'Reports', 'Settings'] },
    { kind: 'topbar', key: 'top', box: [248, 0, 1672, 76], title: 'Home', action: 'Create' },
    { kind: 'stat', key: 'metric', box: [280, 108, 520, 160], title: 'Key metric', value: '1,234', delta: '+5%' },
    { kind: 'chart', key: 'trend', box: [824, 108, 1064, 420], title: 'Trend' },
    { kind: 'list', key: 'feed', box: [280, 292, 520, 420], title: 'Latest', items: 5 },
    { kind: 'table', key: 'table', box: [280, 736, 1608, 320], title: 'Items', rows: 3 },
  ],
});

export default makeFilm({
  brand: { name: 'Product', tagline: 'One line about what it does', url: 'example.com' },
  theme: { accent: '#60A5FA', accent2: '#818CF8', accent3: '#2DD4BF' },
  screens: [home],
  beats: [
    B.title({ lines: ['Say what it does.', ['In', { text: 'one line.', serif: true, accent: true }]] }),
    B.logo(),
    B.rise({ screen: 'home', headline: 'The first screen people see' }),
    B.tour({
      screen: 'home',
      caption: ['One idea per beat.', 'Every caption must be true of the product.'],
      steps: [
        { box: 'metric', say: 'Point at what matters' },
        { box: 'trend', say: 'Then the next thing', color: 'teal' },
      ],
    }),
    B.end(),
  ],
});
