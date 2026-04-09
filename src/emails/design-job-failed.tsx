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

interface DesignJobFailedEmailProps {
  userName: string;
  userEmail: string;
  objectId: string | null;
  jobLabel: string | null;
  designName: string;
  algorithmName: string;
  inputParameters: string;
  errorMessage: string | null;
  jobUrl: string;
  debugCommand: string;
}

export default function DesignJobFailedEmail({
  userName,
  userEmail,
  objectId,
  jobLabel,
  designName,
  algorithmName,
  inputParameters,
  errorMessage,
  jobUrl,
  debugCommand,
}: DesignJobFailedEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Design job failed: {jobLabel || objectId || 'Unknown'}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>Design Job Failed</Text>

          <Section style={detailsSection}>
            <Text style={detailRow}><strong>User:</strong> {userName} ({userEmail})</Text>
            <Text style={detailRow}><strong>Object ID:</strong> {objectId || 'N/A'}</Text>
            <Text style={detailRow}><strong>Job Label:</strong> {jobLabel || 'N/A'}</Text>
            <Text style={detailRow}><strong>Design:</strong> {designName}</Text>
            <Text style={detailRow}><strong>Algorithm:</strong> {algorithmName}</Text>
          </Section>

          {errorMessage && (
            <Section style={errorSection}>
              <Text style={errorLabel}>Error</Text>
              <Text style={errorText}>{errorMessage}</Text>
            </Section>
          )}

          <Section style={detailsSection}>
            <Text style={paramLabel}>Input Parameters</Text>
            <Text style={paramText}>{inputParameters}</Text>
          </Section>

          <Section style={detailsSection}>
            <Text style={paramLabel}>Debug Locally</Text>
            <Text style={paramText}>{debugCommand}</Text>
          </Section>

          <Section style={buttonSection}>
            <Link href={jobUrl} style={button}>
              View Job Details
            </Link>
          </Section>

          <Hr style={hr} />
          <Text style={muted}>
            This is an automated notification from Splint Factory.
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
  color: '#dc2626',
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

const errorSection = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '6px',
  padding: '12px 16px',
  margin: '16px 0',
};

const errorLabel = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#dc2626',
  margin: '0 0 4px 0',
};

const errorText = {
  fontSize: '13px',
  lineHeight: '20px',
  color: '#7f1d1d',
  margin: '0',
  wordBreak: 'break-all' as const,
};

const paramLabel = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#6b7280',
  margin: '0 0 4px 0',
};

const paramText = {
  fontSize: '12px',
  lineHeight: '18px',
  color: '#6b7280',
  fontFamily: 'monospace',
  whiteSpace: 'pre-wrap' as const,
  wordBreak: 'break-all' as const,
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '4px',
  padding: '8px 12px',
  margin: '0',
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
