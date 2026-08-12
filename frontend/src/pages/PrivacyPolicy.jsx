const PrivacyPolicy = () => {
  return (
    <div className="max-w-4xl mx-auto pb-20">
      <div className="glass-panel p-8 md:p-10 space-y-8">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-400/80 mb-3">Privacy Policy</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white">How ClassVote handles voter data</h2>
        </div>

        <section className="space-y-3 text-slate-300 leading-7">
          <h3 className="text-xl font-semibold text-white">Data collected</h3>
          <p>
            ClassVote collects the name and email address entered on the entry page, the eligible
            voter record used to verify access, and the ballot selections submitted for each
            position.
          </p>
        </section>

        <section className="space-y-3 text-slate-300 leading-7">
          <h3 className="text-xl font-semibold text-white">How the data is used</h3>
          <p>
            The data is used to confirm that a voter is on the eligible roster, prevent duplicate
            voting, store election results, and display live vote counts to the admin or to the
            public after results are published.
          </p>
        </section>

        <section className="space-y-3 text-slate-300 leading-7">
          <h3 className="text-xl font-semibold text-white">Storage and retention</h3>
          <p>
            Election data is stored in MongoDB for the duration of the election and may be kept for
            audit or record-keeping purposes after voting ends. Admin credentials are stored only in
            server environment variables.
          </p>
        </section>

        <section className="space-y-3 text-slate-300 leading-7">
          <h3 className="text-xl font-semibold text-white">Access and security</h3>
          <p>
            Admin-only actions are protected on the backend. Student-facing pages do not expose
            admin controls, and the app uses request validation, rate limiting, and cookie-based
            admin sessions to reduce abuse.
          </p>
        </section>

        <section className="space-y-3 text-slate-300 leading-7">
          <h3 className="text-xl font-semibold text-white">Contact</h3>
          <p>
            For questions about this policy or the election setup, contact the admin or the person
            running the election.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPolicy;