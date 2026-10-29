import { A, LEGAL_CONTACT, LegalPage, List, Section, Sub } from "@/app/_components/legal";

export const metadata = { title: "Privacy Policy · Bambii" };

const LAST_UPDATED = "October 29, 2026";
const CONTACT = LEGAL_CONTACT;

/**
 * Public, signed-out page. Every statement here describes what the code actually does: when data
 * handling changes (connector scopes, providers, retention), update the matching section and the date.
 */
export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      intro={
        <>
          <p>
            Bambii (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;) runs the Bambii website at bambii.ai, the
            Bambii web app, and the Bambii app for Mac (together, the &ldquo;Service&rdquo;). The Service lets you chat
            with AI bots that can work with the accounts you connect, such as Slack, Gmail and Notion, and build small
            apps with Builder that run on your own device.
          </p>
          <p>
            This policy explains what information we collect, how we use and share it, how long we keep it, and the
            choices you have. By using the Service, you agree to this policy.
          </p>
        </>
      }
      lastUpdated={LAST_UPDATED}
      title="Privacy Policy"
    >

      <Section title="Changes to this policy">
        <p>
          We may update this policy as the Service changes. We&apos;ll change the date at the top when we do, and if a
          change is significant we&apos;ll let you know by email or in the app before it takes effect.
        </p>
      </Section>

      <Section title="The short version">
        <List>
          <li>We don&apos;t sell your information, and we don&apos;t show ads.</li>
          <li>We don&apos;t use analytics or advertising trackers.</li>
          <li>We don&apos;t use your information to train AI models, and neither does our AI provider.</li>
          <li>The data inside apps you build is stored on your device, not on our servers.</li>
          <li>You can delete a chat, an app, or your whole account at any time.</li>
        </List>
      </Section>

      <Section title="Information we collect">
        <Sub title="Information you give us">
          <List>
            <li>
              <strong>Account details.</strong> Your name, email address, and sign-in methods such as passkeys. Our
              sign-in provider, Clerk, handles these; our own database stores only your account ID.
            </li>
            <li>
              <strong>Messages and attachments.</strong> What you write to the bots, and files you attach (images,
              PDFs and text files, up to 3&nbsp;MB in total per message).
            </li>
            <li>
              <strong>Instructions and settings.</strong> Extra instructions you give a chat, the names and
              descriptions of apps you ask Builder to make.
            </li>
            <li>
              <strong>Messages to us.</strong> Anything you send when you contact us.
            </li>
          </List>
        </Sub>

        <Sub title="Information from services you connect">
          <p>
            When you connect an account, you authorize Bambii through that service&apos;s own sign-in screen. The
            access tokens are held by our infrastructure provider&apos;s connection service (Vercel Connect), not in
            our database, and you can disconnect at any time in Settings → Connections.
          </p>
          <List>
            <li>
              <strong>Slack.</strong> Permission to search messages, read the history of channels, private channels
              and direct messages you can access, list channels, and post messages as you.
            </li>
            <li>
              <strong>Google (Gmail).</strong> Permission to read and modify your Gmail and to compose email. Bambii
              uses it to search and read your email, create drafts, and send email you&apos;ve approved.
            </li>
            <li>
              <strong>Notion.</strong> Access to the pages you share with Bambii. Bots read them; changes are made
              only after you approve them.
            </li>
          </List>
          <p>
            Bots read from these services when you ask them to, and what they read becomes part of your chat.
            Sending an email or posting to Slack always asks for your confirmation first; creating a Gmail draft does
            not. Apps you build can use only the services they declared, and must ask before sending or posting
            anything.
          </p>
        </Sub>

        <Sub title="Information collected automatically">
          <List>
            <li>
              <strong>Cookies.</strong> Clerk sets cookies that keep you signed in and protect sign-in from abuse
              (including a bot check by Cloudflare). We set one preference cookie that remembers whether you collapsed
              the sidebar. We don&apos;t use advertising or analytics cookies.
            </li>
            <li>
              <strong>Storage in your browser.</strong> How long recent replies took (to estimate wait times), your
              scroll position in a chat, and the data of apps you open in the browser.
            </li>
            <li>
              <strong>Logs.</strong> Our servers record requests and errors, which can include your account ID, a chat
              ID, your IP address and device information, to keep the Service running and secure.
            </li>
            <li>
              <strong>Usage counts.</strong> How many messages, app builds, AI calls and connector calls you make each
              day, and what your AI use costs, to enforce usage limits.
            </li>
          </List>
        </Sub>
      </Section>

      <Section title="Google user data">
        <p>
          Bambii&apos;s use and transfer of information received from Google APIs adheres to the{" "}
          <A href="https://developers.google.com/terms/api-services-user-data-policy">
            Google API Services User Data Policy
          </A>
          , including the Limited Use requirements. In particular:
        </p>
        <List>
          <li>We use Gmail data only to provide the features you use in Bambii.</li>
          <li>We don&apos;t use it for advertising, and we don&apos;t sell it.</li>
          <li>We don&apos;t use it to develop, improve or train AI or machine-learning models.</li>
          <li>
            People at Bambii don&apos;t read it unless you ask us to, it&apos;s needed for security or to comply with
            the law, or it has been aggregated and anonymized.
          </li>
        </List>
      </Section>

      <Section title="Apps you build">
        <List>
          <li>
            <strong>The app itself.</strong> Each version&apos;s code and build are stored on our servers so you can
            open the app on your devices and keep changing it.
          </li>
          <li>
            <strong>The app&apos;s data.</strong> What you save in an app is stored on your device: on your Mac, or in
            your browser if you open the app there. It isn&apos;t stored on our servers.
          </li>
          <li>
            <strong>Chatting with an app&apos;s bot.</strong> So the bot can answer questions about your app, each
            message you send it includes a snapshot of that app&apos;s data.
          </li>
          <li>
            <strong>What apps can reach.</strong> Apps can&apos;t access the internet directly. Their AI requests and
            connected-service requests go through our servers, under the rules above.
          </li>
          <li>
            <strong>Building.</strong> Builder writes and tests code in an isolated sandbox that can reach only the
            public npm package registry.
          </li>
        </List>
      </Section>

      <Section title="How we use information">
        <List>
          <li>To provide the Service: run your chats, carry out what you ask, and build and run your apps.</li>
          <li>To keep chats going: when a chat continues in a new session, earlier messages are given back to the bot.</li>
          <li>To enforce usage limits and prevent abuse, fraud and security incidents.</li>
          <li>To find and fix problems, and to improve the Service.</li>
          <li>To contact you about the Service, including changes to this policy.</li>
          <li>To comply with the law and enforce our terms.</li>
        </List>
      </Section>

      <Section title="How we share information">
        <p>We don&apos;t sell your information. We share it only as follows:</p>
        <List>
          <li>
            <strong>Service providers</strong> that run parts of the Service for us, under contracts that limit how
            they use it:
            <List>
              <li>Vercel: hosting, file storage, build sandboxes, chat sessions, and connected-account tokens.</li>
              <li>Turso: our database.</li>
              <li>Clerk: accounts and sign-in, with Cloudflare for bot protection.</li>
              <li>
                Anthropic: the AI models that power the bots and your apps. Your messages, attachments and the
                information bots read are sent to Anthropic to generate replies, under terms that don&apos;t allow them
                to train their models on it.
              </li>
              <li>Exa, through Vercel&apos;s AI Gateway: web searches the bots make for you.</li>
            </List>
          </li>
          <li>
            <strong>Services you connect</strong>, when you ask a bot or an app to act there, such as sending an email
            or posting to Slack.
          </li>
          <li>
            <strong>Legal reasons</strong>, when we believe in good faith it&apos;s required by law, or needed to
            protect the rights, safety or property of our users, the public or Bambii.
          </li>
          <li>
            <strong>Business transfers</strong>, if Bambii is involved in a merger, acquisition or sale of assets. We
            would tell you before your information became subject to a different policy.
          </li>
          <li>
            <strong>With your consent</strong>, in any other case.
          </li>
        </List>
      </Section>

      <Section title="How long we keep information">
        <List>
          <li>
            <strong>Chats</strong> are kept until you delete them. Builder chats end after 30 days; we keep the text of
            a chat whose session has ended so you can still read it and continue it, until you delete the chat.
          </li>
          <li>
            <strong>Apps</strong> are kept until you delete them.
          </li>
          <li>
            <strong>Records of sent emails and posts</strong>, used to prevent sending the same thing twice, are
            deleted after about 7 days.
          </li>
          <li>
            <strong>Logs</strong> are kept for our hosting provider&apos;s retention period.
          </li>
          <li>
            <strong>Deleting your account</strong> erases your chats, apps, settings and usage records from our
            systems, and disconnects your connected accounts. App data on a Mac stays on that Mac until you remove
            the app or Bambii there.
          </li>
        </List>
      </Section>

      <Section title="Your choices and rights">
        <List>
          <li>Delete any chat or app, or your whole account, in the app (Settings → Account).</li>
          <li>Disconnect Slack, Google or Notion at any time in Settings → Connections, or from that service.</li>
          <li>Update your name, email and sign-in methods in your account settings.</li>
        </List>
        <p>
          Depending on where you live, you may have rights to access, correct, delete or receive a copy of your
          information, and to object to or restrict how we use it. To make a request, email{" "}
          <A href={`mailto:${CONTACT}`}>{CONTACT}</A>. We&apos;ll respond within 30 days, and we may need to verify
          your identity first. You can also complain to your local data protection authority.
        </p>
      </Section>

      <Section title="Security">
        <p>
          We protect your information with measures such as encryption in transit, access controls, isolated
          sandboxes for building apps, and confirmations before bots send or post anything. No system is perfectly
          secure, though, and we can&apos;t guarantee the security of your information.
        </p>
        <p>
          AI bots can make mistakes, misunderstand a request, or be misled by content they read, such as a crafted
          email or message. Review what a bot drafts or proposes to send before you approve it.
        </p>
      </Section>

      <Section title="International transfers">
        <p>
          We and our service providers process information in the United States and India, and possibly other
          countries where their facilities are. These countries may have different data protection laws from yours;
          where required, we rely on appropriate safeguards for these transfers.
        </p>
      </Section>

      <Section title="Children">
        <p>
          You must be at least 18 to use the Service. It isn&apos;t intended for children, and we don&apos;t
          knowingly collect their information. If you believe a child has given us information, email us and
          we&apos;ll delete it.
        </p>
      </Section>

      <Section title="Other websites and services">
        <p>
          The Service links to and works with services we don&apos;t control, such as Slack, Google and Notion. Their
          own privacy policies apply to how they handle your information.
        </p>
      </Section>

      <Section title="Contact us">
        <p>
          Questions or requests about this policy or your information: <A href={`mailto:${CONTACT}`}>{CONTACT}</A>.
        </p>
      </Section>
    </LegalPage>
  );
}
