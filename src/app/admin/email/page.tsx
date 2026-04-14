'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '@/components/navigation/Header';

export default function AdminEmailPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('Splint Factory Test Email');
  const [body, setBody] = useState(
    '<h2>Test Email</h2><p>This is a test email from Splint Factory to verify the email sending configuration is working correctly.</p>'
  );
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  if (status === 'loading') {
    return (
      <div className="page-shell" data-testid="email-loading">
        <Header />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-secondary">Loading...</div>
        </div>
      </div>
    );
  }

  if (!session?.user || (session.user as { role?: string }).role !== 'SYSTEM_ADMIN') {
    router.push('/');
    return null;
  }

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setResult(null);

    try {
      const response = await fetch('/api/admin/email/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, body }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send test email');
      }

      setResult({ success: true, message: `Test email sent successfully to ${to}` });
    } catch (err) {
      setResult({
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="page-shell" data-testid="email-page">
      <Header />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="page-title">Email Administration</h1>
          <p className="mt-2 text-muted">
            Test email delivery and manage email configuration.
          </p>
        </div>

        {/* Test Email Section */}
        <div className="card">
          <div className="px-6 py-4 border-b border-[var(--border)]">
            <h2 className="text-lg font-medium text-primary">Send Test Email</h2>
            <p className="mt-1 text-sm text-muted">
              Sends via notifications.splintfactory.com using Resend.
            </p>
          </div>

          <form onSubmit={handleSendTest} className="p-6 space-y-4">
            <div>
              <label htmlFor="to" className="block text-sm font-medium text-secondary mb-1">
                Recipient Email
              </label>
              <input
                type="email"
                id="to"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="input-field text-sm"
                data-testid="to-input"
                placeholder="recipient@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="subject" className="block text-sm font-medium text-secondary mb-1">
                Subject
              </label>
              <input
                type="text"
                id="subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="input-field text-sm"
                data-testid="subject-input"
                required
              />
            </div>

            <div>
              <label htmlFor="body" className="block text-sm font-medium text-secondary mb-1">
                Body (HTML)
              </label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                className="input-field text-sm font-mono"
                data-testid="body-textarea"
                required
              />
            </div>

            {result && (
              <div
                className={result.success ? 'alert-success' : 'alert-error'}
                data-testid="send-result"
              >
                {result.message}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={sending}
                className="btn-primary px-6 py-2 text-sm"
                data-testid="send-btn"
              >
                {sending ? 'Sending...' : 'Send Test Email'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
