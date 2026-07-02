import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Hr,
  Preview,
} from '@react-email/components';

// -- Data shapes --

export interface OrgDesignJobStats {
  orgName: string;
  total: number;
  succeeded: number;
  failed: number;
  inProgress: number;
}

export interface OrgPrintStats {
  orgName: string;
  total: number;
  succeeded: number;
  failed: number;
  accepted: number;
  rejected: number;
  pending: number;
}

export interface MoreInfoSummary {
  count: number;
  names: string[]; // name + org for quick scan
}

export interface ProcessorHealthSummary {
  wasOffline: boolean;
  offlineDurationMinutes: number | null;
  currentlyOnline: boolean;
  digestSelfCheckStatus: 'NOT_RUN' | 'PASSED' | 'FAILED' | 'TIMEOUT' | 'ERROR';
  digestSelfCheckObjectId: string | null;
  digestSelfCheckDurationSeconds: number | null;
  digestSelfCheckFailurePreview: string | null;
  lastSelfCheckStatus: 'NONE' | 'QUEUED' | 'RUNNING' | 'PASSED' | 'FAILED';
  lastSelfCheckSource: string | null;
  lastSelfCheckObjectId: string | null;
  lastSelfCheckCreatedAt: string | null;
  lastSelfCheckCompletedAt: string | null;
  lastSelfCheckDurationSeconds: number | null;
  lastSelfCheckFailurePreview: string | null;
}

export interface NewUserSummary {
  count: number;
  emails: string[];
  totalUsers: number;
  totalOrgs: number;
}

export interface DailyDigestEmailProps {
  reportDate: string;       // e.g. "June 4, 2026"
  windowHours: number;      // always 24
  adminUrl: string;
  designJobs: OrgDesignJobStats[];
  prints: OrgPrintStats[];
  moreInfo: MoreInfoSummary;
  processor: ProcessorHealthSummary;
  newUsers: NewUserSummary;
}

export default function DailyDigestEmail({
  reportDate,
  adminUrl,
  designJobs,
  prints,
  moreInfo,
  processor,
  newUsers,
}: DailyDigestEmailProps) {
  const totalJobs = designJobs.reduce((s, o) => s + o.total, 0);
  const totalPrints = prints.reduce((s, o) => s + o.total, 0);

  return (
    <Html>
      <Head />
      <Preview>Splint Factory daily digest - {reportDate}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>Daily System Digest</Text>
          <Text style={subheading}>{reportDate} - last 24 hours</Text>

          {/* More-info signups */}
          <Section style={section}>
            <Text style={sectionHeading}>More-Info Requests</Text>
            {moreInfo.count === 0 ? (
              <Text style={row}>No submissions in the last 24 hours.</Text>
            ) : (
              <>
                <Text style={row}><strong>{moreInfo.count}</strong> new submission{moreInfo.count !== 1 ? 's' : ''}</Text>
                {moreInfo.names.map((name, i) => (
                  <Text key={i} style={subRow}>- {name}</Text>
                ))}
              </>
            )}
          </Section>

          <Hr style={hr} />

          {/* Design job processing */}
          <Section style={section}>
            <Text style={sectionHeading}>Design Job Processing ({totalJobs} jobs)</Text>
            {designJobs.length === 0 ? (
              <Text style={row}>No jobs processed.</Text>
            ) : (
              designJobs.map((org, i) => (
                <Text key={i} style={row}>
                  <strong>{org.orgName}</strong>
                  {' - '}
                  {org.total} total, {org.succeeded} ok, {org.failed} failed
                  {org.inProgress > 0 ? `, ${org.inProgress} in progress` : ''}
                </Text>
              ))
            )}
          </Section>

          <Hr style={hr} />

          {/* Prints */}
          <Section style={section}>
            <Text style={sectionHeading}>Print Queue ({totalPrints} prints)</Text>
            {prints.length === 0 ? (
              <Text style={row}>No prints in the last 24 hours.</Text>
            ) : (
              prints.map((org, i) => (
                <Text key={i} style={row}>
                  <strong>{org.orgName}</strong>
                  {' - '}
                  {org.total} total, {org.succeeded} successful
                  {org.accepted > 0 ? `, ${org.accepted} accepted` : ''}
                  {org.rejected > 0 ? `, ${org.rejected} rejected` : ''}
                  {org.failed > 0 ? `, ${org.failed} failed` : ''}
                  {org.pending > 0 ? `, ${org.pending} pending` : ''}
                </Text>
              ))
            )}
          </Section>

          <Hr style={hr} />

          {/* Processor health */}
          <Section style={section}>
            <Text style={sectionHeading}>Geo Processor</Text>
            {processor.currentlyOnline ? (
              <Text style={rowGood}>Online</Text>
            ) : (
              <Text style={rowBad}>Currently OFFLINE</Text>
            )}
            {processor.wasOffline && processor.offlineDurationMinutes !== null && (
              <Text style={rowWarn}>
                Was offline for {processor.offlineDurationMinutes} minute{processor.offlineDurationMinutes !== 1 ? 's' : ''} during this period.
              </Text>
            )}
            {!processor.wasOffline && (
              <Text style={subRow}>No outages in the last 24 hours.</Text>
            )}

            {processor.digestSelfCheckStatus === 'PASSED' && (
              <Text style={rowGood}>Pre-digest self-check: PASSED</Text>
            )}
            {processor.digestSelfCheckStatus === 'FAILED' && (
              <Text style={rowBad}>Pre-digest self-check: FAILED</Text>
            )}
            {processor.digestSelfCheckStatus === 'TIMEOUT' && (
              <Text style={rowWarn}>Pre-digest self-check: TIMEOUT</Text>
            )}
            {processor.digestSelfCheckStatus === 'ERROR' && (
              <Text style={rowBad}>Pre-digest self-check: ERROR</Text>
            )}
            {processor.digestSelfCheckStatus === 'NOT_RUN' && (
              <Text style={subRow}>Pre-digest self-check was not executed.</Text>
            )}
            {processor.digestSelfCheckObjectId && (
              <Text style={subRow}>Pre-digest Object ID: {processor.digestSelfCheckObjectId}</Text>
            )}
            {processor.digestSelfCheckDurationSeconds !== null && (
              <Text style={subRow}>Pre-digest duration: {processor.digestSelfCheckDurationSeconds.toFixed(1)}s</Text>
            )}
            {processor.digestSelfCheckFailurePreview && (
              <Text style={subRow}>Pre-digest detail: {processor.digestSelfCheckFailurePreview}</Text>
            )}

            {processor.lastSelfCheckStatus === 'NONE' ? (
              <Text style={subRow}>No processor self-check has run yet.</Text>
            ) : (
              <>
                {processor.lastSelfCheckStatus === 'PASSED' && (
                  <Text style={rowGood}>Last self-check: PASSED</Text>
                )}
                {processor.lastSelfCheckStatus === 'FAILED' && (
                  <Text style={rowBad}>Last self-check: FAILED</Text>
                )}
                {processor.lastSelfCheckStatus === 'RUNNING' && (
                  <Text style={rowWarn}>Last self-check: RUNNING</Text>
                )}
                {processor.lastSelfCheckStatus === 'QUEUED' && (
                  <Text style={rowWarn}>Last self-check: QUEUED</Text>
                )}
                {processor.lastSelfCheckObjectId && (
                  <Text style={subRow}>Object ID: {processor.lastSelfCheckObjectId}</Text>
                )}
                {processor.lastSelfCheckSource && (
                  <Text style={subRow}>Source: {processor.lastSelfCheckSource}</Text>
                )}
                {processor.lastSelfCheckCreatedAt && (
                  <Text style={subRow}>Created: {new Date(processor.lastSelfCheckCreatedAt).toLocaleString('en-US')}</Text>
                )}
                {processor.lastSelfCheckCompletedAt && (
                  <Text style={subRow}>Completed: {new Date(processor.lastSelfCheckCompletedAt).toLocaleString('en-US')}</Text>
                )}
                {processor.lastSelfCheckDurationSeconds !== null && (
                  <Text style={subRow}>Duration: {processor.lastSelfCheckDurationSeconds.toFixed(1)}s</Text>
                )}
                {processor.lastSelfCheckFailurePreview && (
                  <Text style={subRow}>Failure detail: {processor.lastSelfCheckFailurePreview}</Text>
                )}
              </>
            )}
          </Section>

          <Hr style={hr} />

          {/* New users */}
          <Section style={section}>
            <Text style={sectionHeading}>New Registrations</Text>
            {newUsers.count === 0 ? (
              <Text style={row}>No new accounts created.</Text>
            ) : (
              <>
                <Text style={row}><strong>{newUsers.count}</strong> new account{newUsers.count !== 1 ? 's' : ''}</Text>
                {newUsers.emails.map((email, i) => (
                  <Text key={i} style={subRow}>- {email}</Text>
                ))}
              </>
            )}
            <Text style={subRow}>Total: {newUsers.totalUsers} users across {newUsers.totalOrgs} organization{newUsers.totalOrgs !== 1 ? 's' : ''}</Text>
          </Section>

          <Hr style={hr} />

          <Section>
            <Link href={adminUrl} style={button}>Open Admin Dashboard</Link>
          </Section>

          <Hr style={hr} />
          <Text style={muted}>
            Sent to SYSTEM_ADMIN users opted into site alerts.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// -- Styles --

const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '600px',
  borderRadius: '8px',
};

const heading = {
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1e3a5f',
  marginBottom: '4px',
};

const subheading = {
  fontSize: '13px',
  color: '#6b7280',
  marginBottom: '8px',
};

const section = {
  marginBottom: '4px',
};

const sectionHeading = {
  fontSize: '13px',
  fontWeight: '700' as const,
  color: '#374151',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  margin: '12px 0 6px',
};

const row = {
  fontSize: '14px',
  color: '#374151',
  margin: '4px 0',
};

const subRow = {
  fontSize: '13px',
  color: '#6b7280',
  margin: '2px 0 2px 12px',
};

const rowGood = {
  fontSize: '14px',
  color: '#059669',
  fontWeight: '600' as const,
  margin: '4px 0',
};

const rowBad = {
  fontSize: '14px',
  color: '#dc2626',
  fontWeight: '600' as const,
  margin: '4px 0',
};

const rowWarn = {
  fontSize: '14px',
  color: '#d97706',
  margin: '4px 0',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '16px 0',
};

const button = {
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  padding: '10px 20px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontWeight: '600' as const,
  fontSize: '14px',
};

const muted = {
  fontSize: '12px',
  color: '#9ca3af',
  marginTop: '16px',
};
