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
  personFirstName: string;
  joinUrl: string;
  inviteCode: string;
};

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

export function buildInvitationEmail({ inviterName, personFirstName, joinUrl, inviteCode }: InvitationEmailInput): InvitationEmailContent {
  const subject = `${inviterName} has invited you to help with ${personFirstName}'s care`;
  const formattedCode = formatCode(inviteCode);

  const text = [
    `${inviterName} has invited you to help with ${personFirstName}'s care in Lilica.`,
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
  const safePerson = escapeHtml(personFirstName);
  const safeUrl = escapeHtml(joinUrl);
  const safeCode = escapeHtml(formattedCode);

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Helvetica, Arial, sans-serif; color: #241D1C; background-color: #F7F3EF; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background-color: #FFFFFF; border-radius: 12px; padding: 32px;">
      <p style="font-size: 20px; font-weight: 700; margin: 0 0 16px;">Lilica</p>
      <p style="font-size: 16px; line-height: 24px; margin: 0 0 16px;">
        <strong>${safeInviter}</strong> has invited you to help with <strong>${safePerson}'s care</strong> in Lilica.
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
