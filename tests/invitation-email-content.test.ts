// Pure-logic tests for the Care Circle invitation email's content
// generation (supabase/functions/send-invitation-email/email-content.ts)
// -- no Deno runtime required, mirroring
// tests/phase21b-webhook-mapping.test.ts's own established pattern for
// testing Edge Function logic without deploying it.
//
// Updated 14 September 2026 (`\downloads\carecircle.txt`, Care Circle
// invitation & joining flow completion) -- the email now also carries
// the human-friendly invitation code, and its wording matches the
// brief's own "Open invitation" / code-fallback example exactly.
import { buildInvitationEmail } from '../supabase/functions/send-invitation-email/email-content';

describe('buildInvitationEmail', () => {
  const input = { inviterName: 'David', personFirstName: 'Maggie', joinUrl: 'https://lilica.co.uk/invite/?id=abc-123&code=ABCD1234', inviteCode: 'ABCD1234' };

  it('names the inviter and the supported person, and includes the join link', () => {
    const { subject, text, html } = buildInvitationEmail(input);
    expect(subject).toContain('David');
    expect(subject).toContain('Maggie');
    expect(text).toContain('David has invited you to help with');
    expect(text).toContain("Maggie's care");
    expect(text).toContain('https://lilica.co.uk/invite/?id=abc-123&code=ABCD1234');
    expect(html).toContain('https://lilica.co.uk/invite/?id=abc-123&amp;code=ABCD1234'); // HTML-escaped, correctly
    expect(html).toContain('David');
    expect(html).toContain('Maggie');
  });

  it('includes the human-friendly invitation code, formatted as XXXX-XXXX', () => {
    const { text, html } = buildInvitationEmail(input);
    expect(text).toContain('ABCD-1234');
    expect(html).toContain('ABCD-1234');
  });

  it('tells the recipient how to use the code if they need to (brief section 22)', () => {
    const { text } = buildInvitationEmail(input);
    expect(text).toMatch(/Join a Care Circle/i);
  });

  it('includes the "if you were not expecting this" disclaimer', () => {
    const { text, html } = buildInvitationEmail(input);
    expect(text).toMatch(/weren't expecting this invitation/i);
    expect(html).toMatch(/weren't expecting this invitation/i);
  });

  it('never claims the recipient has already joined before acceptance', () => {
    const { text, html } = buildInvitationEmail(input);
    expect(text.toLowerCase()).not.toContain('you have joined');
    expect(html.toLowerCase()).not.toContain('you have joined');
  });

  it('never exposes protected care content -- no record titles, tasks, appointments, bills, health notes, documents or financial detail', () => {
    const { subject, text, html } = buildInvitationEmail(input);
    const combined = `${subject} ${text} ${html}`.toLowerCase();
    const forbidden = ['appointment', 'task', 'bill', 'invoice', 'prescription', 'diagnosis', 'document', 'financial', 'balance', '£', '$'];
    for (const term of forbidden) {
      expect(combined).not.toContain(term);
    }
  });

  it('escapes HTML-unsafe characters in the inviter/person names so the email cannot be corrupted by them', () => {
    const { html } = buildInvitationEmail({ inviterName: 'Dave <script>', personFirstName: 'Mags & Co', joinUrl: 'https://lilica.co.uk/invite/?id=x', inviteCode: 'ABCD1234' });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('Mags &amp; Co');
  });
});
