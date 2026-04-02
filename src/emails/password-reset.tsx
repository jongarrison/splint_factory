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

interface PasswordResetEmailProps {
  resetUrl: string;
}

export default function PasswordResetEmail({ resetUrl }: PasswordResetEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your Splint Factory password</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>Password Reset</Text>
          <Text style={paragraph}>
            You requested a password reset for your Splint Factory account.
          </Text>
          <Section style={buttonSection}>
            <Link href={resetUrl} style={button}>
              Reset Password
            </Link>
          </Section>
          <Text style={muted}>
            Or copy this link: {resetUrl}
          </Text>
          <Hr style={hr} />
          <Text style={muted}>
            This link expires in 1 hour. If you did not request this, you can
            safely ignore this email.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles kept inline per email best practices
const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '480px',
  borderRadius: '8px',
};

const heading = {
  fontSize: '24px',
  fontWeight: '600' as const,
  color: '#1a1a1a',
  marginBottom: '16px',
};

const paragraph = {
  fontSize: '16px',
  lineHeight: '26px',
  color: '#3c4149',
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
  wordBreak: 'break-all' as const,
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '24px 0',
};
