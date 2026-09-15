// Care Circle invitation email: restrained and privacy-safe by design
// (brief section 14). Contains ONLY the inviter's own display name, the
// supported person's FIRST NAME, a Join link, and (since 14 September
// 2026's invitation & joining flow completion) the human-friendly
// invitation code -- never a record title, task, appointment, bill,
// health note, document, or financial detail of any kind. Kept as a
// pure, dependency-free module (no Deno APIs) so it can be unit-tested
// without a live Edge Functions runtime, exactly like entitlement-
// webhook's own mapping.ts.

export type InvitationEmailInput = {
  inviterName: string;
  // Multi-person Care Circle invitation scope (`\downloads\perm.txt`, 15
  // September 2026): one or more first names -- a legacy single-person
  // invitation passes a one-element array, so its wording is completely
  // unchanged. Brief section 10: never expose surnames.
  personFirstNames: string[];
  joinUrl: string;
  inviteCode: string;
};

// "Maggie" | "Maggie and Ben" | "Maggie, Ben and Jackie" -- ordinary,
// grammatical English list joining, used only for the email/Share text.
function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? 'someone';
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

export type InvitationEmailContent = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Displayed grouped (ABCD-1234-style) -- the code is stored as one plain
// 8-character string; this is presentation only, matching the landing
// page's own formatting.
function formatCode(code: string): string {
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function buildInvitationEmail({ inviterName, personFirstNames, joinUrl, inviteCode }: InvitationEmailInput): InvitationEmailContent {
  const isMultiple = personFirstNames.length > 1;
  const namesJoined = joinNames(personFirstNames);
  // Brief section 10: for one person, keep the natural existing wording
  // ("...help with Maggie's care") completely unchanged; for more than
  // one, the grammatically cleaner "...help support: Maggie, Ben".
  const subject = isMultiple
    ? `${inviterName} has invited you to help support ${namesJoined}`
    : `${inviterName} has invited you to help with ${namesJoined}'s care`;
  const introLine = isMultiple
    ? `${inviterName} has invited you to join Lilica to help support ${namesJoined}.`
    : `${inviterName} has invited you to help with ${namesJoined}'s care in Lilica.`;
  const formattedCode = formatCode(inviteCode);

  const text = [
    introLine,
    '',
    "Lilica helps families organise the things involved in supporting someone.",
    '',
    `Open invitation: ${joinUrl}`,
    '',
    `Invitation code: ${formattedCode}`,
    '',
    'If necessary, install/open Lilica and choose "Join a Care Circle", then enter this code.',
    '',
    "If you weren't expecting this invitation, you can ignore this email.",
  ].join('\n');

  const safeInviter = escapeHtml(inviterName);
  const safeNamesJoined = escapeHtml(namesJoined);
  const safeUrl = escapeHtml(joinUrl);
  const safeCode = escapeHtml(formattedCode);
  const safeIntroHtml = isMultiple
    ? `<strong>${safeInviter}</strong> has invited you to join Lilica to help support <strong>${safeNamesJoined}</strong>.`
    : `<strong>${safeInviter}</strong> has invited you to help with <strong>${safeNamesJoined}'s care</strong> in Lilica.`;

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; color: #241D1C; background-color: #F7F3EF; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; padding: 32px;">
      <p style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">Lilica</p>
      <p style="font-size: 16px; line-height: 24px; margin: 0 0 16px;">
        ${safeIntroHtml}
      </p>
      <p style="font-size: 14px; line-height: 22px; color: #6B615C; margin: 0 0 24px;">
        Lilica helps families organise the things involved in supporting someone.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${safeUrl}" style="display: inline-block; background-color: #63364D; color: #FFFFFF; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 15px; font-weight: 600;">
          Open invitation
        </a>
      </p>
      <p style="font-size: 13px; line-height: 20px; color: #6B615C; margin: 0 0 4px;">
        Invitation code:
      </p>
      <p style="font-size: 20px; font-weight: 700; letter-spacing: 2px; margin: 0 0 24px;">
        ${safeCode}
      </p>
      <p style="font-size: 12px; line-height: 18px; color: #9A9086; margin: 0 0 16px;">
        If necessary, install/open Lilica and choose "Join a Care Circle", then enter this code.
      </p>
      <p style="font-size: 12px; line-height: 18px; color: #9A9086; margin: 0;">
        If you weren't expecting this invitation, you can ignore this email.
      </p>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}
