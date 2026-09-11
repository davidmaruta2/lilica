import { Interest, LilicaRecordType, Relationship } from '../types';

export const relationships: Relationship[] = [
  'Myself',
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
    title: 'Home, car & bills',
    description: 'Bills, repairs, servicing and renewals.',
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
  id: LilicaRecordType;
  title: string;
  description: string;
  interest?: Interest;
}> = [
  {
    id: 'appointment',
    title: 'Appointment',
    description: 'GP, hospital, dentist, therapy or another visit',
    interest: 'appointments',
  },
  {
    id: 'task',
    title: 'Something to do',
    description: 'A call, errand, collection or job',
    interest: 'tasks',
  },
  {
    id: 'bill',
    title: 'Bill or renewal',
    description: 'A payment, policy or renewal date',
    interest: 'homeBills',
  },
  {
    id: 'homeMatter',
    title: 'Home or car matter',
    description: 'A repair, service, MOT or maintenance job',
    interest: 'homeBills',
  },
  {
    id: 'document',
    title: 'Important document',
    description: 'Paperwork, letters and useful information',
    interest: 'paperwork',
  },
  {
    id: 'contact',
    title: 'Contact',
    description: 'Family, health or household contacts',
    interest: 'familyHelp',
  },
  {
    id: 'careNote',
    title: 'Care information',
    description: 'Medication, visits, routines or useful notes',
    interest: 'careInfo',
  },
  {
    id: 'update',
    title: 'Wellbeing update',
    description: 'A short note about what has happened',
    interest: 'familyHelp',
  },
];
