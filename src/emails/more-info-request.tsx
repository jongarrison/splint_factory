import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Hr,
  Preview,
} from '@react-email/components';

interface MoreInfoRequestEmailProps {
  name: string;
  city: string;
  stateProvince: string;
  country: string;
  email: string;
  phone?: string;
  organization: string;
  medicalSpecialty: string;
  interestedWaitlist: boolean;
  interestedInfo: boolean;
  interestedUpdates: boolean;
  submittedAt: string;
}

export default function MoreInfoRequestEmail({
  name,
  city,
  stateProvince,
  country,
  email,
  phone,
  organization,
  medicalSpecialty,
  interestedWaitlist,
  interestedInfo,
  interestedUpdates,
  submittedAt,
}: MoreInfoRequestEmailProps) {
  const interests: string[] = [];
  if (interestedWaitlist) interests.push('Waitlist for printing platform');
  if (interestedInfo) interests.push('Information about our system');
  if (interestedUpdates) interests.push('Occasional email updates');

  return (
    <Html>
      <Head />
      <Preview>New more-info request from {name} ({organization})</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>New More-Info Request</Text>
          <Text style={subheading}>Submitted {submittedAt}</Text>

          <Section style={detailsSection}>
            <Text style={row}><strong>Name:</strong> {name}</Text>
            <Text style={row}><strong>Organization:</strong> {organization}</Text>
            <Text style={row}><strong>Medical Specialty:</strong> {medicalSpecialty}</Text>
            <Text style={row}><strong>Email:</strong> {email}</Text>
            {phone && <Text style={row}><strong>Phone:</strong> {phone}</Text>}
            <Text style={row}><strong>Location:</strong> {city}, {stateProvince}, {country}</Text>
          </Section>

          <Hr style={hr} />

          <Text style={sectionLabel}>Interested In:</Text>
          {interests.length > 0 ? (
            interests.map((interest, i) => (
              <Text key={i} style={interestRow}>- {interest}</Text>
            ))
          ) : (
            <Text style={row}>None selected</Text>
          )}

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
  fontSize: '22px',
  fontWeight: '700' as const,
  color: '#1e3a5f',
  marginBottom: '4px',
};

const subheading = {
  fontSize: '13px',
  color: '#6b7280',
  marginBottom: '24px',
};

const detailsSection = {
  marginBottom: '8px',
};

const row = {
  fontSize: '14px',
  color: '#374151',
  margin: '6px 0',
};

const sectionLabel = {
  fontSize: '13px',
  fontWeight: '600' as const,
  color: '#374151',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  margin: '8px 0 4px',
};

const interestRow = {
  fontSize: '14px',
  color: '#374151',
  margin: '3px 0',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
};

const muted = {
  fontSize: '12px',
  color: '#9ca3af',
};
