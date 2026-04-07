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

interface InvitationEmailProps {
  registerUrl: string;
  organizationName: string;
  invitedByName: string;
}

export default function InvitationEmail({
  registerUrl,
  organizationName,
  invitedByName,
}: InvitationEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>You have been invited to join {organizationName} on Splint Factory</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>You&apos;re Invited</Text>
          <Text style={paragraph}>
            {invitedByName} has invited you to join <strong>{organizationName}</strong> on
            Splint Factory.
          </Text>
          <Text style={paragraph}>
            Click the button below to create your account. Since this invitation
            was sent directly to your email, your email address will be
            automatically verified.
          </Text>
          <Section style={buttonSection}>
            <Link href={registerUrl} style={button}>
              Accept Invitation
            </Link>
          </Section>
          <Text style={muted}>
            Or copy this link: {registerUrl}
          </Text>
          <Hr style={hr} />
          <Text style={muted}>
            This invitation expires in 7 days. If you did not expect this
            invitation, you can safely ignore this email.
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
