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

interface ProcessorOfflineAlertEmailProps {
  isReminder: boolean;
  lastPingTime: string;
  offlineDuration: string;
  adminUrl: string;
  thresholdSeconds: number;
  reminderMinutes: number;
}

export default function ProcessorOfflineAlertEmail({
  isReminder,
  lastPingTime,
  offlineDuration,
  adminUrl,
  thresholdSeconds,
  reminderMinutes,
}: ProcessorOfflineAlertEmailProps) {
  const title = isReminder ? 'Reminder: Design Processor Still Offline' : 'Design Processor Offline';

  return (
    <Html>
      <Head />
      <Preview>{title}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>{title}</Text>

          <Section style={detailsSection}>
            <Text style={detailRow}><strong>Last check-in:</strong> {lastPingTime}</Text>
            <Text style={detailRow}><strong>Offline duration:</strong> {offlineDuration}</Text>
            <Text style={detailRow}><strong>Offline threshold:</strong> {thresholdSeconds}s</Text>
            <Text style={detailRow}><strong>Reminder interval:</strong> {reminderMinutes}m</Text>
          </Section>

          <Section style={buttonSection}>
            <Link href={adminUrl} style={button}>
              Open Admin Status
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={muted}>
            This notification is sent to SYSTEM_ADMIN users who opted into site alerts.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '560px',
  borderRadius: '8px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#b45309',
  marginBottom: '16px',
};

const detailsSection = {
  margin: '16px 0',
};

const detailRow = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#3c4149',
  margin: '4px 0',
};

const buttonSection = {
  textAlign: 'center' as const,
  margin: '24px 0',
};

const button = {
  display: 'inline-block',
  padding: '12px 24px',
  backgroundColor: '#2563eb',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  textDecoration: 'none',
  borderRadius: '6px',
};

const muted = {
  fontSize: '13px',
  lineHeight: '20px',
  color: '#6b7280',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};
