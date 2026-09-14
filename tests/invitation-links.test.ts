import { invitationAppUrl, invitationWebUrl, parseInvitationIdFromUrl } from '../src/invitationLinks';

const SAMPLE_ID = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

describe('invitationWebUrl / invitationAppUrl', () => {
  it('builds the canonical web URL as a query parameter -- see the 14 September 2026 routing decision', () => {
    expect(invitationWebUrl(SAMPLE_ID)).toBe(`https://lilica.co.uk/invite/?id=${SAMPLE_ID}`);
  });

  it('builds the canonical custom-scheme URL as a path segment (unaffected by the web routing decision)', () => {
    expect(invitationAppUrl(SAMPLE_ID)).toBe(`lilica://invite/${SAMPLE_ID}`);
  });
});

describe('parseInvitationIdFromUrl', () => {
  it('parses the id from the canonical web URL (query parameter)', () => {
    expect(parseInvitationIdFromUrl(`https://lilica.co.uk/invite/?id=${SAMPLE_ID}`)).toBe(SAMPLE_ID);
  });

  it('parses the id from a custom-scheme URL', () => {
    expect(parseInvitationIdFromUrl(`lilica://invite/${SAMPLE_ID}`)).toBe(SAMPLE_ID);
  });

  it('parses the id even with extra query params, a fragment, or a trailing slash', () => {
    expect(parseInvitationIdFromUrl(`https://lilica.co.uk/invite/?id=${SAMPLE_ID}&utm_source=email`)).toBe(SAMPLE_ID);
    expect(parseInvitationIdFromUrl(`https://lilica.co.uk/invite/?utm_source=email&id=${SAMPLE_ID}`)).toBe(SAMPLE_ID);
    expect(parseInvitationIdFromUrl(`lilica://invite/${SAMPLE_ID}#foo`)).toBe(SAMPLE_ID);
  });

  it('still parses a legacy path-segment web URL as a harmless fallback -- nothing generates this form anymore, but an old link must not break', () => {
    expect(parseInvitationIdFromUrl(`https://lilica.co.uk/invite/${SAMPLE_ID}`)).toBe(SAMPLE_ID);
    expect(parseInvitationIdFromUrl(`https://lilica.co.uk/invite/${SAMPLE_ID}/`)).toBe(SAMPLE_ID);
  });

  it('returns undefined for an unrelated URL -- never a false match', () => {
    expect(parseInvitationIdFromUrl('lilica://password-recovery?token=abc')).toBeUndefined();
    expect(parseInvitationIdFromUrl('https://lilica.co.uk/')).toBeUndefined();
    expect(parseInvitationIdFromUrl('not a url at all')).toBeUndefined();
  });

  it('returns undefined for a malformed id -- never a partial/guessed match', () => {
    expect(parseInvitationIdFromUrl('https://lilica.co.uk/invite/?id=not-a-real-uuid')).toBeUndefined();
    expect(parseInvitationIdFromUrl('https://lilica.co.uk/invite/not-a-real-uuid')).toBeUndefined();
  });
});
