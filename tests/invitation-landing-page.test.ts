// Invitation deep-link physical test failure (14 September 2026): a
// real iPhone test found "Open in Lilica" produces "Safari cannot open
// the page because the address is invalid." Root-caused to the test
// device having no real Lilica build installed (Expo Go cannot
// register a third-party custom URL scheme -- see this file's own
// header and docs/PHASE_15_ARCHITECTURE.md's matching addendum), NOT a
// code defect -- confirmed by this file's own assertions that the
// landing page's generated target is syntactically correct and
// consistent with the app's own canonical formats.
//
// This is a pure static-file test (no DOM/browser needed): it reads
// public/invite/index.html directly and asserts its script content,
// since no prior test covered this file at all. The triple-slash
// reference below pulls in Node's ambient types (__dirname, etc.) for
// THIS FILE ONLY -- deliberately not added to tsconfig.json's global
// "types" array, which the rest of the app relies on staying scoped to
// "jest" only.
/// <reference types="node" />
import { readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync(join(__dirname, '..', 'public', 'invite', 'index.html'), 'utf8');

describe('Invitation landing page (public/invite/index.html)', () => {
  it('parses the invitation id from the canonical query-parameter format, matching src/invitationLinks.ts', () => {
    expect(html).toMatch(/window\.location\.search\.match\(\/\[\?&\]id=/);
  });

  it('constructs the SAME canonical custom-scheme target as src/invitationLinks.ts\'s invitationAppUrl() -- one contract, not two', () => {
    // invitationAppUrl(id) => `lilica://invite/${id}` -- this exact
    // string-concatenation shape, not a different prefix/format.
    expect(html).toMatch(/openButton\.href = 'lilica:\/\/invite\/' \+ invitationId;/);
  });

  it('never hard-codes a specific invitation id -- the target is always built from the URL actually opened', () => {
    expect(html).not.toMatch(/lilica:\/\/invite\/[0-9a-fA-F-]{36}/);
  });

  it('fails safely on a malformed/missing id -- never guesses one, never leaves a broken half-built link', () => {
    expect(html).toMatch(/openButton\.href = 'lilica:\/\/';/);
    expect(html).toMatch(/didn't include a valid invitation/);
  });

  it('does not claim or imply that a failed hand-off means the app is not installed (14 September 2026 copy correction)', () => {
    expect(html).not.toMatch(/If you already have Lilica installed/);
    expect(html).toMatch(/Already have Lilica\? Open this invitation in the app\./);
  });

  it('states the pre-launch store reality as its own separate, calm sentence -- not folded into the install-check copy', () => {
    expect(html).toMatch(/Lilica isn't publicly available in the App Store or Google Play yet/);
  });

  it('never renders a real store-badge image or link -- only the explanatory HTML comment may mention what is deliberately NOT shown', () => {
    expect(html).not.toMatch(/<img[^>]*(app-store|google-play|badge)/i);
    expect(html).not.toMatch(/<a[^>]*href="https:\/\/apps\.apple\.com/i);
    expect(html).not.toMatch(/<a[^>]*href="https:\/\/play\.google\.com/i);
  });

  it('tapping Open in Lilica is a plain anchor navigation, never a script-driven redirect that could destroy the page on failure', () => {
    // No window.location assignment anywhere in the script -- the OS's
    // own failure dialog (confirmed by direct physical-device
    // screenshot) leaves this page fully intact underneath it, which a
    // window.location redirect could not guarantee.
    expect(html).not.toMatch(/window\.location\s*=/);
  });
});
