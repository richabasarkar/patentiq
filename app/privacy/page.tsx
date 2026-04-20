import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Inter, sans-serif' }}>
      <header className="fixed top-0 left-0 right-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.png" alt="PatentIQ" width={140} height={36} className="object-contain h-9 w-auto" />
          </Link>
          <Link href="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">← Home</Link>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-6 pt-28 pb-20">
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: April 2026</p>

        <div className="prose prose-slate max-w-none space-y-8">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Overview</h2>
            <p className="text-slate-600 leading-relaxed">
              PatentIQ ("we," "us," or "our") operates patentiq-ten.vercel.app. This Privacy Policy explains how we collect, use, and protect your information when you use our service. By using PatentIQ, you agree to the collection and use of information in accordance with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Information We Collect</h2>
            <p className="text-slate-600 leading-relaxed mb-3">We collect the following information:</p>
            <ul className="space-y-2 text-slate-600">
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span><strong>Account information:</strong> Your name and email address when you create an account.</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span><strong>Usage data:</strong> Pages visited, searches performed, and features used, collected to improve the service.</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span><strong>Saved data:</strong> Examiners you save to your account.</span></li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              We do not collect payment information directly. All payment processing is handled by third-party payment processors.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. How We Use Your Information</h2>
            <ul className="space-y-2 text-slate-600">
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>To provide and maintain the PatentIQ service</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>To manage your account and authenticate your identity</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>To send you account-related emails (confirmation, password reset)</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>To improve the service based on usage patterns</span></li>
            </ul>
            <p className="text-slate-600 leading-relaxed mt-3">
              We do not sell, trade, or rent your personal information to third parties. We do not use your data for advertising purposes.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data Sources</h2>
            <p className="text-slate-600 leading-relaxed">
              All patent examiner data displayed on PatentIQ is sourced from publicly available USPTO datasets, including the Patent Examination Data System (PatEx) and the Office Action Research Dataset. This data is public information published by the United States Patent and Trademark Office. PatentIQ does not create, modify, or generate this underlying data — we organize and present it to make it more accessible.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. Data Storage & Security</h2>
            <p className="text-slate-600 leading-relaxed">
              Your account information is stored securely using Supabase, which provides industry-standard security including encrypted data at rest and in transit. Passwords are hashed using bcrypt and are never stored in plain text. We implement Row Level Security to ensure users can only access their own data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Third-Party Services</h2>
            <p className="text-slate-600 leading-relaxed mb-3">We use the following third-party services:</p>
            <ul className="space-y-2 text-slate-600">
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span><strong>Supabase:</strong> Database and authentication</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span><strong>Vercel:</strong> Hosting and deployment</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span><strong>Anthropic:</strong> AI responses in the Ask AI feature (your questions and examiner data are sent to Anthropic to generate responses)</span></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Your Rights</h2>
            <p className="text-slate-600 leading-relaxed">
              You may request deletion of your account and associated data at any time by contacting us. You may also update your account information through the Account Settings page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Changes to This Policy</h2>
            <p className="text-slate-600 leading-relaxed">
              We may update this Privacy Policy from time to time. We will notify you of significant changes by posting the new policy on this page with an updated date.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Contact</h2>
            <p className="text-slate-600 leading-relaxed">
              If you have questions about this Privacy Policy, please contact us through the PatentIQ website.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex gap-6">
          <Link href="/terms" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Terms of Service →</Link>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}