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
import { type MoreInfoFormData } from '@/app/api/more-information/route';

interface MoreInfoRequestEmailProps {
  name: string;
  email: string;
  submittedAt: string;
  data: MoreInfoFormData;
}

export default function MoreInfoRequestEmail({ name, email, submittedAt, data }: MoreInfoRequestEmailProps) {
  const interests: string[] = [];
  if (data.interestedWaitlist) interests.push('Waitlist for printing platform');
  if (data.interestedInfo) interests.push('Information about our system');
  if (data.interestedUpdates) interests.push('Occasional email updates');

  return (
    <Html>
      <Head />
      <Preview>New more-info request from {name} ({data.organization})</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>New More-Info Request</Text>
          <Text style={subheading}>Submitted {submittedAt}</Text>

          <Section style={detailsSection}>
            <Text style={row}><strong>Name:</strong> {name}</Text>
            <Text style={row}><strong>Organization:</strong> {data.organization}</Text>
            <Text style={row}><strong>Medical Specialty:</strong> {data.medicalSpecialty}</Text>
            <Text style={row}><strong>Email:</strong> {email}</Text>
            {data.phone && <Text style={row}><strong>Phone:</strong> {data.phone}</Text>}
            <Text style={row}><strong>Location:</strong> {data.city}, {data.stateProvince}, {data.country}</Text>
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

          {data.notes && (
            <>
              <Hr style={hr} />
              <Text style={sectionLabel}>Anything else?</Text>
              <Text style={notesBlock}>{data.notes}</Text>
            </>
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

const notesBlock = {
  fontSize: '14px',
  color: '#374151',
  backgroundColor: '#f9fafb',
  padding: '12px',
  borderRadius: '6px',
  margin: '4px 0',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
};

const muted = {
  fontSize: '12px',
  color: '#9ca3af',
};
