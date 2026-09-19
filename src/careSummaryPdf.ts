import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { ActivityEvent, describeActivityEvent } from './activity';
import { CareCircleMember } from './careCircle';
import { firstItemOptions } from './data/options';
import { calendarDateForRecord, deriveRecordState, formatDateForDisplay, isActionableRecord } from './records';
import { LilicaRecord, LilicaRecordType } from './types';

type Input = {
  records: LilicaRecord[];
  careCircleMembers: CareCircleMember[];
  recentActivity: ActivityEvent[];
  personName?: string;
  generatedAt?: Date;
};

export type CareSummaryPdfResult =
  | { ok: true; uri: string }
  | { ok: false; message: string };

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function recordTypeLabel(type: LilicaRecordType): string {
  // 'condition'/'medicine' are deliberately not in firstItemOptions (see
  // its own comment) -- their own dedicated Medical Log labels used here.
  if (type === 'condition') return 'Diagnosed condition';
  if (type === 'medicine') return 'Prescribed medicine';
  return firstItemOptions.find((option) => option.id === type)?.title ?? type;
}

function recordDate(record: LilicaRecord): string | undefined {
  const value = calendarDateForRecord(record) ?? record.dueDate ?? record.date;
  const date = formatDateForDisplay(value);
  const time = record.eventTime ?? record.time;
  return date ? `${date}${time ? ` at ${time}` : ''}` : undefined;
}

function assignedTo(record: LilicaRecord, members: CareCircleMember[]): string | undefined {
  if (record.assignedMembershipId) {
    const member = members.find((candidate) => candidate.membershipId === record.assignedMembershipId);
    return member ? (member.isSelf ? 'You' : member.displayName) : 'Assigned Care Circle member';
  }
  return record.responsiblePerson || undefined;
}

function recordMeta(record: LilicaRecord, members: CareCircleMember[]): string[] {
  const state = deriveRecordState(record);
  const date = recordDate(record);
  const assignee = assignedTo(record, members);
  return [
    recordTypeLabel(record.type),
    state.overdue ? 'Overdue' : state.dueToday ? 'Due today' : state.completed ? 'Completed' : undefined,
    date,
    assignee ? `Assigned to ${assignee}` : undefined,
  ].filter((value): value is string => Boolean(value));
}

function medicalDetail(record: LilicaRecord): string | undefined {
  if (record.type === 'condition') {
    return record.diagnosedDate ? `Diagnosed ${formatDateForDisplay(record.diagnosedDate)}` : undefined;
  }
  if (record.type === 'medicine') {
    return record.medicineSchedule === 'duration' && record.medicineEndDate
      ? `Until ${formatDateForDisplay(record.medicineEndDate)}`
      : 'Ongoing';
  }
  return undefined;
}

function recordItem(record: LilicaRecord, members: CareCircleMember[], detail?: string): string {
  const meta = recordMeta(record, members);
  const notes = detail ?? record.notes;
  return `<li><strong>${escapeHtml(record.title)}</strong>${meta.length ? `<div class="meta">${escapeHtml(meta.join(' | '))}</div>` : ''}${notes ? `<div>${escapeHtml(notes)}</div>` : ''}</li>`;
}

function section(title: string, content: string[], emptyText?: string): string {
  if (content.length === 0 && !emptyText) return '';
  return `<section><h2>${escapeHtml(title)}</h2>${content.length ? `<ul>${content.join('')}</ul>` : `<p class="empty">${escapeHtml(emptyText)}</p>`}</section>`;
}

export function buildCareSummaryPdfHtml({
  records,
  careCircleMembers,
  recentActivity,
  personName,
  generatedAt = new Date(),
}: Input): string {
  const name = personName?.trim() || 'Supported person';
  const active = records.filter((record) => record.status !== 'cancelled');
  const actionable = active.filter(isActionableRecord);
  const needsAttention = actionable.filter((record) => {
    const state = deriveRecordState(record, generatedAt);
    return state.overdue || state.dueToday;
  });
  const comingUp = active
    .filter((record) => deriveRecordState(record, generatedAt).upcoming)
    .sort((left, right) => (calendarDateForRecord(left) ?? '').localeCompare(calendarDateForRecord(right) ?? ''));
  const contacts = active.filter((record) => record.type === 'contact');
  const appointments = active.filter((record) => record.type === 'appointment');
  const errands = active.filter((record) => record.type === 'task');
  const careInformation = active.filter((record) => record.type === 'careNote');
  // Medical Log: only active (never closed/resolved) conditions and
  // medicines, matching MedicalLogScreen's own "current" grouping and
  // careSummary.ts's identical section -- a quick handover report shows
  // what currently applies, not full history.
  const medical = active.filter((record) => (record.type === 'condition' || record.type === 'medicine') && !record.closedAt);
  const documents = active.filter((record) => record.type === 'document');
  const bills = active.filter((record) => record.type === 'bill');
  const homeCar = active.filter((record) => record.type === 'homeMatter');
  const wellbeingUpdates = active.filter((record) => record.type === 'update');
  const attachments = active.flatMap((record) => (record.attachments ?? []).map((attachment) => ({ record, attachment })));
  const generatedLabel = generatedAt.toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

  const sections = [
    section('Needs attention', needsAttention.map((record) => recordItem(record, careCircleMembers)), 'Nothing currently needs urgent attention.'),
    section('Coming up', comingUp.map((record) => recordItem(record, careCircleMembers)), 'Nothing dated is currently coming up.'),
    section('Appointments', appointments.map((record) => recordItem(record, careCircleMembers))),
    section('Errands or activities', errands.map((record) => recordItem(record, careCircleMembers))),
    section('Key contacts', contacts.map((record) => recordItem(record, careCircleMembers, [record.role, record.phone, record.email].filter(Boolean).join(' | ')))),
    section('Care Circle', careCircleMembers.map((member) => `<li><strong>${escapeHtml(member.isSelf ? 'You' : member.displayName)}</strong><div class="meta">${escapeHtml(member.role)}</div></li>`)),
    section('Important care information', careInformation.map((record) => recordItem(record, careCircleMembers))),
    section('Conditions & medicines', medical.map((record) => recordItem(record, careCircleMembers, medicalDetail(record) ?? record.notes))),
    section('Documents index', [
      ...documents.map((record) => recordItem(record, careCircleMembers, record.expiryDate ? `Expires ${formatDateForDisplay(record.expiryDate)}` : record.notes)),
      ...attachments.map(({ record, attachment }) => `<li><strong>${escapeHtml(attachment.name)}</strong><div class="meta">Attached to ${escapeHtml(record.title)}</div></li>`),
    ]),
    section('Bills and renewals', bills.map((record) => recordItem(record, careCircleMembers))),
    section('Home and car', homeCar.map((record) => recordItem(record, careCircleMembers))),
    section('Wellbeing updates', wellbeingUpdates.map((record) => recordItem(record, careCircleMembers))),
    section('Recent activity', recentActivity.map((event) => `<li><strong>${escapeHtml(describeActivityEvent(event))}</strong><div class="meta">${escapeHtml(new Date(event.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}</div></li>`)),
  ].filter(Boolean).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page { margin: 42px; }
    body { color: #241D1C; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 12px; line-height: 1.45; }
    header { border-bottom: 3px solid #63364D; margin-bottom: 20px; padding-bottom: 14px; }
    .wordmark { color: #63364D; font-family: Georgia, serif; font-size: 18px; font-weight: 700; }
    h1 { font-size: 27px; margin: 5px 0 2px; }
    h2 { color: #63364D; font-size: 16px; margin: 0 0 8px; }
    section { break-inside: avoid; border: 1px solid #DDD3C9; border-radius: 8px; margin: 0 0 12px; padding: 12px 14px; }
    ul { list-style: none; margin: 0; padding: 0; }
    li { border-top: 1px solid #EDE4D9; padding: 8px 0; }
    li:first-child { border-top: 0; padding-top: 0; }
    li:last-child { padding-bottom: 0; }
    .meta, .generated, .empty { color: #605856; }
    .notice { background: #F0E1E8; border-radius: 8px; color: #63364D; margin-top: 18px; padding: 10px 12px; }
  </style></head><body>
    <header><div class="wordmark">Lilica</div><h1>${escapeHtml(name)}'s care summary</h1><div class="generated">Generated ${escapeHtml(generatedLabel)}</div></header>
    ${sections || '<p>No care information is currently available for this report.</p>'}
    <div class="notice"><strong>Private and sensitive:</strong> This report contains personal care information. Share and store it carefully. It reflects the information available to the person who generated it at the time shown above.</div>
  </body></html>`;
}

export async function exportCareSummaryPdf(input: Input): Promise<CareSummaryPdfResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, message: 'Saving PDF reports is not supported on this device.' };
    }
    const { uri } = await Print.printToFileAsync({ html: buildCareSummaryPdfHtml(input) });
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
      dialogTitle: `${input.personName?.trim() || 'Lilica'} care summary`,
    });
    return { ok: true, uri };
  } catch {
    return { ok: false, message: 'The care summary PDF could not be prepared. Please try again.' };
  }
}
