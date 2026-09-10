# Phase 5 Physical-Device QA

Date: 9 September 2026
Scope: Supabase authentication and organiser profile

Use the linked non-production `lilica-development` project only. Put its public URL and publishable key in ignored `.env.local`. Never use a service-role key or personal access token in the app.

Signup verification and password recovery both use six-digit email codes entered in Lilica. Expo Go can test these flows and layouts. The legacy `lilica://auth/recovery` callback remains accepted for compatibility, but the current recovery journey does not depend on opening an email link.

## New Account

- Start from Welcome and choose email account creation.
- Confirm invalid email and passwords shorter than eight characters cannot submit.
- Create an account and confirm the app stays on `Enter your code`; signup alone must not authenticate the user.
- Confirm the message is from `Lilica <auth@luxfordinteractive.com>` after custom Resend SMTP is configured.
- Use resend once and confirm a clear success or rate-limit message.
- Enter the six-digit code from the verification email and confirm Lilica continues into `About you`.
- Enter the organiser's name and confirm `Who are you helping?` follows.
- Complete the existing relationship, supported-person name, privacy, interests and first-record journey unchanged.
- On a device that already contains another account's completed onboarding and records, create a different account and confirm it still starts at `Who are you helping?` after `About you`; it must not display Maggie or any previous account's supported-person data.

## Returning And Recovery

- Close and relaunch the app; confirm the session restores without briefly showing Home or another profile while loading.
- Sign out from the Person tab and confirm Welcome/account entry returns.
- Confirm existing local supported-person records and attachments were not deleted.
- Log back in and confirm the organiser profile is loaded rather than duplicated.
- Confirm signing into each account restores only that account's device-local supported-person onboarding and records.
- Try an incorrect password and confirm a friendly message with no Supabase wording.
- Request password recovery and confirm `Check your email` appears before code entry.
- Confirm the recovery email contains a six-digit code, enter it on `Enter your code`, set matching passwords, and log in with the new password.
- Try an incorrect, expired or already-used verification/recovery code and confirm a friendly error state.

## Layout

- Android: review create account, verification, About you, recovery, keyboard avoidance and bottom safe area on the Phase 3 reference device and a smaller-height phone.
- iOS: repeat on a modern iPhone-sized device, including native email-link return.
- On Login, tap Email, enter an address, use Next to focus Password without closing the keyboard, and confirm Password is fully visible and never covered by the Log in CTA.
- Confirm the focused field scrolls into view on short-height devices, the CTA remains reachable, and dismissing the keyboard leaves no blank gap or stuck offset.
- Repeat the keyboard-open check on Create account, About You, signup/recovery code, recovery request and Choose a new password.
- Increase system text size where practical and confirm fields, messages and CTAs remain readable and scrollable.
- Confirm active non-Welcome onboarding/auth screens begin naturally below the header instead of drifting toward the vertical centre on tall displays.
- Confirm full-width footer commands such as `Continue` and `Skip for now` remain on one line and clear the bottom system-navigation inset.
- Confirm compact Home actions such as `Add` and `Dismiss` retain their intended intrinsic widths.
- Ignore the movable grey cog shown by Expo Go or the Android device's development/game overlay; it is not Lilica UI and will not ship in the standalone app.

Record device/build/results in the QA report. These checks remain for the product owner because Codex cannot operate the physical devices.

Automated baseline on 10 September 2026: TypeScript passed; all 8 Jest suites/98 tests passed; focused auth/responsive suites passed 19 tests; Expo config passed with Android `softwareKeyboardLayoutMode: resize`.
