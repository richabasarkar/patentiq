import Link from 'next/link';
import Image from 'next/image';

export default function TermsPage() {
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
        <h1 className="text-4xl font-extrabold text-slate-900 mb-2">Terms of Service</h1>
        <p className="text-sm text-slate-400 mb-10">Last updated: April 2026</p>

        <div className="space-y-8">

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">1. Acceptance of Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              By accessing or using PatentIQ ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">2. Description of Service</h2>
            <p className="text-slate-600 leading-relaxed">
              PatentIQ provides an information platform that organizes and presents publicly available data from the United States Patent and Trademark Office (USPTO). The Service allows users to search and view statistics about USPTO patent examiners, including allowance rates, rejection patterns, and prosecution timelines.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">3. Not Legal Advice</h2>
            <p className="text-slate-600 leading-relaxed">
              <strong>PatentIQ is not a law firm and does not provide legal advice.</strong> All information provided through the Service, including AI-generated responses, examiner statistics, and prosecution strategy suggestions, is for informational purposes only and does not constitute legal advice. You should consult a qualified patent attorney before making any decisions related to patent prosecution strategy. PatentIQ is not responsible for any decisions made based on information obtained through the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">4. Data Accuracy</h2>
            <p className="text-slate-600 leading-relaxed">
              All examiner data displayed on PatentIQ is sourced from publicly available USPTO datasets. While we make reasonable efforts to present this data accurately, we do not guarantee the accuracy, completeness, or timeliness of any information. USPTO data is updated periodically and may not reflect the most current examiner statistics. PatentIQ is not responsible for any inaccuracies in the underlying USPTO data.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">5. User Accounts</h2>
            <p className="text-slate-600 leading-relaxed">
              You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account. We reserve the right to terminate accounts that violate these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">6. Acceptable Use</h2>
            <p className="text-slate-600 leading-relaxed mb-3">You agree not to:</p>
            <ul className="space-y-2 text-slate-600">
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>Use the Service for any unlawful purpose</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>Attempt to scrape, crawl, or systematically extract data from the Service</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>Reverse engineer or attempt to extract the underlying data or algorithms</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>Resell or redistribute the Service or its data without permission</span></li>
              <li className="flex gap-2"><span className="text-slate-400 shrink-0">—</span><span>Interfere with the operation of the Service</span></li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">7. Intellectual Property</h2>
            <p className="text-slate-600 leading-relaxed">
              The PatentIQ platform, including its design, features, and organization of data, is proprietary. The underlying USPTO examiner data is public domain. AI-generated responses are provided for your personal use and may not be resold or redistributed.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">8. Limitation of Liability</h2>
            <p className="text-slate-600 leading-relaxed">
              To the maximum extent permitted by law, PatentIQ shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of or inability to use the Service, or from any decisions made based on information provided by the Service. Our total liability shall not exceed the amount you paid for the Service in the twelve months preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">9. Disclaimer of Warranties</h2>
            <p className="text-slate-600 leading-relaxed">
              The Service is provided "as is" without warranties of any kind, either express or implied. We do not warrant that the Service will be uninterrupted, error-free, or that any defects will be corrected.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">10. Changes to Terms</h2>
            <p className="text-slate-600 leading-relaxed">
              We reserve the right to modify these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-slate-900 mb-3">11. Governing Law</h2>
            <p className="text-slate-600 leading-relaxed">
              These Terms shall be governed by the laws of the United States, without regard to conflict of law provisions.
            </p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-slate-100 flex gap-6">
          <Link href="/privacy" className="text-sm text-blue-600 hover:text-blue-700 font-medium">Privacy Policy →</Link>
          <Link href="/" className="text-sm text-slate-400 hover:text-slate-600">← Back to home</Link>
        </div>
      </div>
    </div>
  );
}