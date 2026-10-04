import { Body, Container, Head, Hr, Html, Preview, Text } from '@react-email/components'

interface ConferenceAccessAlertProps {
  name: string
  email: string
  phone?: string
  organizationName?: string
  outcome: 'access-request' | 'account-created' | 'existing-account'
  submittedAt: string
}

const outcomeLabels = {
  'access-request': 'Access requested while conference registration was disabled',
  'account-created': 'Conference account created',
  'existing-account': 'Existing account directed to sign in',
}

export default function ConferenceAccessAlert({
  name,
  email,
  phone,
  organizationName,
  outcome,
  submittedAt,
}: ConferenceAccessAlertProps) {
  return (
    <Html>
      <Head />
      <Preview>Conference access submission from {name}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Text style={heading}>Conference Access Submission</Text>
          <Text style={muted}>{submittedAt}</Text>
          <Hr style={hr} />
          <Text style={row}><strong>Name:</strong> {name}</Text>
          <Text style={row}><strong>Email:</strong> {email}</Text>
          {phone && <Text style={row}><strong>Phone:</strong> {phone}</Text>}
          {organizationName && <Text style={row}><strong>Conference organization:</strong> {organizationName}</Text>}
          <Text style={row}><strong>Outcome:</strong> {outcomeLabels[outcome]}</Text>
          <Hr style={hr} />
          <Text style={muted}>Sent to SYSTEM_ADMIN users who opted into site alerts.</Text>
        </Container>
      </Body>
    </Html>
  )
}

const body = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '560px',
  borderRadius: '8px',
}

const heading = { fontSize: '22px', fontWeight: '700' as const, color: '#1e3a5f' }
const row = { fontSize: '14px', color: '#374151', margin: '7px 0' }
const muted = { fontSize: '12px', color: '#6b7280' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }