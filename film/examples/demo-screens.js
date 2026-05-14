// Placeholder screens for the demo film: a desktop dashboard (dark), a form (light), a side drawer and a
// phone app (portrait, 3x). They stand in for real captures. A real capture that names the same boxes can
// replace any of them without touching the storyboard.
import { placeholder } from '../lib/kit.js';

const ACCENT = '#7C5CFC';
const NAV = ['Overview', 'Projects', 'Inbox', 'Reports', 'Team', 'Settings'];

const dashBlocks = [
  { kind: 'nav', key: 'nav', box: [0, 0, 248, 1080], title: 'Acme', items: NAV },
  { kind: 'topbar', key: 'top', box: [248, 0, 1672, 76], title: 'Overview', action: 'New project', avatar: 'AC' },
  { kind: 'stat', key: 'users', box: [280, 108, 384, 140], title: 'Active users', value: '12,480', delta: '+8.2%' },
  { kind: 'stat', key: 'revenue', box: [688, 108, 384, 140], title: 'Revenue', value: '$84.2k', delta: '+12%' },
  { kind: 'stat', key: 'conversion', box: [1096, 108, 384, 140], title: 'Conversion', value: '3.9%', delta: '-0.4%', tone: 'red' },
  { kind: 'stat', key: 'tickets', box: [1504, 108, 384, 140], title: 'Open tickets', value: '128', delta: '-14 this week' },
  { kind: 'chart', key: 'activity', box: [280, 272, 1000, 400], title: 'Weekly activity' },
  {
    kind: 'list', key: 'recent', box: [1304, 272, 584, 400], title: 'Recent activity', items: [
      { title: 'Avery Cole', sub: 'Closed 3 tickets', chip: 'Done', tone: 'green' },
      { title: 'Jordan Lee', sub: 'Shipped version 2.4', chip: 'Release', tone: 'indigo' },
      { title: 'Sam Rivera', sub: 'Updated the pricing page' },
      { title: 'Riley Chen', sub: 'Invited 4 teammates', chip: 'Team', tone: 'teal' },
      { title: 'Morgan Blake', sub: 'Flagged a payment issue', chip: 'Urgent', tone: 'red' },
    ],
  },
  { kind: 'table', key: 'projects', box: [280, 696, 1608, 360], title: 'Projects', columns: ['Project', 'Owner', 'Due', 'Status'], rows: 4, status: ['Done', 'In progress', 'Blocked', 'Review'] },
];

export const dash = placeholder({ name: 'dash', theme: 'dark', accent: ACCENT, blocks: dashBlocks });

// The same page with a details drawer open; the drawer beat slides it in over `dash`.
export const dashDrawer = placeholder({
  name: 'dash-drawer', theme: 'dark', accent: ACCENT, blocks: [
    ...dashBlocks.map(({ key, ...rest }) => rest),
    { kind: 'scrim', alpha: 0.6 },
    { kind: 'drawer', key: 'drawer', box: [1440, 0, 480, 1080], title: 'Project details' },
    { kind: 'text', key: 'project', box: [1468, 84, 420, 30], text: 'Website relaunch', size: 22 },
    { kind: 'chip', key: 'status', box: [1468, 128], text: 'In progress', tone: 'blue' },
    { kind: 'progress', key: 'progress', box: [1468, 204, 424, 12], value: 0.6, title: 'Progress' },
    { kind: 'list', key: 'tasks', box: [1456, 244, 448, 330], title: 'Tasks', items: 4 },
    { kind: 'input', key: 'comment', box: [1468, 640, 424, 96], label: 'Comment', placeholder: 'Add a note for the team' },
    { kind: 'button', key: 'save', box: [1728, 1000, 164, 48], text: 'Save changes' },
  ],
});

const composeBlocks = (filled = false) => [
  { kind: 'nav', box: [0, 0, 248, 1080], title: 'Acme', items: NAV, active: 2 },
  { kind: 'topbar', key: 'top', box: [248, 0, 1672, 76], title: 'New request', avatar: 'AC' },
  { kind: 'card', key: 'form', box: [280, 108, 1000, 640], title: 'Request', lines: 0 },
  { kind: 'input', key: 'title', box: [312, 196, 936, 48], label: 'Title', placeholder: 'Give it a short title', value: filled ? 'Onboarding checklist for new hires' : '' },
  { kind: 'input', key: 'details', box: [312, 288, 936, 220], label: 'Details', placeholder: 'Describe what you need' },
  { kind: 'chip', key: 'priority', box: [312, 540], text: 'Normal priority', tone: 'slate' },
  { kind: 'button', key: 'submit', box: [1060, 676, 188, 48], text: 'Submit request' },
  { kind: 'card', key: 'tips', box: [1304, 108, 584, 300], title: 'Good requests' },
];

export const compose = placeholder({ name: 'compose', theme: 'light', accent: ACCENT, blocks: composeBlocks(false) });
export const composeDone = placeholder({
  name: 'compose-done', theme: 'light', accent: ACCENT, blocks: [
    ...composeBlocks(true),
    { kind: 'toast', key: 'toast', box: [1304, 432, 584, 64], text: 'Request submitted to the operations team' },
  ],
});

// A phone app: portrait, rounded like a device, painted at 3x.
const phoneTop = [
  { kind: 'text', key: 'greeting', box: [24, 56, 320, 40], text: 'Good morning', size: 28 },
  { kind: 'text', box: [24, 98, 320, 22], text: 'Tuesday, 14 May', size: 14, weight: 500, color: 'muted' },
];
export const phone = placeholder({
  name: 'phone', width: 390, height: 844, scale: 3, radius: 44, theme: 'light', accent: ACCENT, blocks: [
    ...phoneTop,
    { kind: 'stat', key: 'focus', box: [24, 140, 342, 150], title: "Today's focus", value: '3 tasks', delta: 'On track' },
    { kind: 'list', key: 'tasks', box: [24, 310, 342, 312], title: 'Up next', items: 4 },
    { kind: 'button', key: 'start', box: [24, 650, 342, 52], text: 'Start session' },
    { kind: 'tabs', key: 'tabs', box: [0, 760, 390, 84] },
  ],
});
export const phoneNext = placeholder({
  name: 'phone-next', width: 390, height: 844, scale: 3, radius: 44, theme: 'light', accent: ACCENT, blocks: [
    ...phoneTop,
    { kind: 'stat', key: 'clock', box: [24, 140, 342, 150], title: 'Time left', value: '18:24', delta: 'Focus session' },
    { kind: 'progress', key: 'timer', box: [24, 326, 342, 12], value: 0.35, title: 'Session' },
    { kind: 'list', key: 'tasks', box: [24, 362, 342, 248], title: 'In this session', items: 3 },
    { kind: 'button', key: 'pause', box: [24, 650, 342, 52], text: 'Pause', primary: false },
    { kind: 'tabs', key: 'tabs', box: [0, 760, 390, 84] },
  ],
});

export const all = [dash, dashDrawer, compose, composeDone, phone, phoneNext];
