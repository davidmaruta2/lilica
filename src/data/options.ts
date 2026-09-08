import { FirstItemType, Interest, Relationship } from '../types';

export const relationships: Relationship[] = [
  'Mum',
  'Dad',
  'Partner',
  'Child',
  'Grandparent',
  'Other relative',
  'Someone else',
];

export const interestOptions: Array<{
  id: Interest;
  title: string;
  description: string;
}> = [
  {
    id: 'appointments',
    title: 'Appointments & visits',
    description: 'Appointments and visits.',
  },
  {
    id: 'homeBills',
    title: 'Home & bills',
    description: 'Bills, repairs and renewals.',
  },
  {
    id: 'tasks',
    title: 'Everyday things to sort',
    description: 'Calls, shopping, forms and errands.',
  },
  {
    id: 'paperwork',
    title: 'Important paperwork',
    description: 'Letters and useful documents.',
  },
  {
    id: 'familyHelp',
    title: 'Keeping family updated',
    description: "Updates and who's doing what.",
  },
  {
    id: 'careInfo',
    title: 'Care & routines',
    description: 'Care visits, routines and notes.',
  },
];

export const firstItemOptions: Array<{
  id: FirstItemType;
  title: string;
  description: string;
  interest?: Interest;
}> = [
  {
    id: 'appointment',
    title: 'Add an appointment',
    description: 'Add a date and time.',
    interest: 'appointments',
  },
  {
    id: 'bill',
    title: 'Add a bill or renewal',
    description: 'Keep track of when it is due.',
    interest: 'homeBills',
  },
  {
    id: 'task',
    title: 'Add something to do',
    description: 'A call, errand or job.',
    interest: 'tasks',
  },
  {
    id: 'document',
    title: 'Add a document',
    description: 'Keep its name and details handy.',
    interest: 'paperwork',
  },
  {
    id: 'careNote',
    title: 'Add care information',
    description: 'Keep a useful note.',
    interest: 'careInfo',
  },
];
