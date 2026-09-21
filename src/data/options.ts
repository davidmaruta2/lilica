import { CategoryOptionId, Relationship } from '../types';

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

// Corrective task: this is now the SINGLE list of canonical record
// categories, used both by the "What do you help X with?" initial-setup
// screen (InterestsScreen, filtered to onboardingEligible below) and the
// Add/category gateway (FirstThingScreen, always the complete list).
// There is deliberately no second, competing taxonomy any more -- the
// old `interestOptions`/`Interest` broad-bucket list (6 buckets that
// didn't line up 1:1 with these 8 categories, e.g. one bucket covering
// both bill and homeMatter) is retired.
export const firstItemOptions: Array<{
  id: CategoryOptionId;
  title: string;
  description: string;
  // False only for a category that doesn't belong in the initial-setup
  // picker (still fully available from Add once setup is done). Omitted
  // (undefined) means eligible -- true is never written explicitly.
  onboardingEligible?: boolean;
}> = [
  {
    id: 'appointment',
    title: 'Appointment',
    description: 'GP, hospital, dentist, therapy or another visit',
  },
  {
    id: 'task',
    title: 'Errand or activity',
    description: 'A call, errand, collection or job',
  },
  {
    id: 'bill',
    title: 'Bill or renewal',
    description: 'A payment, policy or renewal date',
  },
  {
    id: 'homeMatter',
    title: 'Home or car matter',
    description: 'A repair, service, MOT or maintenance job',
  },
  {
    id: 'document',
    title: 'Important document',
    description: 'Paperwork, letters and useful information',
  },
  {
    id: 'contact',
    title: 'Contact',
    description: 'Family, health or household contacts',
  },
  // 21 September 2026: the standalone "Care information" card (careNote)
  // was removed as a redundant duplicate entry point -- it read/wrote the
  // exact same careNote records as Medical Log's own "Care needs" section
  // below, just with weaker structure (no lifecycle, no need/preference
  // distinction, no recurrence). Medical Log is now the one home for
  // careNote records; the type itself, its editor, and its Settings-drawer
  // entry point are all unchanged, only this duplicate Add-flow card is
  // gone. Represents the dedicated Medical Log screen (care needs,
  // diagnosed conditions and prescribed medicines together) as one
  // Add-flow/setup gateway -- not a single record type of its own, so
  // 'medicalLog' is handled as a special case wherever this id is
  // consumed for record creation (see FirstThingScreen.tsx's openCategory).
  {
    id: 'medicalLog',
    title: 'Medical issues',
    description: 'Care needs, diagnosed conditions and medicines',
  },
  {
    id: 'update',
    title: 'Wellbeing update',
    description: 'A short note about what has happened',
    // A wellbeing update is an occasional in-the-moment note, not
    // something there is a meaningful "initial setup" for -- it isn't
    // offered as an initial-setup choice, but is unaffected by that and
    // remains fully available from Add like every other category.
    onboardingEligible: false,
  },
];
