import { useEffect, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router'
import { Card } from '@/ui/Card'
import { Page } from '@/ui/Page'
import { PageHeader } from '@/ui/PageHeader'
import { StatusBarVeil } from '@/ui/StatusBarVeil'

// Both app stores expect a way to reach you. The draft notice below shows until this is filled in.
const CONTACT_EMAIL = 'eitantravels25@gmail.com'
const UPDATED = '6 November 2026'

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="mt-7 scroll-mt-6">
      <h2 className="font-display text-title-3 font-semibold">{title}</h2>
      <div className="mt-2 flex flex-col gap-2 text-callout text-muted">{children}</div>
    </section>
  )
}

const Bullets = ({ children }: { children: ReactNode }) => <ul className="flex list-disc flex-col gap-1.5 pl-5">{children}</ul>

const Email = () => (
  <a href={`mailto:${CONTACT_EMAIL}`} className="text-accent-text">
    {CONTACT_EMAIL}
  </a>
)

/** Public, so the app stores can link to it. #delete-account is the deletion link Google Play asks for. */
export function PrivacyPage() {
  const { hash } = useLocation()

  // The page renders after the browser looks for the anchor, so a link to a section needs this.
  useEffect(() => {
    if (hash) document.getElementById(hash.slice(1))?.scrollIntoView()
  }, [hash])

  return (
    <Page>
      <StatusBarVeil />
      <PageHeader back eyebrow="Inside Out Training" title="Privacy policy" subtitle={`Updated ${UPDATED}`} />

      {!CONTACT_EMAIL && (
        <Card className="p-4 text-subhead">
          <strong>Draft.</strong> A contact email still needs to be added to this policy.
        </Card>
      )}

      <Section title="What we collect">
        <Bullets>
          <li>Your email address and password, so you can sign in. Passwords are stored only in hashed form.</li>
          <li>Your name, if you add one.</li>
          <li>The training you enter: workouts, sets, weights, maxes, notes, comments and your settings.</li>
        </Bullets>
        <p>
          We don't ask for your location, contacts, photos or health-app data. The app has no ads, analytics or trackers. Our hosting
          providers keep technical logs, such as IP addresses, to keep their services running and secure.
        </p>
      </Section>

      <Section title="How we use it">
        <p>
          Only to run the app: signing you in, saving your training, showing your progress and connecting you with a coach. We don't sell
          your data or use it for advertising.
        </p>
      </Section>

      <Section title="Who can see it">
        <Bullets>
          <li>
            <strong>Your coach, if you accept an invite.</strong> They can see your workouts, maxes and progress, assign workouts, adjust ones
            you haven't started and comment on them. Either of you can end this at any time.
          </li>
          <li>
            <strong>Your clients, if you coach.</strong> They see your name, the workouts you assign and your comments.
          </li>
          <li>
            <strong>Our service providers.</strong> Supabase stores the database and handles sign-in. Vercel hosts the website.
          </li>
          <li>
            <strong>Authorities,</strong> if the law requires us to share it.
          </li>
        </Bullets>
      </Section>

      <Section title="On your device">
        <p>The app keeps you signed in and remembers your appearance choices by storing them on your device.</p>
      </Section>

      <Section id="delete-account" title="Deleting your account">
        <p>
          We keep your data until you delete your account. To delete it, sign in on the app or the website, go to{' '}
          <Link to="/settings" className="text-accent-text">
            Settings
          </Link>{' '}
          and choose <strong>Delete account</strong>.
          {CONTACT_EMAIL && (
            <>
              {' '}
              If you can't sign in, email <Email />.
            </>
          )}
        </p>
        <p>
          This immediately and permanently deletes your login, profile, workouts, maxes, custom exercises, templates, programs, comments and
          settings.
        </p>
        <p>
          If you coach, workouts you've already assigned stay with your clients as part of their training history, along with copies of any
          custom exercises they use.
        </p>
      </Section>

      <Section title="Children">
        <p>Inside Out Training isn't meant for children under 13, and we don't knowingly collect their data.</p>
      </Section>

      <Section title="Changes">
        <p>If this policy changes, we'll update this page and the date at the top.</p>
      </Section>

      {CONTACT_EMAIL && (
        <Section title="Contact">
          <p>
            Questions about your privacy? Email <Email />.
          </p>
        </Section>
      )}
    </Page>
  )
}
