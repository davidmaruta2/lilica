# Lilica Project Brief

## Product

Lilica is a personal and family care organiser for Luxford Interactive.

It helps one organiser keep the everyday life, care, information and responsibilities of another person in one calm place. The supported person may be an ageing parent, a disabled child, a partner, a grandparent, another relative or someone else the organiser supports.

Lilica is not primarily a medical app, eMAR system, care-home management product, surveillance product, emergency monitor, fall-detection app, elderly companion chatbot or generic family calendar.

The core problem is:

> I am the person carrying all of this in my head.

Lilica should help the organiser answer:

- What is happening?
- What is coming up?
- What needs sorting?
- Who is dealing with something?
- Where is the important information?
- What has changed?
- What has already been confirmed?

One user must be able to get value alone. The supported person, wider family and professional carers must not be required to join before Lilica is useful.

## Current Phase

Only Phase 1 is in scope.

Phase 1 should deliver:

- Product foundation
- Core visual system
- Navigation shell
- Welcome
- How Lilica works
- Create account / log in
- Relationship selection
- Supported person's name
- Privacy and consent
- What the organiser helps with
- Add first thing
- Minimal first-item creation
- First-arrival Home
- Onboarding persistence and resume behaviour

Do not build Phase 2 features without explicit approval.

Out of scope for Phase 1:

- Production AI
- Bank integrations
- Payment initiation
- Fall detection
- Emergency monitoring
- Complex care-provider systems
- eMAR
- Medical diagnosis
- Subscriptions or paywalls
- Complex family permissions
- Provider integrations
- Full document OCR pipeline

## Approved Onboarding Flow

The approved Phase 1 flow is:

1. Welcome
2. How Lilica works
3. Create account / log in
4. Who are you helping?
5. What's their name?
6. Privacy and consent
7. What do you help with?
8. Add your first thing
9. First-item creation
10. Home

The flow must be page-by-page, deliberate and calm.

Do not add:

- Onboarding carousels
- Profile completion percentages
- Detailed medical profiles
- Medication-first onboarding
- Fake records
- Feature-directory dashboards

The onboarding success event is that the user gets one real thing organised.

## Approved Product Copy

### Welcome

Headline:

> Helping the people you love stay independent and age well, with the family organised around them.

Supporting text:

> Keep appointments, care, household matters, important paperwork and everyday to-dos organised for someone you care about.

Primary button:

> Get started

Secondary action:

> Already use Lilica? Log in

The headline is long. It must be solved through excellent typography and composition, not by making it look like a dense paragraph or by allowing it to dominate the screen.

### How Lilica Works

Headline:

> One place to organise the care and everyday life of someone you support.

Body copy:

> Keep track of their appointments, medication information, important documents, bills and things that need doing.
>
> Keep their home maintained.
>
> Share updates and responsibilities with family or other helpers, so everyone knows what's happening and what still needs sorting.

Reassurance:

> You can start on your own and invite others later.

Primary button:

> Continue

The latest user feedback is that this screen should clearly outline the explanation in numbered form and then move into Yuka-style CTA questions.

### Create Account / Log In

Heading:

> Create your account

Supporting text:

> Keep everything together and pick up where you left off.

Actions:

- Continue with Apple
- Continue with Google
- Continue with email
- Log in

Do not request camera, contacts, notifications or photo permissions here.

### Who Are You Helping?

Headline:

> Who are you helping?

Supporting text:

> Let's set up a space for someone you care about.

Options:

- Mum
- Dad
- Partner
- Child
- Grandparent
- Other relative
- Someone else

Relationship selection is for personalisation and must not restrict functionality.

### Their Name

Headline:

> What's their name?

Supporting text:

> We'll use their name to make everything easier to find.

Field:

> First or preferred name

Do not require surname, age, date of birth, address, diagnosis, NHS number, medication, emergency contacts or medical history.

### Privacy and Consent

Headline:

> Respecting their privacy

Body copy:

> Lilica may contain personal and sensitive information about someone you support. Only add information you are entitled to access, store and share.
>
> Where the person can make their own decisions, involve them and respect their wishes. If you are acting for a child or someone who cannot make a particular decision, make sure you have the appropriate authority to do so.

Declaration:

> I understand that I must have an appropriate basis for adding and sharing this person's information, and that I am responsible for respecting their privacy.

The checkbox must be actively selected before Continue is enabled.

Store declaration version and acceptance timestamp. Do not store a false claim that the supported person personally consented.

Privacy Policy and Terms links should only be shown when real documents or URLs exist. Do not invent policy URLs.

### What Do You Help With?

Headline:

> What do you help [Name] with?

Supporting text:

> Choose anything that feels familiar. You can change this later.

Multiple-selection options:

- Appointments & visits - Doctor, hospital, school, therapy or other appointments.
- Everyday things to sort - Calls, prescriptions, shopping, forms and errands.
- Care & routines - Medication information, care visits and useful notes.
- Home & bills - Utilities, insurance, repairs and renewals.
- Important paperwork - Letters, documents and useful information.
- Keeping family updated - Sharing what's happening and who's doing what.

Secondary action:

> Skip for now

Selections influence what is shown first but must not permanently hide functionality.

### Add Your First Thing

Headline:

> Let's get one thing sorted.

Supporting text:

> What would be useful to add for [Name] right now?

Actions:

- Add an appointment
- Add something to do
- Add a bill or renewal
- Add a document
- Add care information, when relevant

Secondary action:

> I'll do this later

Skipping must be allowed. Do not create fake sample records.

### First-Item Creation

Keep first-item flows short.

Appointment required fields:

- What's it for?
- When?

Optional appointment details:

- Location
- Who's taking them
- Notes
- Reminder

Use progressive disclosure. Do not show every optional field at once.

Success state:

> Sorted.
>
> [Name]'s appointment is now in Lilica.

Saved records must be real and visible on Home.

## Home Requirements

Home must immediately make clear what Lilica is for, but it must not look like a paragraph-heavy marketing page.

First-arrival headline:

> Everything for [Name], in one place.

Approved supporting idea:

> Keep their appointments, care, important information and everyday things organised and keep everyone involved on the same page.

The current implementation presents this too much like large paragraph text. The next revision should convert this into a more compact, useful information surface with strong hierarchy.

Home should answer:

- What needs attention?
- What is happening today?
- What is coming up?
- What has changed?

Preferred sections:

- Needs attention, only when something genuinely needs attention
- Today
- Coming up
- Latest
- Ask Lilica entry point
- Add something action

Do not show:

- Feature grids
- Fake statistics
- Multiple empty sections
- Profile-completion prompts
- Fake live records

## Reference Material

Primary brief:

- `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica.docx`

Framework plan:

- `C:\Users\DavidPC\Downloads\DAVID\Lilica\Lilica_Framework_and_Design_Plan.docx`

Kinlog screenshots:

- `C:\Users\DavidPC\Downloads\DAVID\Lilica\kinlog`

Use Kinlog for flow logic only: family/care onboarding, gradual capture, supported-person concept and calm progression.

Do not copy Kinlog's visual design, clinical tone, profile-completion pressure, medication-first setup or long forms.

Yuka screenshots:

- `C:\Users\DavidPC\Downloads\DAVID\Lilica\yuka`

Use Yuka as the quality benchmark for whitespace, typography, hierarchy, polish, confidence, simplicity, focused interaction and restraint.

Do not copy Yuka's mascot, branding, colours, exact layouts or proprietary assets.

Ryeli typography reference:

- `C:\Users\DavidPC\Downloads\ryeli`

Use Ryeli for clean, premium typography and typographic hierarchy only. Do not copy its product logic.

Current failure screenshots:

- `C:\Users\DavidPC\Downloads\i1.png`
- `C:\Users\DavidPC\Downloads\i2.png`

These show that the current rendered Lilica screens have unacceptable text scale, composition and paragraph presentation.

## Technical Context

The app is an Expo React Native app.

Current app path:

- `C:\Users\DavidPC\Downloads\DAVID\Lilica\lilica-app`

Current stack:

- Expo SDK 57
- React 19
- React Native 0.86
- TypeScript 6
- React Native Web
- AsyncStorage for local onboarding persistence
- Fraunces font package currently installed

Current scripts:

- `npm run start`
- `npm run web`
- `npm run android`
- `npm run ios`
- `npm run typecheck`

No lint script or test suite is currently configured.

Authentication is currently a local onboarding placeholder. It does not implement production Apple, Google or email authentication.

Backend/database infrastructure is not currently present.

## Design Direction

Lilica should feel:

- Clean
- Crisp
- Premium
- Warm
- Calm
- Modern
- Spacious
- Highly legible
- Professionally designed

Use a confident colour system with strong branded moments and restrained content surfaces.

Typography must carry the interface. Avoid generic system-font-looking layouts, weak headline hierarchy, excessive small grey text and oversized paragraph blocks.

Avoid:

- Generic AI-app styling
- Washed-out pastel styling
- Feature grids
- Endless rounded cards
- Random coloured pills
- Excessive shadows
- Glassmorphism
- Decorative statistics
- Excessive icons
- Text-heavy Home panels

The next visual direction should move closer to Yuka-level confidence and Ryeli-level typographic care while remaining original to Lilica.

## Current Design Status

The current implementation is not approved.

The user has rejected the current visual presentation because:

- Welcome still feels cluttered.
- The long proposition still reads like a paragraph rather than a premium onboarding moment.
- The overall presentation does not follow the Yuka benchmark closely enough.
- The app does not yet show sufficient design intelligence in how text is reduced, staged and composed.
- Home should not show product explanation as paragraph copy.
- The UI still feels like a React Native prototype rather than a premium consumer app.

The next design pass should not be a colour tweak or incremental spacing adjustment. It should rethink the screen composition around the Yuka model:

- One dominant visual or interaction idea per screen.
- Very limited text on Welcome.
- Product explanation moved to subsequent screens.
- Clear numbered explanation where needed.
- CTA-style questions after the intro.
- Home as a useful command centre, not a marketing page.

Preserve working Phase 1 functionality, but do not preserve the current screen compositions for their own sake.
